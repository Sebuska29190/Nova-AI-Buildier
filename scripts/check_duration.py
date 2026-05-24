#!/usr/bin/env python3
"""Diagnostic tool: measure actual audio duration of a file using FFMPEG_PATH."""
import os, subprocess, re, sys

ffmpeg = os.environ.get("FFMPEG_PATH", "ffmpeg")

def get_duration(filepath: str) -> float:
    """Get audio duration using ffmpeg."""
    try:
        result = subprocess.run(
            [ffmpeg, "-i", filepath, "-f", "null", "-"],
            capture_output=True, text=True, timeout=10
        )
        stderr = result.stderr
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+)\.?(\d*)", stderr)
        if m:
            h, mn, s, ms = int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4) or "0"
            ms = int(ms.ljust(3, "0")[:3]) if ms else 0
            return h * 3600 + mn * 60 + s + ms / 1000
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
    return -1

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_duration.py <file.mp3>")
        print("FFMPEG_PATH:", ffmpeg)
        sys.exit(1)
    
    path = sys.argv[1]
    if not os.path.exists(path):
        print(f"File not found: {path}")
        sys.exit(1)
    
    dur = get_duration(path)
    if dur > 0:
        print(f"✅ Duration: {dur:.1f}s ({int(dur//60)}:{int(dur%60):02d})")
    else:
        print(f"❌ Failed to get duration for: {path}")
        print(f"   ffmpeg used: {ffmpeg}")
