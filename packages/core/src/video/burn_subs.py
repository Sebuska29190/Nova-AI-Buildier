"""
Burn subtitles onto video frames using Pillow (PIL) rendering + FFmpeg overlay.

Provides:
  - Robust SRT parser (handles CRLF, BOM, mixed separators, empty blocks)
  - PIL text rendering with stroke/outline, auto-wrapping (word + CJK char wrap)
  - FFmpeg PNG-overlay chain for burning subtitles into video
  - Direct FFmpeg subtitle filter fallback (burn_with_ffmpeg)
  - Single-frame burn (burn_on_frame)
"""

import os
import re
import sys
import json
import math
import shutil
import tempfile
import subprocess
from typing import List, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont


# ---------------------------------------------------------------------------
# Font discovery
# ---------------------------------------------------------------------------

DEFAULT_FONT_PATHS = [
    # Windows
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\constan.ttf",
    r"C:\Windows\Fonts\tahoma.ttf",
    # Linux
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansSC-Regular.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansSC-Regular.otf",
    # macOS
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Arial.ttf",
]


def find_font(font_path: Optional[str] = None) -> Optional[str]:
    """Resolve a font path.  Returns None if no font can be found."""
    if font_path and os.path.isfile(font_path) and os.path.getsize(font_path) > 1000:
        return font_path

    # Check NOVA_SUBTITLE_FONT env var
    env_font = os.environ.get("NOVA_SUBTITLE_FONT")
    if env_font and os.path.isfile(env_font):
        return env_font

    # Check ~/.cheetahclaws/fonts/ cache
    cache_dir = os.path.join(os.path.expanduser("~"), ".cheetahclaws", "fonts")
    if os.path.isdir(cache_dir):
        for fname in os.listdir(cache_dir):
            full = os.path.join(cache_dir, fname)
            if os.path.isfile(full) and os.path.getsize(full) > 100_000:
                return full

    for path in DEFAULT_FONT_PATHS:
        if os.path.isfile(path) and os.path.getsize(path) > 1000:
            return path

    return None


# ---------------------------------------------------------------------------
# SRT parsing
# ---------------------------------------------------------------------------

_TIME_RE = re.compile(
    r"(\d{1,3}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*"
    r"(\d{1,3}):(\d{2}):(\d{2})[.,](\d{1,3})"
)


def parse_srt(srt_path: str) -> List[Tuple[float, float, str]]:
    """
    Parse an SRT file into a list of (start_seconds, end_seconds, text) tuples.

    Handles:
      - Unix (\\n) and Windows (\\r\\n) line endings
      - BOM at the start of the file
      - Blank lines and varying numbers of newlines between blocks
      - Index numbers that may be absent or non-sequential
      - Commas or dots as millisecond separators
      - Extra whitespace around timestamps
    """
    with open(srt_path, "r", encoding="utf-8-sig") as f:  # utf-8-sig strips BOM
        raw = f.read()

    # Normalise line endings
    raw = raw.replace("\r\n", "\n")

    subtitles: List[Tuple[float, float, str]] = []

    # Split on one or more blank lines (handles \n\n, \n\n\n, trailing whitespace)
    blocks = re.split(r"\n[ \t]*\n", raw.strip())

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        lines = block.split("\n")
        if len(lines) < 2:
            continue

        # Find the line that contains the timestamp arrow
        time_idx = None
        for i, line in enumerate(lines):
            if "-->" in line:
                time_idx = i
                break

        if time_idx is None:
            continue

        # Parse timestamps
        m = _TIME_RE.search(lines[time_idx])
        if not m:
            continue

        start = (
            int(m.group(1)) * 3600
            + int(m.group(2)) * 60
            + int(m.group(3))
            + int(m.group(4)) / (1000 if int(m.group(4)) >= 100 else 1000)
        )
        end = (
            int(m.group(5)) * 3600
            + int(m.group(6)) * 60
            + int(m.group(7))
            + int(m.group(8)) / (1000 if int(m.group(8)) >= 100 else 1000)
        )

        # Collect text from lines after the timestamp line
        text_lines = []
        for line in lines[time_idx + 1 :]:
            stripped = line.strip()
            if stripped:
                text_lines.append(stripped)

        text = "\n".join(text_lines)
        if text:
            subtitles.append((start, end, text))

    return subtitles


# ---------------------------------------------------------------------------
# Text wrapping
# ---------------------------------------------------------------------------


def _text_width(text: str, font: ImageFont.FreeTypeFont, draw: ImageDraw.ImageDraw) -> int:
    """Return the pixel width of *text* when rendered in *font*."""
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[2] - bb[0]


