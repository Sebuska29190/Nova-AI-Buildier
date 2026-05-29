import { spawn } from "node:child_process";
import { readdirSync, writeFileSync, unlinkSync, mkdirSync, existsSync, readFileSync, renameSync, copyFileSync, rmdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { QUALITY_PRESETS, parseTimestamp } from "./types.ts";

const __SDIR = dirname(fileURLToPath(import.meta.url));

function safeMessage(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

function which(cmd: string): string | undefined {
  // Check FFMPEG_PATH env var first (user's custom ffmpeg location)
  const envPath = process.env.FFMPEG_PATH;
  if (envPath && cmd === "ffmpeg") return envPath;
  if (envPath && cmd === "ffprobe") {
    // Derive ffprobe path from ffmpeg path
    const probePath = envPath.replace(/ffmpeg\.exe$/i, "ffprobe.exe").replace(/ffmpeg$/i, "ffprobe");
    if (probePath !== envPath) return probePath;
  }
  try {
    const r = Bun.which(cmd);
    return r || undefined;
  } catch { return undefined; }
}

function runFFmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ff = which("ffmpeg") || "ffmpeg";
    const proc = spawn(ff, args);
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-300)}`)));
    proc.on("error", reject);
  });
}

export async function audioDuration(audioPath: string): Promise<number> {
  const ffprobe = which("ffprobe");
  if (ffprobe) {
    try {
      const dur = await new Promise<number>((resolve) => {
        const proc = spawn(ffprobe, [
          "-v", "error", "-show_entries", "format=duration",
          "-of", "default=noprint_wrappers=1:nokey=1", audioPath,
        ]);
        let out = "";
        proc.stdout?.on("data", (d: Buffer) => { out += d.toString(); });
        proc.on("close", () => {
          const val = parseFloat(out.trim());
          resolve(!isNaN(val) && val > 0 ? val : 120);
        });
        proc.on("error", () => resolve(120));
      });
      if (dur !== 120) return dur;
    } catch {}
  }

  try {
    const ff = which("ffmpeg") || "ffmpeg";
    return await new Promise<number>((resolve) => {
      const proc = spawn(ff, ["-i", audioPath]);
      let stderr = "";
      proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
      proc.on("close", () => {
        const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
        if (m) {
          const h = parseFloat(m[1]), mn = parseFloat(m[2]), s = parseFloat(m[3]);
          const dur = h * 3600 + mn * 60 + s;
          if (dur > 0) resolve(dur);
          else resolve(120);
        }
        resolve(120);
      });
      proc.on("error", () => resolve(120));
    });
  } catch { return 120; }
}

export function ffmpegPath(): string {
  return which("ffmpeg") || "ffmpeg";
}

// ─── Transition helpers ──────────────────────────────────────────
const TRANSITION_MAP: Record<string, string> = {
  "fade": "fade",
  "dissolve": "dissolve",
  "wipe-left": "wipeleft",
  "wipe-right": "wiperight",
  "wipe-up": "wipeup",
  "wipe-down": "wipedown",
  "zoom-in": "smoothup",
  "zoom-out": "smoothdown",
  "blur": "fadeblack",
  "glitch-cut": "fade",
  "light-leak": "dissolve",
};

const TRANSITION_TYPES = Object.keys(TRANSITION_MAP);

function resolveXfadeName(transition: string): string {
  return TRANSITION_MAP[transition] || "fade";
}

/**
 * Chain xfade filters across N clips: [0,1] → out01, [out01,2] → out012, ...
 * Returns { filterComplex, outputLabel } for the final merged stream.
 */
/**
 * Build xfade filter chain. Limits to first MAX_XFADE transitions
 * to avoid excessive FFmpeg processing time. Remaining clips are concatenated.
 */
const MAX_XFADE = 4; // max clips for xfade (3 ops) — more is too slow

function buildXfadeChain(
  clipCount: number,
  clipDurations: number[],
  transitionType: string,
  duration: number,
): { filterComplex: string; outputLabel: string; xfadeCount: number } {
  if (clipCount < 2) return { filterComplex: "", outputLabel: "", xfadeCount: 0 };

  const xfadeName = transitionType === "random" ? "" : resolveXfadeName(transitionType);
  const filters: string[] = [];
  let prevLabel = "[0:v]";

  // Limit: only apply xfade to first MAX_XFADE clips
  const xfadeEnd = Math.min(clipCount, MAX_XFADE);
  let cumulativeTime = 0;

  for (let i = 1; i < xfadeEnd; i++) {
    cumulativeTime += clipDurations[i - 1];
    const offset = Math.max(0, cumulativeTime - duration);
    const transition = transitionType === "random"
      ? resolveXfadeName(TRANSITION_TYPES[Math.floor(Math.random() * TRANSITION_TYPES.length)])
      : xfadeName;
    const outLabel = `[vout${i}]`;
    filters.push(`${prevLabel}[${i}:v]xfade=transition=${transition}:duration=${duration.toFixed(2)}:offset=${offset.toFixed(2)}${outLabel}`);
    prevLabel = outLabel;
  }

  return { filterComplex: filters.join(";"), outputLabel: prevLabel, xfadeCount: xfadeEnd - 1 };
}

async function applyTransitions(
  clipFiles: string[],
  clipDurations: number[],
  audioFile: string,
  outputFile: string,
  transitionType: string,
  transitionDuration: number,
  quality: { crf: string; preset: string; maxrate: string; bufsize: string },
  fps: number,
): Promise<boolean> {
  if (clipFiles.length < 2) return false;

  const { filterComplex, outputLabel, xfadeCount } = buildXfadeChain(clipFiles.length, clipDurations, transitionType, transitionDuration);
  if (!filterComplex) return false;

  console.log(`[transitions] ${xfadeCount} xfade ops on first ${xfadeCount + 1} clips, rest concatenated`);

  const tmpVideo = outputFile.replace(".mp4", "_xfade.mp4");
  try {
    if (xfadeCount < clipFiles.length - 1) {
      // Mixed approach: xfade first N clips, concat the rest
      // Step 1: xfade the first batch
      const xfadeInputArgs: string[] = [];
      for (let i = 0; i <= xfadeCount; i++) xfadeInputArgs.push("-i", clipFiles[i]);
      const xfadeTmp = outputFile.replace(".mp4", "_xfade_batch.mp4");
      await runFFmpeg([
        "-y", ...xfadeInputArgs,
        "-filter_complex", filterComplex,
        "-map", outputLabel, "-an",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
        "-crf", quality.crf, "-preset", quality.preset,
        "-maxrate", quality.maxrate, "-bufsize", quality.bufsize,
        xfadeTmp,
      ]);

      // Step 2: concat xfade result + remaining clips
      const concatList = outputFile.replace(".mp4", "_concat.txt");
      const concatEntries = [xfadeTmp, ...clipFiles.slice(xfadeCount + 1)];
      writeFileSync(concatList, concatEntries.map(p => `file '${p}'`).join("\n"));
      await runFFmpeg([
        "-y", "-f", "concat", "-safe", "0", "-i", concatList, "-i", audioFile,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
        "-crf", quality.crf, "-preset", quality.preset,
        "-maxrate", quality.maxrate, "-bufsize", quality.bufsize,
        "-c:a", "aac", "-b:a", "192k", "-shortest",
        outputFile,
      ]);
      try { unlinkSync(xfadeTmp); } catch {}
      try { unlinkSync(concatList); } catch {}
    } else {
      // All clips get xfade (small count)
      const inputArgs: string[] = [];
      for (const cf of clipFiles) inputArgs.push("-i", cf);
      await runFFmpeg([
        "-y", ...inputArgs,
        "-filter_complex", filterComplex,
        "-map", outputLabel, "-an",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
        "-crf", quality.crf, "-preset", quality.preset,
        "-maxrate", quality.maxrate, "-bufsize", quality.bufsize,
        tmpVideo,
      ]);
      await runFFmpeg([
        "-y", "-i", tmpVideo, "-i", audioFile,
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
        outputFile,
      ]);
      try { unlinkSync(tmpVideo); } catch {}
    }

    return existsSync(outputFile);
  } catch (e) {
    console.warn(`[transitions] xfade failed, falling back to concat: ${safeMessage(e)}`);
    try { unlinkSync(tmpVideo); } catch {}
    return false;
  }
}

export async function createVideo(
  imagesDir: string,
  audioFile: string,
  outputFile: string,
  srtFile?: string,
  imageTimestamps?: Array<{ seconds: number | null }>,
  isShort = false,
  quality = "medium",
  animationStyle = "ken-burns",
  effects?: string,
  transition?: string,
  transitionDuration?: number,
  subtitleAnimation?: string,
  composition?: string,
  useVideoClips = false,
): Promise<boolean> {
  const ff = ffmpegPath();
  const duration = await audioDuration(audioFile);
  const resW = isShort ? 1080 : 1920;
  const resH = isShort ? 1920 : 1080;
  const fps = 30;
  const q = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;

  // Scan for video clips or images
  const clipScan = readdirSync(imagesDir)
    .filter((f) => /^clip_\d+\.mp4$/i.test(f))
    .sort();
  const images = readdirSync(imagesDir)
    .filter((f) => /^img_\d+\.(png|jpg|jpeg)$/i.test(f))
    .sort();

  if (useVideoClips && clipScan.length > 0) {
    // ── Video clip mode: trim, mute, normalize each clip ──
    return await assembleVideoClips(imagesDir, clipScan, audioFile, outputFile, srtFile, imageTimestamps, isShort, quality, effects, transition, transitionDuration, subtitleAnimation, composition, fps, resW, resH, q, duration);
  }

  if (images.length === 0) return false;

  // Compute per-image durations
  let durations: number[] = [];
  if (imageTimestamps && imageTimestamps.length === images.length) {
    const startTimes = imageTimestamps.map((ts) => ts.seconds || 0);
    let maxTs = Math.max(...startTimes);
    if (maxTs > 0 && (maxTs > duration * 0.9 || maxTs < duration * 0.5)) {
      const scale = (duration * 0.85) / maxTs;
      for (let i = 0; i < startTimes.length; i++) startTimes[i] *= scale;
    }
    for (let i = 0; i < startTimes.length; i++) {
      const nxt = i + 1 < startTimes.length ? startTimes[i + 1] : duration;
      let dur = Math.max(4, Math.min(nxt - startTimes[i], duration - startTimes[i]));
      if (i === startTimes.length - 1) dur = Math.max(dur, duration - startTimes[i]);
      durations.push(dur);
    }
    const total = durations.reduce((a, b) => a + b, 0);
    // Ensure video doesn't exceed audio duration
    if (total > duration + 0.5) {
      // Scale down all durations proportionally
      const scale = duration / total;
      durations = durations.map(d => d * scale);
    }
  } else {
    const durEach = duration / images.length;
    durations = images.map(() => durEach);
  }
  durations[durations.length - 1] = Math.min(durations[durations.length - 1] + 2, duration); // hold last frame but never exceed audio

  // Generate animated clips with user-chosen animation style
  const clipFiles: string[] = [];
  // For "random" style: pre-assign a different style per image
  const RANDOM_STYLES = ["ken-burns", "zoom", "fade", "slide", "cinematic-zoom", "parallax", "blur-zoom", "dolly-zoom", "sway", "pulse", "cinematic-pan"];
  const actualStyle = animationStyle === "random"
    ? (() => { const r: string[] = []; for (let i = 0; i < images.length; i++) r.push(RANDOM_STYLES[i % RANDOM_STYLES.length]); return r; })()
    : null;
  for (let i = 0; i < images.length; i++) {
    const dFrames = Math.max(1, Math.floor(durations[i] * fps));
    const clipPath = join(imagesDir, `clip_${String(i).padStart(3, "0")}.mp4`);
    const imgPath = join(imagesDir, images[i]);

    // Build filter based on animation style
    const animForThis = actualStyle ? actualStyle[i] : animationStyle;
    let vf: string;
    const scalePad = `scale=${resW}:${resH}:force_original_aspect_ratio=decrease,pad=${resW}:${resH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;

    switch (animForThis) {
      case "zoom":
        vf = `${scalePad},zoompan=z='min(zoom+${(0.5 / dFrames).toFixed(6)},1.5)':d=${dFrames}:s=${resW}x${resH}`;
        break;
      case "fade":
        vf = `${scalePad},fade=in:0:30,fade=out:${dFrames - 30}:30`;
        break;
      case "slide": {
        const slideOff = Math.floor((resW * 0.1) * i / Math.max(1, images.length));
        vf = `scale=${resW * 1.1}:${resH}:force_original_aspect_ratio=increase,setpts=PTS-STARTPTS,${scalePad},crop=${resW}:${resH}:${slideOff}:0`;
        break;
      }
      case "none":
        vf = scalePad;
        break;
      case "cinematic-zoom":
        vf = `${scalePad},zoompan=z='if(eq(on,1),1,min(zoom+${(0.15 / dFrames).toFixed(6)},1.2))':d=${dFrames}:s=${resW}x${resH}:fps=${fps},gblur=sigma=0.3`;
        break;
      case "parallax":
        vf = `scale=${resW * 1.15}:${resH}:force_original_aspect_ratio=increase,setpts=PTS-STARTPTS,${scalePad},crop=${resW}:${resH}:'${Math.floor((i % 3) * 0.03 * resW)}':0`;
        break;
      case "whip-pan":
        if (i > 0) {
          vf = `${scalePad},zoompan=z='1+${(0.6 / dFrames).toFixed(6)}*on':d=${dFrames}:s=${resW}x${resH}`;
        } else {
          vf = `${scalePad},zoompan=z='1+${(0.2 / dFrames).toFixed(6)}*on':d=${dFrames}:s=${resW}x${resH}`;
        }
        break;
      case "blur-zoom":
        vf = `${scalePad},zoompan=z='1+${(0.5 / dFrames).toFixed(6)}*on':d=${dFrames}:s=${resW}x${resH},boxblur=2:1:enable='between(t,0,0.4)+between(t,${(durations[i] - 0.5).toFixed(1)},${durations[i]})'`;
        break;
      case "dolly-zoom":
        // Hitchcock effect: zoom in while pulling back (inverse zoom + scale)
        vf = `${scalePad},zoompan=z='if(eq(on,1),1.5,max(1.5-${(0.8 / dFrames).toFixed(6)}*on,0.8))':d=${dFrames}:s=${resW}x${resH}`;
        break;
      case "sway":
        // Gentle handheld sway via sinusoidal X offset in crop
        vf = `scale=${resW * 1.08}:${resH}:force_original_aspect_ratio=increase,setpts=PTS-STARTPTS,${scalePad},crop=${resW}:${resH}:'${resW * 0.04}+${resW * 0.02}*sin(2*PI*t/3)':0`;
        break;
      case "parallax-deep":
        // Deep parallax: scale up more + shift based on index for multi-plane feel
        vf = `scale=${resW * 1.25}:${resH}:force_original_aspect_ratio=increase,setpts=PTS-STARTPTS,${scalePad},crop=${resW}:${resH}:'${Math.floor((i % 4) * 0.04 * resW)}+${Math.floor(0.02 * resW)}*sin(2*PI*t/4)':0`;
        break;
      case "pulse":
        // Pulsating zoom (sinusoidal)
        vf = `${scalePad},zoompan=z='1+0.15*sin(2*PI*t/${Math.max(2, durations[i] / 2).toFixed(1)})':d=${dFrames}:s=${resW}x${resH}`;
        break;
      case "rotate-zoom":
        // Slow rotation + zoom (spiral effect)
        vf = `${scalePad},zoompan=z='1+${(0.3 / dFrames).toFixed(6)}*on':d=${dFrames}:s=${resW}x${resH}:x='iw/2-(iw/zoom/2)+${(20 / dFrames).toFixed(6)}*on':y='ih/2-(ih/zoom/2)'`;
        break;
      case "shake":
        // Camera shake simulation via random X/Y crop offset per frame
        vf = `scale=${resW * 1.1}:${resH * 1.1}:force_original_aspect_ratio=increase,setpts=PTS-STARTPTS,${scalePad},crop=${resW}:${resH}:'${resW * 0.05}+${resW * 0.015}*random(1)':('${resH * 0.05}+${resH * 0.01}*random(2)')`;
        break;
      case "cinematic-pan":
        // Slow left-to-right pan
        vf = `scale=${resW * 1.2}:${resH}:force_original_aspect_ratio=increase,setpts=PTS-STARTPTS,${scalePad},crop=${resW}:${resH}:'(${resW * 0.2})*t/${durations[i].toFixed(1)}':0`;
        break;
      default: // ken-burns
        const startZoom = (i % 2 === 0) ? 1.0 : 1.3;
        vf = `${scalePad},zoompan=z='${startZoom}+${(0.4 / dFrames).toFixed(6)}*on':d=${dFrames}:s=${resW}x${resH}`;
        break;
    }

    try {
      await runFFmpeg(["-y", "-loop", "1", "-i", imgPath, "-vf", vf,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
        "-t", String(durations[i]),
        "-crf", q.crf, "-preset", q.preset, "-maxrate", q.maxrate, "-bufsize", q.bufsize,
        "-an", clipPath]);
      clipFiles.push(clipPath);
    } catch (e) { console.warn(`[clip ${i}] FFmpeg failed: ${safeMessage(e)}`); }
  }

  if (clipFiles.length === 0) return false;

  if (clipFiles.length === 0) return false;

  const hasSrt = Boolean(srtFile && srtFile.trim() && existsSync(srtFile));
  const hasEffects = Boolean(effects && effects.trim());
  const hasTransitions = Boolean(transition && transition !== "cut" && clipFiles.length > 1);
  const baseVideo = (hasSrt || hasEffects) ? outputFile.replace(".mp4", "_base.mp4") : outputFile;

  try {
  // Apply transitions or simple concat
  let usedTransitions = false;
  if (hasTransitions && clipFiles.length <= 4) {
    console.log(`[transitions] Applying: ${transition} (${transitionDuration || 0.5}s)`);
    const minClipDur = Math.min(...durations);
    const td = Math.min(1.5, Math.max(0.3, transitionDuration || 0.5, minClipDur * 0.4));
    usedTransitions = await applyTransitions(clipFiles, durations, audioFile, baseVideo, transition!, td, q, fps);
    if (!usedTransitions) console.log(`[transitions] xfade failed, falling back to concat`);
  } else if (hasTransitions) {
    console.log(`[transitions] Skipped: ${clipFiles.length} clips > 4 (xfade too slow)`);
  }

  if (!usedTransitions) {
    // Simple concat (default fallback)
    const concatList = join(imagesDir, "clips.txt");
    writeFileSync(concatList, clipFiles.map((p) => `file '${p}'`).join("\n"));
    const baseCmd = ["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-i", audioFile];
    await runFFmpeg([...baseCmd, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
      "-crf", q.crf, "-preset", q.preset, "-maxrate", q.maxrate, "-bufsize", q.bufsize,
      "-c:a", "aac", "-b:a", "192k", "-shortest",
      hasSrt || hasEffects ? baseVideo : outputFile]);
    try { unlinkSync(concatList); } catch {}
  }

  let currentVideo = baseVideo;

  // Step 2: Apply visual effects
  if (hasEffects) {
    const effectList = effects.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (effectList.length > 0) {
      console.log(`[effects] Applying: ${effectList.join(", ")}`);
      const fxFilters = buildEffectsFilter(effectList, isShort);
      if (fxFilters) {
        const withFxFile = outputFile.replace(".mp4", "_fx.mp4");
        await runFFmpeg(["-y", "-i", currentVideo, "-vf", fxFilters,
          "-c:v", "libx264", "-pix_fmt", "yuv420p",
          "-crf", q.crf, "-preset", q.preset,
          "-c:a", "copy", withFxFile]);
        try { unlinkSync(currentVideo); } catch {}
        currentVideo = withFxFile;
      }
    }
  }

  // Step 3: Composition mode (PiP, split-screen, grid)
  const hasComposition = Boolean(composition && composition !== "single");
  if (hasComposition) {
    console.log(`[composition] Applying: ${composition}`);
    const compFile = outputFile.replace(".mp4", "_comp.mp4");
    const compOk = await applyComposition(currentVideo, compFile, composition!, q, fps);
    if (compOk) {
      try { unlinkSync(currentVideo); } catch {}
      currentVideo = compFile;
    }
  }

  // Step 4: Burn subtitles LAST
  if (hasSrt) {
    try {
      await burnSubtitles(currentVideo, outputFile, srtFile!, isShort, quality, subtitleAnimation);
      try { unlinkSync(currentVideo); } catch {}
    } catch (subErr) {
      console.warn(`[burnSubtitles] failed, falling back to no subtitles: ${subErr instanceof Error ? subErr.message : subErr}`);
      copyFileSync(currentVideo, outputFile);
      try { unlinkSync(currentVideo); } catch {}
    }
  } else if (hasEffects || hasComposition) {
    copyFileSync(currentVideo, outputFile);
    try { unlinkSync(currentVideo); } catch {}
  }
  } catch (e) {
    console.warn(`[assembly] failed: ${safeMessage(e)}`);
  }

  // Cleanup clips
  for (const cp of clipFiles) try { unlinkSync(cp); } catch {}
  try { unlinkSync(concatList); } catch {}

  return existsSync(outputFile);
}

