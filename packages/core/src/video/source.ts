/**
 * Source materials scanner for the video pipeline.
 *
 * Adapted from CheetahClaws source.py – manages user-provided materials:
 *   images  -> skip AI generation, use directly
 *   audio   -> skip TTS, use as narration
 *   text    -> inject as story context
 *   video   -> extract audio track and/or frames via ffmpeg
 */
import { mkdirSync, copyFileSync, readdirSync, existsSync, readFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { spawn } from "node:child_process";
import type { StoryData } from "./types.ts";

// ── File extension sets ──────────────────────────────────────────────
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv"]);
const TEXT_EXT  = new Set([".txt", ".md", ".rst", ".csv", ".json", ".srt"]);

export interface SourceInfo {
  images: string[];
  audio:  string[];
  video:  string[];
  text:   string[];
}

/**
 * Scan source_dir and return categorised lists of absolute file paths.
 */
export function scanSourceDir(sourceDir: string): SourceInfo {
  const result: SourceInfo = { images: [], audio: [], video: [], text: [] };
  if (!existsSync(sourceDir)) return result;

  let entries: string[];
  try {
    entries = readdirSync(sourceDir).sort();
  } catch { return result; }

  for (const fname of entries) {
    const fpath = join(sourceDir, fname);
    // skip directories
    try { if (!existsSync(fpath)) continue; } catch { continue; }
    const ext = extname(fname).toLowerCase();
    if      (IMAGE_EXT.has(ext)) result.images.push(fpath);
    else if (AUDIO_EXT.has(ext)) result.audio.push(fpath);
    else if (VIDEO_EXT.has(ext)) result.video.push(fpath);
    else if (TEXT_EXT.has(ext))  result.text.push(fpath);
  }
  return result;
}

/**
 * Read text files and return a combined excerpt suitable as story context.
 */
export function summariseSourceForStory(textFiles: string[], maxChars = 8000): string {
  const parts: string[] = [];
  let total = 0;
  for (const fpath of textFiles) {
    if (total >= maxChars) break;
    try {
      const content = readFileSync(fpath, "utf-8");
      if (!content) continue;
      const snippet = content.slice(0, maxChars - total);
      parts.push(`[${basename(fpath)}]\n${snippet}`);
      total += snippet.length;
    } catch {
      // skip unreadable files
    }
  }
  return parts.join("\n\n");
}

/**
 * Copy (and optionally resize) source images into images_dir.
 * Uses ffmpeg for resize+centre-crop (avoids sharp/PIL dependency).
 * Returns number of images copied.
 */
export function copySourceImages(srcImages: string[], imagesDir: string, isShort = false): number {
  mkdirSync(imagesDir, { recursive: true });
  const targetW = isShort ? 1080 : 1920;
  const targetH = isShort ? 1920 : 1080;
  let count = 0;

  for (let i = 0; i < srcImages.length; i++) {
    const src = srcImages[i];
    const ext = extname(src).toLowerCase() || ".png";
    const dst = join(imagesDir, `img_${String(i + 1).padStart(2, "0")}${ext}`);

    try {
      // Try ffmpeg resize+centre-crop
      _resizeImageFFmpeg(src, dst, targetW, targetH);
      if (existsSync(dst)) { count++; continue; }
    } catch { /* fall through */ }

    // Fallback: plain copy
    try {
      copyFileSync(src, dst);
      count++;
    } catch {
      console.warn(`  [source] could not copy image: ${basename(src)}`);
    }
  }
  return count;
}

function _resizeImageFFmpeg(src: string, dst: string, targetW: number, targetH: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = _ffmpegPath();
    const vf = `scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}`;
    const proc = spawn(ff, ["-y", "-i", src, "-vf", vf, "-frames:v", "1", dst]);
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`resize exit ${code}`)));
    proc.on("error", reject);
  });
}

/**
 * Extract audio track from a video file using ffmpeg.
 */
export function extractAudioFromVideo(videoPath: string, outputMp3: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ff = _ffmpegPath();
    const proc = spawn(ff, ["-y", "-i", videoPath, "-vn", "-codec:a", "libmp3lame", "-q:a", "2", outputMp3]);
    proc.on("close", (code) => resolve(code === 0 && existsSync(outputMp3)));
    proc.on("error", () => resolve(false));
  });
}

/**
 * Extract evenly-spaced frames from a video file using ffmpeg.
 * Returns number of frames extracted.
 */
export function extractVideoFrames(videoPath: string, imagesDir: string, _isShort = false): Promise<number> {
  mkdirSync(imagesDir, { recursive: true });
  const ff = _ffmpegPath();
  const outPattern = join(imagesDir, "img_%02d.jpg");

  return new Promise((resolve) => {
    const proc = spawn(ff, [
      "-y", "-i", videoPath,
      "-vf", "fps=1/5,scale=1920:1080:force_original_aspect_ratio=decrease",
      "-frames:v", "8", outPattern,
    ]);
    proc.on("close", () => {
      try {
        const frames = readdirSync(imagesDir).filter((f) => /^img_\d+\.jpg$/.test(f));
        resolve(frames.length);
      } catch { resolve(0); }
    });
    proc.on("error", () => resolve(0));
  });
}

/**
 * Rank images by keyword overlap between filename and story text.
 * Returns sorted array of best matches first.
 */
export function selectRelevantImages(images: string[], storyData: Partial<StoryData>, n: number): string[] {
  if (images.length <= n) return images;

  const story = ((storyData.title || "") + " " + (storyData.story || "")).toLowerCase();
  const words = story.match(/[a-z]{3,}/g) || [];
  const stop = new Set(["the", "and", "was", "for", "not", "but", "had", "his", "her",
    "that", "with", "from", "they", "this", "have", "were", "what"]);
  const keywords = new Set(words.filter((w) => !stop.has(w)));

  function score(path: string): number {
    const name = basename(path).replace(extname(path), "").toLowerCase();
    const nameWords = name.match(/[a-z]{3,}/g) || [];
    return nameWords.filter((w) => keywords.has(w)).length;
  }

  return [...images].sort((a, b) => score(b) - score(a)).slice(0, n);
}

// ── Internal helpers ──────────────────────────────────────────────────

function _ffmpegPath(): string {
  try {
    const { which } = process as any;
    if (typeof which === "function") return which("ffmpeg") || "ffmpeg";
  } catch {}
  // Bun.which for Bun runtime
  try {
    const Bun = (globalThis as any).Bun;
    if (Bun?.which) return Bun.which("ffmpeg") || "ffmpeg";
  } catch {}
  return "ffmpeg";
}