def _text_height(text: str, font: ImageFont.FreeTypeFont, draw: ImageDraw.ImageDraw) -> int:
    """Return the pixel height of *text* when rendered in *font*."""
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[3] - bb[1]


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int,
              draw: Optional[ImageDraw.ImageDraw] = None) -> str:
    """
    Word-wrap *text* to fit within *max_width* pixels.

    Falls back to character-level wrapping for:
      - CJK text (no spaces between characters)
      - Single words that exceed *max_width*
    """
    # Quick check – fits on one line?
    if draw is None:
        dummy = Image.new("RGBA", (1, 1))
        draw = ImageDraw.Draw(dummy)

    raw_lines = text.split("\n")
    result_lines: List[str] = []

    for raw in raw_lines:
        if not raw:
            result_lines.append("")
            continue

        if _text_width(raw, font, draw) <= max_width:
            result_lines.append(raw)
            continue

        words = raw.split()
        if not words:
            # No whitespace – CJK / raw characters
            chunk = ""
            for ch in raw:
                test = chunk + ch
                if _text_width(test, font, draw) > max_width and chunk:
                    result_lines.append(chunk)
                    chunk = ch
                else:
                    chunk = test
            if chunk:
                result_lines.append(chunk)
        elif len(words) == 1 and _text_width(words[0], font, draw) > max_width:
            # Single word too long – character wrap
            chunk = ""
            for ch in words[0]:
                test = chunk + ch
                if _text_width(test, font, draw) > max_width and chunk:
                    result_lines.append(chunk)
                    chunk = ch
                else:
                    chunk = test
            if chunk:
                result_lines.append(chunk)
        else:
            # Normal word-wrapping
            cur: List[str] = []
            for w in words:
                test = " ".join(cur + [w])
                if _text_width(test, font, draw) > max_width and cur:
                    result_lines.append(" ".join(cur))
                    cur = [w]
                else:
                    cur.append(w)
            if cur:
                result_lines.append(" ".join(cur))

    return "\n".join(result_lines)


# ---------------------------------------------------------------------------
# PIL rendering
# ---------------------------------------------------------------------------