// ─── Composition modes ───────────────────────────────────────────
async function applyComposition(
  inputVideo: string,
  outputVideo: string,
  mode: string,
  q: { crf: string; preset: string; maxrate: string; bufsize: string },
  fps: number,
): Promise<boolean> {
  const ff = ffmpegPath();
  let filter = "";

  switch (mode) {
    case "picture-in-picture": {
      // Main video + small pip in bottom-right corner (30% size)
      filter = "[0:v]split[main][pip];" +
        "[pip]scale=iw*0.3:ih*0.3[pip_small];" +
        "[main][pip_small]overlay=W-w-20:H-h-20[out]";
      break;
    }
    case "split-screen": {
      // Left half: original, Right half: same video delayed by 0.5s
      filter = "[0:v]split[a][b];" +
        "[a]crop=iw/2:ih:0:0[left];" +
        "[b]crop=iw/2:ih:iw/2:0,setpts=PTS+0.5/TB[right];" +
        "[left][right]hstack[out]";
      break;
    }
    case "grid": {
      // 2x2 grid: same video with different time offsets
      filter = "[0:v]split[a][b][c][d];" +
        "[a]crop=iw/2:ih/2:0:0[a1];" +
        "[b]crop=iw/2:ih/2:iw/2:0,setpts=PTS+0.3/TB[b1];" +
        "[c]crop=iw/2:ih/2:0:ih/2,setpts=PTS+0.6/TB[c1];" +
        "[d]crop=iw/2:ih/2:iw/2:ih/2,setpts=PTS+0.9/TB[d1];" +
        "[a1][b1]hstack[top];" +
        "[c1][d1]hstack[bottom];" +
        "[top][bottom]vstack[out]";
      break;
    }
    default:
      return false;
  }

  if (!filter) return false;

  try {
    await runFFmpeg([
      "-y", "-i", inputVideo,
      "-filter_complex", filter,
      "-map", "[out]",
      "-map", "0:a?",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
      "-crf", q.crf, "-preset", q.preset,
      "-maxrate", q.maxrate, "-bufsize", q.bufsize,
      "-c:a", "copy",
      outputVideo,
    ]);
    return existsSync(outputVideo);
  } catch (e) {
    console.warn(`[composition] failed: ${safeMessage(e)}`);
    return false;
  }
}

