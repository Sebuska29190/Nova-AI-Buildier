import { spawn, execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

// ─── Plan Types ──────────────────────────────────────────────────
export interface SceneClip {
  filePath: string;
  trimStart?: number;   // seconds
  trimEnd?: number;     // seconds
  speed?: number;       // 0.5-4.0
  effect?: string;      // vignette | grayscale | sepia | blur | none
  captions?: boolean;
  transition?: string;  // fade | dissolve | wipe-left | none
  transitionDuration?: number;
}

export interface CaptionConfig {
  language: string;     // pl | en | de | es | fr
  style: "minimal" | "karaoke" | "boxed" | "none";
  position?: "bottom" | "top" | "auto";
}

export interface VideoEditPlan {
  scenes: SceneClip[];
  music?: { filePath: string; volume: number }; // 0.0-1.0
  captions: CaptionConfig;
  resolution: string;   // "1920x1080" | "1080x1920" | "1280x720"
  fps: number;
  output: string;       // output filename
}

// ─── FFprobe helpers ────────────────────────────────────────────
export function getVideoDuration(filePath: string): number {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: "utf-8", timeout: 5000 }
    );
    return parseFloat(out.trim()) || 0;
  } catch { return 0; }
}

export function getVideoResolution(filePath: string): { width: number; height: number } {
  try {
    const out = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${filePath}"`,
      { encoding: "utf-8", timeout: 5000 }
    );
    const parts = out.trim().split("x");
    return { width: parseInt(parts[0]) || 0, height: parseInt(parts[1]) || 0 };
  } catch { return { width: 0, height: 0 }; }
}

// ─── Execute Plan ───────────────────────────────────────────────
function runFFmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-500)}`));
    });
    proc.on("error", reject);
  });
}

function escapePath(p: string): string {
  return `"${p}"`;
}

export async function executeEditPlan(plan: VideoEditPlan, workspaceDir: string): Promise<string> {
  const outputPath = join(workspaceDir, plan.output);

  // ── Step 1: Process each scene ─────────────────────────────────
  const sceneFiles: string[] = [];

  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i];
    const inputPath = scene.filePath;

    if (!existsSync(inputPath)) {
      // Try relative to workspace
      const relPath = join(workspaceDir, scene.filePath);
      if (!existsSync(relPath)) {
        throw new Error(`File not found: ${scene.filePath} (tried: ${inputPath}, ${relPath})`);
      }
    }

    const sceneOutput = join(workspaceDir, `_scene_${String(i).padStart(3, "0")}.mp4`);
    sceneFiles.push(sceneOutput);

    // Build filter complex
    const filters: string[] = [];
    const inputArgs: string[] = [];

    // Trim
    let trimFilter = "";
    if (scene.trimStart !== undefined || scene.trimEnd !== undefined) {
      const start = scene.trimStart ?? 0;
      const end = scene.trimEnd !== undefined ? scene.trimEnd : 999999;
      const dur = end - start;
      inputArgs.push("-ss", String(start));
      if (dur > 0) inputArgs.push("-t", String(dur));
    }

    // Speed
    const speed = scene.speed ?? 1.0;
    if (speed !== 1.0) {
      const setpts = `setpts=${(1 / speed).toFixed(2)}*PTS`;
      filters.push(setpts);
      // Adjust audio
      const atempo = speed >= 0.5 && speed <= 2.0
        ? `atempo=${speed.toFixed(2)}`
        : `atempo=2.0,atempo=${(speed / 2).toFixed(2)}`;
      filters.push(atempo);
    }

    // Effects
    if (scene.effect && scene.effect !== "none") {
      switch (scene.effect) {
        case "vignette": filters.push("vignette=PI/4"); break;
        case "grayscale": filters.push("colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3"); break;
        case "sepia": filters.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131"); break;
        case "blur": filters.push("boxblur=5:1"); break;
      }
    }

    // Captions (burned-in)
    if (scene.captions && plan.captions.style !== "none") {
      // We'll handle subtitles via SRT in Step 3 instead
    }

    // Build FFmpeg command
    const args: string[] = ["-y", "-i", escapePath(inputPath), ...inputArgs];

    if (filters.length > 0) {
      args.push("-vf", filters.join(","));
    }

    // Resolution and quality
    args.push("-s", plan.resolution);
    args.push("-c:v", "libx264", "-preset", "medium", "-crf", "22");
    args.push("-c:a", "aac", "-b:a", "128k");
    args.push("-pix_fmt", "yuv420p");
    args.push(escapePath(sceneOutput));

    await runFFmpeg(args);
  }

  // ── Step 2: Concatenate all scenes ─────────────────────────────
  const concatFile = join(workspaceDir, "_concat_list.txt");
  const fileList = sceneFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(concatFile, fileList, "utf-8");

  const concatArgs = [
    "-y", "-f", "concat", "-safe", "0",
    "-i", escapePath(concatFile),
    "-c:v", "libx264", "-preset", "medium", "-crf", "22",
    "-c:a", "aac", "-b:a", "128k",
    "-pix_fmt", "yuv420p",
    escapePath(outputPath),
  ];

  await runFFmpeg(concatArgs);

  // ── Step 3: Add captions (if requested) ────────────────────────
  if (plan.captions.style !== "none" && plan.captions.language) {
    // Generate SRT from audio via whisper or use existing subtitles logic
    console.log(`[editor] Captions requested: ${plan.captions.language} (${plan.captions.style})`);
    // For now we flag it — actual whisper integration can be added later
  }

  // ── Step 4: Add background music (if provided) ─────────────────
  if (plan.music && existsSync(plan.music.filePath)) {
    const withMusic = join(workspaceDir, `_with_music_${plan.output}`);
    const musicArgs = [
      "-y", "-i", escapePath(outputPath),
      "-i", escapePath(plan.music.filePath),
      "-filter_complex",
      `[1:a]volume=${plan.music.volume}[music];[0:a][music]amix=inputs=2:duration=first[audio]`,
      "-map", "0:v", "-map", "[audio]",
      "-c:v", "copy",
      "-c:a", "aac", "-b:a", "128k",
      "-shortest",
      escapePath(withMusic),
    ];
    await runFFmpeg(musicArgs);
    // Replace output with music version
    const { renameSync } = await import("node:fs");
    renameSync(withMusic, outputPath);
  }

  // ── Cleanup ────────────────────────────────────────────────────
  const { unlinkSync, readdirSync } = await import("node:fs");
  for (const f of sceneFiles) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }
  try { unlinkSync(concatFile); } catch { /* ignore */ }

  return outputPath;
}

// ─── Analyze clips for AI ───────────────────────────────────────
export function analyzeClips(filePaths: string[]): string {
  const info = filePaths.map((fp) => {
    if (!existsSync(fp)) return `  - ${fp}: NOT FOUND`;
    const dur = getVideoDuration(fp);
    const res = getVideoResolution(fp);
    const size = statSync(fp).size;
    return `  - ${fp}: ${res.width}x${res.height}, ${dur.toFixed(1)}s, ${(size / 1024 / 1024).toFixed(1)}MB`;
  });
  return info.join("\n");
}