def render_subtitle_text(
    text: str,
    font_path: str,
    font_size: int,
    max_width: int,
    font_color: Tuple[int, int, int, int] = (255, 255, 255, 255),
    stroke_color: Tuple[int, int, int, int] = (0, 0, 0, 220),
) -> Optional[Image.Image]:
    """
    Render *text* onto a transparent RGBA image, ready for compositing.

    Returns None on any error.
    """
    try:
        font = ImageFont.truetype(font_path, font_size)
    except Exception as exc:
        print(f"  Font load error ({font_path}): {exc}", file=sys.stderr)
        return None

    dummy = Image.new("RGBA", (1, 1))
    draw = ImageDraw.Draw(dummy)

    wrapped = wrap_text(text, font, max_width, draw)
    lines = wrapped.split("\n")

    # Measure each line
    line_bboxes = [draw.textbbox((0, 0), ln, font=font) for ln in lines]
    line_widths = [bb[2] - bb[0] for bb in line_bboxes]
    line_heights = [bb[3] - bb[1] for bb in line_bboxes]

    spacing = max(4, font_size // 4)
    total_w = max(line_widths)
    total_h = sum(line_heights) + spacing * (len(lines) - 1)

    # Padding around text
    pad = max(8, font_size // 4)
    outline = max(2, font_size // 18)

    img_w = total_w + pad * 2
    img_h = total_h + pad * 2

    img = Image.new("RGBA", (img_w, img_h), (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(img)

    y = pad
    for i, line in enumerate(lines):
        lw, lh = line_widths[i], line_heights[i]
        x = pad + (total_w - lw) // 2

        # Stroke (outline) – draw black text at offsets
        for dx in range(-outline, outline + 1):
            for dy in range(-outline, outline + 1):
                if dx != 0 or dy != 0:
                    rdraw.text((x + dx, y + dy), line, font=font, fill=stroke_color)

        # Fill – draw white text
        rdraw.text((x, y), line, font=font, fill=font_color)

        y += lh + spacing

    return img


# ---------------------------------------------------------------------------
# FFmpeg overlay chain
# ---------------------------------------------------------------------------


def burn_with_png_overlay(
    video_path: str,
    subtitles: List[Tuple[float, float, str]],
    output_path: str,
    font_path: str,
    font_size: int = 48,
    max_text_width: Optional[int] = None,
    margin: int = 60,
    quality: str = "high",
    frame_width: int = 1920,
) -> bool:
    """
    Render each subtitle entry as a transparent PNG, then overlay them
    onto the video via an FFmpeg filter_complex chain.

    Returns True on success.
    """
    if max_text_width is None:
        max_text_width = int(frame_width * 0.85)

    q_presets = {
        "high":   {"crf": "18", "preset": "slow",   "maxrate": "8M", "bufsize": "16M"},
        "medium": {"crf": "23", "preset": "medium", "maxrate": "4M", "bufsize": "8M"},
        "low":    {"crf": "28", "preset": "fast",   "maxrate": "2M", "bufsize": "4M"},
    }
    q = q_presets.get(quality, q_presets["high"])

    tmp_dir = tempfile.mkdtemp(prefix="nova_subs_")
    try:
        # Render all subtitle PNGs
        sub_files: List[Tuple[str, float, float]] = []
        for i, (start, end, text) in enumerate(subtitles):
            img = render_subtitle_text(text, font_path, font_size, max_text_width)
            if img is None:
                print(f"  Skipping subtitle {i} (render failed): {text[:40]}...", file=sys.stderr)
                continue
            png_path = os.path.join(tmp_dir, f"sub_{i:04d}.png")
            img.save(png_path, format="PNG")
            sub_files.append((png_path, start, end))

        if not sub_files:
            print("ERROR: No subtitle images were rendered successfully", file=sys.stderr)
            return False

        # Build FFmpeg command
        ff = shutil.which("ffmpeg") or "ffmpeg"
        cmd = [ff, "-y", "-i", video_path]

        # Add each PNG as an input
        for png_path, _, _ in sub_files:
            cmd += ["-i", png_path]

        # Build overlay filter chain
        filter_parts: List[str] = []
        prev = "0:v"
        n = len(sub_files)
        for i, (_, start, end) in enumerate(sub_files):
            src = f"{i + 1}:v"
            out = f"v{i + 1}" if i < n - 1 else "vfinal"
            filter_parts.append(
                f"[{prev}][{src}]overlay="
                f"x=(W-w)/2:y=H-h-{margin}:"
                f"enable='between(t,{start:.3f},{end:.3f})'"
                f"[{out}]"
            )
            prev = out

        cmd += [
            "-filter_complex", ";".join(filter_parts),
            "-map", "[vfinal]",
            "-map", "0:a?",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", q["crf"],
            "-preset", q["preset"],
            "-maxrate", q["maxrate"],
            "-bufsize", q["bufsize"],
            "-c:a", "copy",
            output_path,
        ]

        r = subprocess.run(cmd, capture_output=True, timeout=900)
        if r.returncode != 0:
            err = r.stderr.decode(errors="replace")
            for line in err.splitlines():
                low = line.lower()
                if "error" in low or "invalid" in low or "cannot" in low:
                    print(f"FFmpeg error: {line.strip()}", file=sys.stderr)
                    break
            print(f"FFmpeg stderr (last 500 chars): {err[-500:]}", file=sys.stderr)
            return False

        return True

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def burn_with_ffmpeg_filter(
    video_path: str,
    srt_path: str,
    output_path: str,
    quality: str = "high",
) -> bool:
    """
    Burn subtitles using FFmpeg's native subtitle filter (libass-based).

    This is simpler but:
      - May not render CJK/subtitles exactly as PIL would
      - Requires libass support in the FFmpeg build
      - Cannot customise font/colour as easily cross-platform
    """
    q_presets = {
        "high":   {"crf": "18", "preset": "slow",   "maxrate": "8M", "bufsize": "16M"},
        "medium": {"crf": "23", "preset": "medium", "maxrate": "4M", "bufsize": "8M"},
        "low":    {"crf": "28", "preset": "fast",   "maxrate": "2M", "bufsize": "4M"},
    }
    q = q_presets.get(quality, q_presets["high"])

    # Escape path for FFmpeg filter (colon/backslash issues on Windows)
    srt_escaped = srt_path.replace(":", "\\:").replace("'", "'\\''")
    if os.name == "nt":
        srt_escaped = srt_path.replace("\\", "/").replace(":", "\\\\:")

    ff = shutil.which("ffmpeg") or "ffmpeg"
    cmd = [
        ff, "-y",
        "-i", video_path,
        "-vf", f"subtitles={srt_escaped}",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", q["crf"],
        "-preset", q["preset"],
        "-maxrate", q["maxrate"],
        "-bufsize", q["bufsize"],
        "-c:a", "copy",
        output_path,
    ]

    try:
        r = subprocess.run(cmd, capture_output=True, timeout=900)
        if r.returncode != 0:
            err = r.stderr.decode(errors="replace")
            for line in err.splitlines():
                if "error" in line.lower():
                    print(f"FFmpeg error: {line.strip()}", file=sys.stderr)
                    break
            print(f"FFmpeg stderr (last 500 chars): {err[-500:]}", file=sys.stderr)
            return False
        return True
    except FileNotFoundError:
        print("ERROR: ffmpeg not found on PATH", file=sys.stderr)
        return False


# ---------------------------------------------------------------------------
# Single-frame burn
# ---------------------------------------------------------------------------


def burn_on_frame(
    frame_path: str,
    subtitles: List[Tuple[float, float, str]],
    output_path: str,
    font_path: str,
    font_size: int = 36,
    max_text_width: Optional[int] = None,
    font_color: str = "white",
    stroke_color: str = "black",
    stroke_width: int = 3,
    y_position_ratio: float = 0.85,
) -> bool:
    """
    Burn subtitles onto a single image frame.

    Useful for testing or thumbnail generation.
    """
    try:
        img = Image.open(frame_path).convert("RGBA")
    except Exception as exc:
        print(f"  Cannot open frame image: {exc}", file=sys.stderr)
        return False

    img_width, img_height = img.size
    if max_text_width is None:
        max_text_width = int(img_width * 0.9)

    try:
        font = ImageFont.truetype(font_path, font_size)
    except Exception:
        print("  Font not available, using default", file=sys.stderr)
        font = ImageFont.load_default()
        font_size = 24

    draw = ImageDraw.Draw(img)
    y_base = int(img_height * y_position_ratio)

    for start_time, end_time, text in subtitles:
        wrapped = wrap_text(text, font, max_text_width, draw)
        lines = wrapped.split("\n")

        line_heights = [
            draw.textbbox((0, 0), ln, font=font)[3] - draw.textbbox((0, 0), ln, font=font)[1]
            for ln in lines
        ]
        spacing = max(4, font_size // 4)
        total_h = sum(line_heights) + spacing * (len(lines) - 1)

        y = y_base - total_h // 2

        for line in lines:
            lw = draw.textbbox((0, 0), line, font=font)[2] - draw.textbbox((0, 0), line, font=font)[0]
            x = (img_width - lw) // 2

            # Stroke
            for ox in range(-stroke_width, stroke_width + 1):
                for oy in range(-stroke_width, stroke_width + 1):
                    if ox != 0 or oy != 0:
                        draw.text((x + ox, y + oy), line, font=font, fill=stroke_color)

            # Fill
            draw.text((x, y), line, font=font, fill=font_color)

            y += line_heights[lines.index(line)] + spacing

    try:
        img.save(output_path)
        return True
    except Exception as exc:
        print(f"  Cannot save output frame: {exc}", file=sys.stderr)
        return False


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    if len(sys.argv) < 4:
        print(
            "Usage: python burn_subs.py <input_video> <srt_file> <output_video> "
            "[--short] [--quality high|medium|low] [--font PATH] [--ffmpeg-filter]",
            file=sys.stderr,
        )
        sys.exit(1)

    input_video = sys.argv[1]
    srt_file = sys.argv[2]
    output_video = sys.argv[3]

    is_short = "--short" in sys.argv
    use_ffmpeg_filter = "--ffmpeg-filter" in sys.argv

    quality = "high"
    for arg in sys.argv:
        if arg.startswith("--quality="):
            quality = arg.split("=", 1)[1]

    font_path_override = None
    for arg in sys.argv:
        if arg.startswith("--font="):
            font_path_override = arg.split("=", 1)[1]

    font_size = 52 if is_short else 48
    frame_width = 1080 if is_short else 1920
    margin = 80 if is_short else 60

    # Resolve font
    font_path = find_font(font_path_override)
    if not font_path:
        print("ERROR: No usable font found. Set NOVA_SUBTITLE_FONT or pass --font=PATH", file=sys.stderr)
        sys.exit(1)

    # Parse SRT
    entries = parse_srt(srt_file)
    if not entries:
        print("ERROR: No valid subtitle entries in SRT file", file=sys.stderr)
        sys.exit(1)

    print(f"  Parsed {len(entries)} subtitle entries", file=sys.stderr)

    if use_ffmpeg_filter:
        # Use FFmpeg's native subtitle filter (simpler, less control)
        success = burn_with_ffmpeg_filter(input_video, srt_file, output_video, quality)
    else:
        # Use PIL-rendered PNGs + FFmpeg overlay (full control)
        success = burn_with_png_overlay(
            video_path=input_video,
            subtitles=entries,
            output_path=output_video,
            font_path=font_path,
            font_size=font_size,
            margin=margin,
            quality=quality,
            frame_width=frame_width,
        )

    if success:
        print(f"OK: burned {len(entries)} subtitles -> {output_video}", file=sys.stderr)
        sys.exit(0)
    else:
        print("FAILED: subtitle burn finished with errors", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