/**
 * Assemble pre-downloaded video clips into final video.
 * Each clip is trimmed, muted, and normalized to target resolution.
 */
async function assembleVideoClips(
  workDir: string,
  clipFiles: string[],
  audioFile: string,
  outputFile: string,
  srtFile: string | undefined,
  imageTimestamps: Array<{ seconds: number | null }> | undefined,
  isShort: boolean,
  quality: string,
  effects: string | undefined,
  transition: string | undefined,
  transitionDuration: number | undefined,
  subtitleAnimation: string | undefined,
  composition: string | undefined,
  fps: number,
  resW: number,
  resH: number,
  q: { crf: string; preset: string; maxrate: string; bufsize: string },
  totalDuration: number,
): Promise<boolean> {
  // Compute per-clip durations
  let durations: number[] = [];
  if (imageTimestamps && imageTimestamps.length === clipFiles.length) {
    const startTimes = imageTimestamps.map((ts) => ts.seconds || 0);
    let maxTs = Math.max(...startTimes);
    if (maxTs > 0 && (maxTs > totalDuration * 0.9 || maxTs < totalDuration * 0.5)) {
      const scale = (totalDuration * 0.85) / maxTs;
      for (let i = 0; i < startTimes.length; i++) startTimes[i] *= scale;
    }
    for (let i = 0; i < startTimes.length; i++) {
      const nxt = i + 1 < startTimes.length ? startTimes[i + 1] : totalDuration;
      let dur = Math.max(3, Math.min(nxt - startTimes[i], totalDuration - startTimes[i]));
      if (i === startTimes.length - 1) dur = Math.max(dur, totalDuration - startTimes[i]);
      durations.push(dur);
    }
    const total = durations.reduce((a, b) => a + b, 0);
    if (total > totalDuration + 0.5) {
      const scale = totalDuration / total;
      durations = durations.map(d => d * scale);
    }
  } else {
    const durEach = totalDuration / clipFiles.length;
    durations = clipFiles.map(() => durEach);
  }

  // Trim or extend each clip to match target duration, mute, normalize
  const processedClips: string[] = [];
  for (let i = 0; i < clipFiles.length; i++) {
    const srcPath = join(workDir, clipFiles[i]);
    const outPath = join(workDir, `proc_${String(i).padStart(3, "0")}.mp4`);
    const d = durations[i];

    // Get source clip duration
    let srcDur = 0;
    try {
      const probe = which("ffprobe");
      if (probe) {
        srcDur = await new Promise<number>((resolve) => {
          const proc = spawn(probe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", srcPath]);
          let out = "";
          proc.stdout?.on("data", (buf: Buffer) => { out += buf.toString(); });
          proc.on("close", () => resolve(parseFloat(out.trim()) || 0));
          proc.on("error", () => resolve(0));
        });
      }
    } catch {}

    try {
      const scalePad = `scale=${resW}:${resH}:force_original_aspect_ratio=decrease,pad=${resW}:${resH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p,setsar=1`;

      if (srcDur > 0 && srcDur > d + 1) {
        // Source is longer than target: seek to random start point and trim
        const maxStart = Math.max(0, srcDur - d - 1);
        const seek = Math.random() * maxStart;
        console.log(`[video-clip ${i}] Source ${srcDur.toFixed(1)}s > target ${d.toFixed(1)}s, seek ${seek.toFixed(1)}s`);
        await runFFmpeg([
          "-y", "-ss", seek.toFixed(2), "-i", srcPath,
          "-t", String(d),
          "-vf", scalePad,
          "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
          "-crf", q.crf, "-preset", q.preset, "-maxrate", q.maxrate, "-bufsize", q.bufsize,
          outPath,
        ]);
      } else if (srcDur > 0 && srcDur < d - 1) {
        // Source is shorter than target: freeze last frame to fill duration
        const padDur = d - srcDur;
        console.log(`[video-clip ${i}] Source ${srcDur.toFixed(1)}s < target ${d.toFixed(1)}s, freezing last frame +${padDur.toFixed(1)}s`);
        await runFFmpeg([
          "-y", "-i", srcPath,
          "-vf", `${scalePad},tpad=stop_mode=clone:stop_duration=${padDur.toFixed(1)}`,
          "-t", String(d),
          "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
          "-crf", q.crf, "-preset", q.preset, "-maxrate", q.maxrate, "-bufsize", q.bufsize,
          outPath,
        ]);
      } else {
        // Source is close to target: just normalize
        console.log(`[video-clip ${i}] Source ${srcDur.toFixed(1)}s ≈ target ${d.toFixed(1)}s, normalizing`);
        await runFFmpeg([
          "-y", "-i", srcPath,
          "-t", String(d),
          "-vf", scalePad,
          "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
          "-crf", q.crf, "-preset", q.preset, "-maxrate", q.maxrate, "-bufsize", q.bufsize,
          outPath,
        ]);
      }

      if (existsSync(outPath)) {
        processedClips.push(outPath);
      }
    } catch (e) {
      console.warn(`[video-clip ${i}] Failed to process: ${safeMessage(e)}`);
    }
  }

  if (processedClips.length === 0) return false;

  const hasSrt = Boolean(srtFile && srtFile.trim() && existsSync(srtFile));
  const hasEffects = Boolean(effects && effects.trim());
  const hasTransitions = Boolean(transition && transition !== "cut" && processedClips.length > 1);
  const baseVideo = (hasSrt || hasEffects) ? outputFile.replace(".mp4", "_base.mp4") : outputFile;

  try {
    // Apply transitions or simple concat
    let usedTransitions = false;
    if (hasTransitions && processedClips.length <= 4) {
      console.log(`[transitions] Applying: ${transition} (${transitionDuration || 0.5}s)`);
      const minClipDur = Math.min(...durations);
      const td = Math.min(1.5, Math.max(0.3, transitionDuration || 0.5, minClipDur * 0.4));
      usedTransitions = await applyTransitions(processedClips, durations, audioFile, baseVideo, transition!, td, q, fps);
      if (!usedTransitions) console.log(`[transitions] xfade failed, falling back to concat`);
    }

    if (!usedTransitions) {
      const concatList = join(workDir, "clips_concat.txt");
      writeFileSync(concatList, processedClips.map((p) => `file '${p}'`).join("\n"));
      await runFFmpeg([
        "-y", "-f", "concat", "-safe", "0", "-i", concatList, "-i", audioFile,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
        "-crf", q.crf, "-preset", q.preset, "-maxrate", q.maxrate, "-bufsize", q.bufsize,
        "-c:a", "aac", "-b:a", "192k", "-shortest",
        hasSrt || hasEffects ? baseVideo : outputFile,
      ]);
      try { unlinkSync(concatList); } catch {}
    }

    let currentVideo = baseVideo;

    // Apply visual effects
    if (hasEffects) {
      const effectList = effects.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
      if (effectList.length > 0) {
        console.log(`[effects] Applying: ${effectList.join(", ")}`);
        const fxFilters = buildEffectsFilter(effectList, isShort);
        if (fxFilters) {
          const withFxFile = outputFile.replace(".mp4", "_fx.mp4");
          await runFFmpeg(["-y", "-i", currentVideo, "-vf", fxFilters,
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-crf", q.crf, "-preset", q.preset,
            "-c:a", "copy", withFxFile]);
          try { unlinkSync(currentVideo); } catch {}
          currentVideo = withFxFile;
        }
      }
    }

    // Composition mode
    const hasComposition = Boolean(composition && composition !== "single");
    if (hasComposition) {
      console.log(`[composition] Applying: ${composition}`);
      const compFile = outputFile.replace(".mp4", "_comp.mp4");
      const compOk = await applyComposition(currentVideo, compFile, composition!, q, fps);
      if (compOk) {
        try { unlinkSync(currentVideo); } catch {}
        currentVideo = compFile;
      }
    }

    // Burn subtitles
    if (hasSrt) {
      try {
        await burnSubtitles(currentVideo, outputFile, srtFile!, isShort, quality, subtitleAnimation);
        try { unlinkSync(currentVideo); } catch {}
      } catch (subErr) {
        console.warn(`[burnSubtitles] failed: ${subErr instanceof Error ? subErr.message : subErr}`);
        copyFileSync(currentVideo, outputFile);
        try { unlinkSync(currentVideo); } catch {}
      }
    } else if (hasEffects || hasComposition) {
      copyFileSync(currentVideo, outputFile);
      try { unlinkSync(currentVideo); } catch {}
    }
  } catch (e) {
    console.warn(`[assembly] video clips failed: ${safeMessage(e)}`);
  }

  // Cleanup processed clips
  for (const cp of processedClips) try { unlinkSync(cp); } catch {}

  return existsSync(outputFile);
}

export async function burnSubtitles(inputVideo: string, outputVideo: string, srtFile: string, isShort = false, quality = "medium", subtitleAnimation?: string): Promise<void> {
  // Use Python PIL + FFmpeg overlay (avoids all drawtext escaping issues)
  const pyScript = join(__SDIR, "burn_subs.py");
  if (!existsSync(pyScript)) throw new Error("burn_subs.py not found");

  const args = [pyScript, inputVideo, srtFile, outputVideo];
  if (isShort) args.push("--short");
  args.push(`--quality=${quality}`);
  if (subtitleAnimation && subtitleAnimation !== "static") {
    args.push(`--animation=${subtitleAnimation}`);
  }

  const proc = spawn("python", args);
  let stderr = "";
  proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

  return new Promise((resolve, reject) => {
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`burn_subs failed (${code}): ${stderr.slice(-500)}`));
    });
    proc.on("error", (e) => reject(new Error(`burn_subs spawn error: ${e.message}`)));
  });
}

