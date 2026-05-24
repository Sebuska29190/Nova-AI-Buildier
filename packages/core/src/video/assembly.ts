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

export async function createVideo(
  imagesDir: string,
  audioFile: string,
  outputFile: string,
  srtFile?: string,
  imageTimestamps?: Array<{ seconds: number | null }>,
  isShort = false,
  quality = "medium",
  animationStyle = "ken-burns",
  effects?: string,  // comma-separated: "vignette,glitch,vhs,grain,bloom"
): Promise<boolean> {
  const ff = ffmpegPath();
  const duration = await audioDuration(audioFile);
  const resW = isShort ? 1080 : 1920;
  const resH = isShort ? 1920 : 1080;
  const fps = 30;
  const q = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;

  // Scan images
  const images = readdirSync(imagesDir)
    .filter((f) => /^img_\d+\.(png|jpg|jpeg)$/i.test(f))
    .sort();

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
  const RANDOM_STYLES = ["ken-burns", "zoom", "fade", "slide", "cinematic-zoom", "parallax", "blur-zoom"];
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

  // Concat clips
  const concatList = join(imagesDir, "clips.txt");
  writeFileSync(concatList, clipFiles.map((p) => `file '${p}'`).join("\n"));

  const baseCmd = ["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-i", audioFile];
  const hasSrt = Boolean(srtFile && existsSync(srtFile));
  const hasEffects = Boolean(effects && effects.trim());

  try {
    // Step 1: Assemble base video (images + audio) without subtitles
    const baseVideo = (hasSrt || hasEffects) ? outputFile.replace(".mp4", "_base.mp4") : outputFile;

    if (hasSrt || hasEffects) {
      await runFFmpeg([...baseCmd, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
        "-crf", q.crf, "-preset", q.preset, "-maxrate", q.maxrate, "-bufsize", q.bufsize,
        "-c:a", "aac", "-b:a", "192k", "-shortest", baseVideo]);
    } else {
      // No subtitles and no effects — direct output
      await runFFmpeg([...baseCmd, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
        "-crf", q.crf, "-preset", q.preset, "-maxrate", q.maxrate, "-bufsize", q.bufsize,
        "-c:a", "aac", "-b:a", "192k", "-shortest", outputFile]);
    }

    let currentVideo = baseVideo;

    // Step 2: Apply visual effects (BEFORE subtitles so text stays sharp)
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

    // Step 3: Burn subtitles LAST (on top of effects, stays crisp)
    if (hasSrt) {
      try {
        await burnSubtitles(currentVideo, outputFile, srtFile!, isShort, quality);
        try { unlinkSync(currentVideo); } catch {}
      } catch (subErr) {
        console.warn(`[burnSubtitles] failed, falling back to no subtitles: ${subErr instanceof Error ? subErr.message : subErr}`);
        // Just rename currentVideo to outputFile
        copyFileSync(currentVideo, outputFile);
        try { unlinkSync(currentVideo); } catch {}
      }
    } else if (hasEffects) {
      // Rename fx file to final output
      copyFileSync(currentVideo, outputFile);
      try { unlinkSync(currentVideo); } catch {}
    }
  } catch (e) {
    console.warn(`[assembly] failed: ${safeMessage(e)}`);
  }

  // Cleanup clips
  for (const cp of clipFiles) try { unlinkSync(cp); } catch {}
  try { unlinkSync(concatList); } catch {}

  return existsSync(outputFile) && (existsSync(outputFile) ? true : false);
}

export async function burnSubtitles(inputVideo: string, outputVideo: string, srtFile: string, isShort = false, quality = "medium"): Promise<void> {
  // Use Python PIL + FFmpeg overlay (avoids all drawtext escaping issues)
  const pyScript = join(__SDIR, "burn_subs.py");
  if (!existsSync(pyScript)) throw new Error("burn_subs.py not found");

  const args = [pyScript, inputVideo, srtFile, outputVideo];
  if (isShort) args.push("--short");
  args.push(`--quality=${quality}`);

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
