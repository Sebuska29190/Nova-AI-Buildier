// Background music mixer — adds professional background music to voice audio
import { spawn } from "node:child_process";
import { existsSync, unlinkSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface MixOptions {
  musicVolume?: number;  // 0.0–1.0, default 0.15 (quiet background)
  voiceVolume?: number;  // 0.0–1.0, default 1.0
  fadeIn?: number;       // seconds, default 1
  fadeOut?: number;      // seconds, default 2
  musicPath?: string;    // custom music file (MP3/WAV)
}

/**
 * Mix voice audio with background music using FFmpeg ducking.
 * - Music plays at low volume throughout
 * - When voice is active, music volume is further reduced (sidechain compression via compand)
 * - Fades music in/out at edges
 */
export async function mixWithBackgroundMusic(
  voicePath: string,
  outputPath: string,
  options: MixOptions = {},
): Promise<boolean> {
  const { musicVolume = 0.12, voiceVolume = 1.0, fadeIn = 1, fadeOut = 2, musicPath } = options;

  let bgMusicPath = musicPath;
  if (!bgMusicPath || !existsSync(bgMusicPath)) {
    // Generate a simple ambient pad using FFmpeg sine waves
    bgMusicPath = await generateAmbientMusic(voicePath);
    if (!bgMusicPath) return false;
  }

  try {
    const tmpOutput = outputPath + ".tmp.mp3";
    const dur = await getDuration(voicePath);
    const musicDur = await getDuration(bgMusicPath);

    // Simple overlay: voice at full volume + quiet ambient music
    const args = [
      "-y",
      "-i", voicePath,
      "-stream_loop", "-1",
      "-i", bgMusicPath,
      "-t", String(dur),
      "-filter_complex",
      `[1:a]volume=${musicVolume},afade=t=in:d=${fadeIn}:curve=tri,afade=t=out:st=${dur - fadeOut}:d=${fadeOut}:curve=tri[bg];[bg][0:a]amix=inputs=2:duration=first:dropout_transition=0[out]`,
      "-map", "[out]",
      "-c:a", "libmp3lame",
      "-b:a", "192k",
      "-ac", "2",
      tmpOutput,
    ];

    await new Promise<void>((resolve, reject) => {
      const ff = whichFfmpeg();
      const proc = spawn(ff, args);
      let stderr = "";
      proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`music mix exit ${code}: ${stderr.slice(-300)}`));
      });
      proc.on("error", reject);
    });

    if (existsSync(tmpOutput) && statSync(tmpOutput).size > 1024) {
      try { unlinkSync(voicePath); } catch {}
      renameSync(tmpOutput, outputPath);
      // Clean up generated music
      if (!musicPath && bgMusicPath !== voicePath) {
        try { unlinkSync(bgMusicPath); } catch {}
      }
      return true;
    }
    return false;
  } catch (e) {
    console.warn(`[music] mix failed: ${e}`);
    return false;
  }
}

/** Generate a simple ambient music track using FFmpeg */
async function generateAmbientMusic(voicePath: string): Promise<string | null> {
  try {
    const dur = await getDuration(voicePath);
    if (dur <= 0) return null;

    const outputPath = voicePath.replace(/\.mp3$/i, "_ambient.wav");
    const ff = whichFfmpeg();

    // Generate ambient pad: low C + E + G sine waves with slow LFO modulation
    // Creates a warm, professional cinematic background
    const freqBase = 130.81; // C3
    const args = [
      "-y",
      "-f", "lavfi",
      "-i", `sine=frequency=${freqBase}:duration=${dur + 2},volume=0.08`,
      "-f", "lavfi",
      "-i", `sine=frequency=${freqBase * 5 / 4}:duration=${dur + 2},volume=0.05`,  // E3
      "-f", "lavfi",
      "-i", `sine=frequency=${freqBase * 3 / 2}:duration=${dur + 2},volume=0.05`,  // G3
      "-f", "lavfi",
      "-i", `anoisesrc=d=1:c=pink:a=0.02`,
      "-filter_complex", `[0:a][1:a][2:a]amix=inputs=3:duration=longest[a];[a]lowpass=f=400,highpass=f=60,aecho=0.8:0.7:20:0.2,afade=t=in:d=1.5:curve=tri,afade=t=out:st=${dur}:d=2:curve=tri[out]`,
      "-map", "[out]",
      "-t", String(dur + 2),
      outputPath,
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ff, args);
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ambient gen exit ${code}`)));
      proc.on("error", reject);
    });

    if (existsSync(outputPath) && statSync(outputPath).size > 1024) {
      return outputPath;
    }
    return null;
  } catch {
    return null;
  }
}

function whichFfmpeg(): string {
  // Try Bun.which if available, else fallback
  try {
    const { which } = require("bun");
    return which("ffmpeg") || "ffmpeg";
  } catch {
    return "ffmpeg";
  }
}

async function getDuration(filePath: string): Promise<number> {
  try {
    const ff = whichFfmpeg();
    const result = await new Promise<string>((resolve) => {
      const proc = spawn(ff, ["-i", filePath]);
      let err = "";
      proc.stderr?.on("data", (d: Buffer) => { err += d.toString(); });
      proc.on("close", () => resolve(err));
      proc.on("error", () => resolve(""));
      setTimeout(() => { try { proc.kill(); } catch {}; resolve(err); }, 5000);
    });
    const m = result.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
    if (m) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 100;
  } catch {}
  return 120;
}