function parseSrt(content: string): Array<[number, number, string]> {
  const entries: Array<[number, number, string]> = [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;

    // Find timestamp line
    let tsLine = "";
    let textStart = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) { tsLine = lines[i]; textStart = i + 1; break; }
    }
    if (!tsLine) continue;

    const m = tsLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!m) continue;

    const start = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 1000;
    const end = parseInt(m[5]) * 3600 + parseInt(m[6]) * 60 + parseInt(m[7]) + parseInt(m[8]) / 1000;
    const text = lines.slice(textStart).join(" ").replace(/<[^>]+>/g, "").trim();

    if (text) entries.push([start, end, text]);
  }

  return entries;
}

// ─── Visual Effects Filter Builder ────────────────────────────────
function buildEffectsFilter(effects: string[], isShort: boolean): string | null {
  const filters: string[] = [];
  for (const fx of effects) {
    switch (fx) {
      case "vignette":
        filters.push("vignette=PI/4");
        break;
      case "glitch":
        filters.push("geq=r='if(lt(random(1),0.03),255,r(X,Y))':g='if(lt(random(1),0.03),255,g(X,Y))':b='if(lt(random(1),0.03),255,b(X,Y))'");
        break;
      case "vhs":
        filters.push("hue=H=0.02*sin(2*PI*t/5):s=1.3,eq=saturation=1.8:contrast=1.1");
        break;
      case "grain":
        filters.push("noise=alls=8:allf=t+u,scale=iw:ih:flags=lanczos");
        break;
      case "bloom":
        filters.push("split[original],[original]gblur=sigma=8[blurred],[original][blurred]blend=all_mode=screen:all_opacity=0.3");
        break;
      case "sepia":
        filters.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131");
        break;
      case "invert":
        filters.push("negate");
        break;
      case "color_shift":
        filters.push("hue=H=0.1*sin(2*PI*t/3)");
        break;
      case "pixelate":
        filters.push("scale=iw/8:ih/8:flags=neighbor,scale=iw*8:ih*8:flags=neighbor");
        break;
      case "lens_flare":
        // Simulate lens flare with bright spot overlay
        filters.push("split[orig],[orig]geq=r='clip(r(X,Y)+80*sin(PI*X/iw)*cos(PI*Y/ih),0,255)':g='clip(g(X,Y)+40*sin(PI*X/iw)*cos(PI*Y/ih),0,255)':b='clip(b(X,Y)+20*sin(PI*X/iw)*cos(PI*Y/ih),0,255)'[flare],[orig][flare]blend=all_mode=screen:all_opacity=0.25");
        break;
      case "light_leak":
        // Warm light leak overlay with animated hue
        filters.push("split[orig],[orig]geq=r='clip(r(X,Y)+120*pow(sin(PI*X/iw+PI*t/4),2)*pow(cos(PI*Y/ih),2),0,255)':g='clip(g(X,Y)+50*pow(sin(PI*X/iw+PI*t/4),2)*pow(cos(PI*Y/ih),2),0,255)':b='clip(b(X,Y)+10*pow(sin(PI*X/iw+PI*t/4),2)*pow(cos(PI*Y/ih),2),0,255)'[leak],[orig][leak]blend=all_mode=screen:all_opacity=0.35");
        break;
      case "bokeh":
        // Bokeh effect: blurred bright spots overlay
        filters.push("split[orig],[orig]gblur=sigma=12,eq=brightness=0.15[blur],[orig][blur]blend=all_mode=screen:all_opacity=0.2");
        break;
      case "chromatic_aberration":
        // Chromatic aberration: slight R/B channel offset
        filters.push("rgbashift=rh=-3:bh=3:rv=0:bv=0");
        break;
      case "film_burn":
        // Film burn: red gradient on edges
        filters.push("geq=r='clip(r(X,Y)+60*gt(X,iw*0.85)+60*lt(X,iw*0.15),0,255)':g='clip(g(X,Y)-20*gt(X,iw*0.85)-20*lt(X,iw*0.15),0,255)':b='clip(b(X,Y)-30*gt(X,iw*0.85)-30*lt(X,iw*0.15),0,255)'");
        break;
      case "speed_ramp":
        // Speed ramp: slow→fast→slow within clip
        filters.push("setpts='if(between(T,0,1),PTS*2,between(T,1,3),PTS*0.5,PTS*1.5)'");
        break;
      case "mirror":
        // Mirror effect: horizontal flip + blend
        filters.push("hflip");
        break;
      case "thermal":
        // Thermal vision
        filters.push("colorscale=thermal");
        break;
      case "neon_glow":
        // Neon glow: high contrast + colorize
        filters.push("eq=contrast=1.8:brightness=0.1,colorize=0.3:0.5:0.8");
        break;
      default:
        break;
    }
  }
  return filters.length > 0 ? filters.join(",") : null;
}

const FONT_CACHE = join(Bun.env.HOME || Bun.env.USERPROFILE || "~", ".nova", "fonts");

async function getSubtitleFont(): Promise<string | undefined> {
  mkdirSync(FONT_CACHE, { recursive: true });

  const sources: Array<[string, string]> = [
    ["NotoSansSC-Regular.ttf", "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansSC/NotoSansSC-Regular.ttf"],
  ];

  // Check cache
  for (const [fname] of sources) {
    const cached = join(FONT_CACHE, fname);
    if (existsSync(cached) && readFileSync(cached).length > 100000) return cached;
  }

  // Download
  for (const [fname, url] of sources) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 100000) {
          writeFileSync(join(FONT_CACHE, fname), Buffer.from(buf));
          return join(FONT_CACHE, fname);
        }
      }
    } catch {}
  }

  // Try system font
  const possibleFonts = [
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Helvetica.ttf",
  ];
  for (const fp of possibleFonts) {
    if (existsSync(fp)) return fp;
  }

  return undefined;
}
