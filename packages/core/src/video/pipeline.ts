import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { emitEvent } from "../event-bus/index.ts";
import type { VideoParams, VideoJob } from "./types.ts";
import { safeFilename, VIDEO_LANGUAGES } from "./types.ts";
import { generateStory } from "./story.ts";
import { generateTTS } from "./tts.ts";
import { textToSrt } from "./subtitles.ts";
import { generateImages, generateVideoClips } from "./images.ts";
import { safeMessage } from "../errors.ts";
import { createVideo, audioDuration, ffmpegPath } from "./assembly.ts";
import { mixWithBackgroundMusic } from "../media/music.ts";

const jobs = new Map<string, VideoJob>();
const abortControllers = new Map<string, AbortController>();
const BASE_DIR = join(process.cwd(), "video_output");
const JOBS_FILE = join(process.cwd(), "data", "video-jobs.json");

// ── Persistence ──────────────────────────────────────────────────────────────

function ensureDataDir(): void {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadJobs(): VideoJob[] {
  try {
    ensureDataDir();
    if (existsSync(JOBS_FILE)) {
      const raw = readFileSync(JOBS_FILE, "utf-8");
      return JSON.parse(raw) as VideoJob[];
    }
  } catch (e) {
    console.error("Failed to load video jobs:", e);
  }
  return [];
}

function saveJobs(): void {
  try {
    ensureDataDir();
    writeFileSync(JOBS_FILE, JSON.stringify([...jobs.values()], null, 2));
  } catch (e) {
    console.error("Failed to save video jobs:", e);
  }
}

// Load persisted jobs on startup
const persisted = loadJobs();
for (const j of persisted) {
  // Mark running/queued jobs as failed since they can't resume
  if (j.status === "queued" || j.status === "generating_story" || j.status === "generating_audio" ||
      j.status === "generating_images" || j.status === "subtitles" || j.status === "assembling") {
    j.status = "failed";
    j.error = "Server restarted — job was interrupted";
    j.updatedAt = new Date().toISOString();
  }
  jobs.set(j.id, j);
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getVideoJobs(): VideoJob[] {
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getVideoJob(id: string): VideoJob | undefined {
  return jobs.get(id);
}

export function cancelVideoJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status === "done" || job.status === "failed" || job.status === "cancelled") return false;

  // Abort the running pipeline
  const controller = abortControllers.get(id);
  if (controller) {
    controller.abort();
    abortControllers.delete(id);
  }

  job.status = "cancelled";
  job.updatedAt = new Date().toISOString();
  saveJobs();
  return true;
}

export function deleteVideoJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;

  // Cancel if running
  const controller = abortControllers.get(id);
  if (controller) {
    controller.abort();
    abortControllers.delete(id);
  }

  jobs.delete(id);
  saveJobs();
  return true;
}

export async function startVideoGeneration(params: VideoParams): Promise<VideoJob> {
  const id = randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const job: VideoJob = {
    id, status: "queued", topic: params.topic, progress: 0,
    createdAt: now, updatedAt: now,
  };
  jobs.set(id, job);
  saveJobs();

  const controller = new AbortController();
  abortControllers.set(id, controller);

  runPipeline(id, params, controller.signal).catch((err) => {
    const j = jobs.get(id);
    if (j && j.status !== "cancelled") {
      j.status = "failed";
      j.error = err.message || String(err);
      j.updatedAt = new Date().toISOString();
      saveJobs();
    }
    abortControllers.delete(id);
  });

  return job;
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

async function runPipeline(jobId: string, params: VideoParams, signal: AbortSignal): Promise<void> {
  const job = jobs.get(jobId)!;
  if (!job) return;

  const ts = Date.now().toString(36);
  const workDir = join(BASE_DIR, `job_${ts}`);
  mkdirSync(workDir, { recursive: true });
  const model = params.model || "deepseek/deepseek-chat";
  const isShort = params.isShort || false;
  const quality = params.quality?.replace("standard", "medium")?.replace("draft", "low")?.replace("premium", "high") || "medium";
  const lang = (params.language || "fr").toLowerCase();
  const langEntry = VIDEO_LANGUAGES.find(l =>
    l.whisperCode === lang ||
    l.name.toLowerCase() === lang ||
    l.name.toLowerCase().startsWith(lang) ||
    l.edgeVoice.toLowerCase().startsWith(lang)
  );
  const storyInstr = langEntry?.storyInstruction || "";
  console.log(`[video] Language: ${lang}, storyInstr: "${storyInstr}", ttsVoice: ${params.edgeVoice || langEntry?.edgeVoice || "en-US-GuyNeural"}`);

  try {
    // ── Music Video Mode: skip story/TTS, use uploaded audio as-is ──────
    const isMusicVideo = params.musicVideoMode === true && params.audioPath && existsSync(params.audioPath);
    if (isMusicVideo) {
      params.mediaType = "videos"; // force video clips
      params.useAudioEffects = false; // don't distort the music
    }

    // Check cancellation before each step
    if (signal.aborted) { job.status = "cancelled"; saveJobs(); return; }

    // ── Step 1: Story Generation ──────────────────────────────────────────
    updateJob(job, "generating_story", 10);
    emitEvent({ type: "event", kind: "message", sessionId: jobId, data: { step: "story", text: isMusicVideo ? "Music video mode — preparing scenes..." : "Generating story..." } });

    const storyData = (params.scriptText || isMusicVideo) ? null : await generateStory(
      params.topic, model, params.nicheName,
      params.duration ? Math.floor(params.duration * 155) : undefined,
      isShort, storyInstr,
    );

    if (signal.aborted) { job.status = "cancelled"; saveJobs(); return; }

    // If script text provided, build story data manually
    let title: string;
    let storyText: string;
    let imagePrompts: any[];
    let sfxCues: any[];

    if (isMusicVideo) {
      // Music video mode: generate scene prompts from topic keywords
      title = params.topic || "Music Video";
      storyText = ""; // no narration text
      const keywords = (params.topic || "cinematic nature urban").split(/\s+/).filter(w => w.length > 2);
      const clipCount = params.imageCount || 8;
      imagePrompts = [];
      for (let i = 0; i < clipCount; i++) {
        const kw = keywords[i % keywords.length] || "cinematic";
        const secs = Math.floor(i * 90 / Math.max(clipCount - 1, 1));
        const mm = Math.floor(secs / 60), ss = secs % 60;
        imagePrompts.push({
          prompt: `${kw} cinematic video`,
          timestamp: `${mm}:${String(ss).padStart(2, "0")}`,
          seconds: secs,
        });
      }
      sfxCues = [];
    } else if (params.scriptText) {
      storyText = params.scriptText.trim();
      const firstSent = storyText.split(/[.!?\n]/)[0].trim();
      title = firstSent ? firstSent.split(" ").slice(0, 8).join(" ") : (params.topic || "Custom Script");
      const sentences = storyText.split(/[.!?\n]/).filter((s) => s.trim().length > 8);
      const numImgs = Math.min(8, Math.max(4, Math.floor(sentences.length / 3) + 1));
      const durEst = Math.max(10, storyText.split(" ").length / 2.5);
      imagePrompts = [];
      for (let i = 0; i < numImgs; i++) {
        const secs = Math.floor(i * durEst / Math.max(numImgs - 1, 1));
        const mm = Math.floor(secs / 60), ss = secs % 60;
        const si = Math.floor(i * sentences.length / numImgs);
        imagePrompts.push({
          prompt: `${(sentences[si] || storyText.slice(0, 80)).slice(0, 120)}, cinematic photography`,
          timestamp: `${mm}:${String(ss).padStart(2, "0")}`,
          seconds: secs,
        });
      }
      sfxCues = [];
    } else if (storyData) {
      title = storyData.title;
      storyText = storyData.story;
      imagePrompts = storyData.imagePrompts;
      sfxCues = storyData.sfxCues;
    } else {
      throw new Error("Story generation failed");
    }

    // Save story
    const storyDir = join(workDir, "story");
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(join(storyDir, "story.txt"), `Title: ${title}\n\n${storyText}`);
    emitEvent({ type: "event", kind: "message", sessionId: jobId, data: { step: "story", text: `"${title}" (${storyText.split(" ").length} words)` } });

    if (signal.aborted) { job.status = "cancelled"; saveJobs(); return; }

    // ── Step 2: Audio ─────────────────────────────────────────────────────
    updateJob(job, "generating_audio", 30);
    const audioPath = join(workDir, "audio.mp3");
    let actualDuration: number;

    if (params.audioPath && existsSync(params.audioPath)) {
      // Use uploaded audio file instead of generating TTS
      const srcSize = statSync(params.audioPath).size;
      console.log(`[pipeline] copying audio: ${params.audioPath} (${srcSize} bytes) -> ${audioPath}`);
      writeFileSync(audioPath, readFileSync(params.audioPath));
      const dstSize = statSync(audioPath).size;
      console.log(`[pipeline] copied audio: ${dstSize} bytes (match=${srcSize === dstSize})`);

      // Strip ID3 tags and non-audio streams without re-encoding
      const normalizedPath = join(workDir, "audio_normalized.mp3");
      const ff = ffmpegPath();
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(ff, ["-y", "-i", audioPath, "-map", "0:a", "-c:a", "copy", "-vn", normalizedPath]);
        proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`audio normalize exit ${code}`)));
        proc.on("error", reject);
      });
      if (existsSync(normalizedPath) && statSync(normalizedPath).size > 1024) {
        try { unlinkSync(audioPath); } catch {}
        renameSync(normalizedPath, audioPath);
        console.log(`[pipeline] audio normalized OK (${statSync(audioPath).size} bytes)`);
      } else {
        console.warn(`[pipeline] audio normalize failed, using original`);
        try { unlinkSync(normalizedPath); } catch {}
      }

      actualDuration = await audioDuration(audioPath);

      if (isMusicVideo) {
        // Music video mode: use audio as-is, no mixing, no effects
        console.log(`[pipeline] Music video mode — audio duration: ${actualDuration.toFixed(1)}s (no bg music, no effects)`);
      } else {
        console.log(`[pipeline] audio duration: ${actualDuration.toFixed(1)}s (before bg music)`);
        // Add background music for professional sound
        const bgMusicPath = join(workDir, "audio_bgmusic.mp3");
        const mixed = await mixWithBackgroundMusic(audioPath, bgMusicPath, {
          musicVolume: 0.1, fadeIn: 1.5, fadeOut: 3,
        });
        if (mixed && existsSync(bgMusicPath)) {
          try { unlinkSync(audioPath); } catch {}
          renameSync(bgMusicPath, audioPath);
          console.log(`[pipeline] background music mixed OK`);
          actualDuration = await audioDuration(audioPath);
          console.log(`[pipeline] audio duration after bg music: ${actualDuration.toFixed(1)}s`);
        }

        // Apply audio effects if requested (reverb, compression, EQ)
        if (params.useAudioEffects !== false) {
        try {
          const processedPath = join(workDir, "audio_processed.mp3");
          const ff = ffmpegPath();
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(ff, [
              "-y", "-i", audioPath,
              "-af", "compand=attacks=0.3:decays=0.8:points=-80/-80|-45/-15|-27/-9|0/-7|20/-7:dela=2:gain=8, aecho=0.8:0.7:40:0.3, chorus=0.7:0.9:55:0.4:0.25:2",
              "-c:a", "libmp3lame", "-b:a", "192k", processedPath,
            ]);
            proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`audio fx exit ${code}`)));
            proc.on("error", reject);
          });
          if (existsSync(processedPath)) {
            const origSize = statSync(audioPath).size;
            const processedSize = statSync(processedPath).size;
            if (processedSize > origSize * 0.5) {
              try { unlinkSync(audioPath); } catch {} renameSync(processedPath, audioPath);
            } else { try { unlinkSync(processedPath); } catch {} }
          }
        } catch (e) { console.warn(`[pipeline] audio effects failed: ${e}`); }
        }
      }
    } else {
      console.log(`[pipeline] no audioPath or file not found, generating TTS`);
      const ttsVoice = params.edgeVoice || langEntry?.edgeVoice || "en-US-GuyNeural";
      const ttsOk = await generateTTS(storyText, audioPath, params.ttsEngine || "auto", ttsVoice);
      if (!ttsOk) throw new Error("TTS generation failed");
      actualDuration = await audioDuration(audioPath);

      // If TTS audio is significantly shorter than target, slow it down
      const ttsTarget = params.duration ? params.duration * 60 : 0;
      if (ttsTarget > 0 && actualDuration < ttsTarget * 0.85) {
        const slowdown = actualDuration / ttsTarget;
        const atempo = Math.max(0.5, Math.min(1.0, slowdown));
        console.log(`[pipeline] TTS too short (${actualDuration.toFixed(0)}s vs ${ttsTarget.toFixed(0)}s target), slowing to ${(atempo * 100).toFixed(0)}% speed`);
        const slowedPath = join(workDir, "audio_slowed.mp3");
        try {
          const ff = ffmpegPath();
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(ff, ["-y", "-i", audioPath, "-af", `atempo=${atempo.toFixed(2)}`, "-c:a", "libmp3lame", "-b:a", "192k", slowedPath]);
            proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`atempo exit ${code}`)));
            proc.on("error", reject);
          });
          if (existsSync(slowedPath) && statSync(slowedPath).size > 1024) {
            try { unlinkSync(audioPath); } catch {}
            renameSync(slowedPath, audioPath);
            actualDuration = await audioDuration(audioPath);
            console.log(`[pipeline] Audio slowed: now ${actualDuration.toFixed(0)}s`);
          }
        } catch (e) { console.warn(`[pipeline] atempo failed: ${e}`); }
      }
    }
    // Duration normalization: respect user-requested duration ONLY for TTS-generated audio, not uploaded files
    const targetDurationSec = !params.audioPath && params.duration ? params.duration * 60 : 0;
    if (targetDurationSec > 0 && actualDuration < targetDurationSec) {
      const paddedAudio = join(workDir, "audio_padded.mp3");
      const padSec = targetDurationSec - actualDuration;
      try {
        const ff = ffmpegPath();
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(ff, [
            "-y", "-i", audioPath,
            "-af", `apad=pad_dur=${padSec}`,
            "-t", String(targetDurationSec),
            "-c:a", "libmp3lame", "-b:a", "192k",
            paddedAudio,
          ]);
          proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`pad exit ${code}`)));
          proc.on("error", reject);
        });
        // Use padded version
        if (existsSync(paddedAudio)) {
          try { unlinkSync(audioPath); } catch (e) { console.warn(`[pipeline] cleanup unlink failed: ${e}`); }
          renameSync(paddedAudio, audioPath);
          actualDuration = targetDurationSec;
        }
      } catch (e) { console.warn(`[pipeline] audio pad failed: ${e}`); }
    }
    emitEvent({ type: "event", kind: "message", sessionId: jobId, data: { step: "audio", text: `Audio generated (${actualDuration.toFixed(0)}s)` } });

    if (signal.aborted) { job.status = "cancelled"; saveJobs(); return; }

    // ── Step 3: Subtitles ─────────────────────────────────────────────────
    updateJob(job, "subtitles", 45);
    let srtPath: string | undefined;
    const subMode = params.subtitleMode || "story";

    if (isMusicVideo) {
      // Music video mode: no subtitles
      emitEvent({ type: "event", kind: "message", sessionId: jobId, data: { step: "subtitles", text: "Music video — no subtitles" } });
    } else if (subMode !== "none") {
      const srtPathActual = join(workDir, "subs.srt");
      await textToSrt(storyText, audioPath, srtPathActual, params.transcriptionSegments);
      if (existsSync(srtPathActual)) srtPath = srtPathActual;
      emitEvent({ type: "event", kind: "message", sessionId: jobId, data: { step: "subtitles", text: srtPath ? "Subtitles generated" : "No subtitles" } });
    }

    if (signal.aborted) { job.status = "cancelled"; saveJobs(); return; }

    // ── Step 4: Media (Images or Video Clips) ─────────────────────────────
    updateJob(job, "generating_images", 55);
    const imagesDir = join(storyDir, "images");
    const mediaPrompts = imagePrompts.map((p: any) => ({
      prompt: p.prompt || "",
      timestamp: p.timestamp || null,
      seconds: p.seconds ?? null,
    }));
    const storyContext = `${title}\n${storyText.slice(0, 500)}`;
    const useVideoClips = params.mediaType === "videos";
    let mediaCount: number;

    if (useVideoClips) {
      console.log(`[pipeline] Downloading video clips from Pexels (${params.imageCount ?? 6} clips)`);
      mediaCount = await generateVideoClips(mediaPrompts, imagesDir, params.imageCount, params.stockVideos, storyContext);
    } else {
      mediaCount = await generateImages(mediaPrompts, imagesDir, params.imageEngine || "auto", isShort, params.imageCount, params.imageStyle, storyContext);
    }

    if (mediaCount === 0) throw new Error(useVideoClips ? "Video clip download failed" : "Image generation failed");
    emitEvent({ type: "event", kind: "message", sessionId: jobId, data: { step: "images", text: useVideoClips ? `${mediaCount} video clips ready` : `${mediaCount} images ready` } });

    if (signal.aborted) { job.status = "cancelled"; saveJobs(); return; }

    // ── Step 5: Assembly ──────────────────────────────────────────────────
    updateJob(job, "assembling", 75);
    const safeName = safeFilename(title);
    const outputFilename = `video_${ts}_${safeName}.mp4`;
    const outputPath = join(workDir, outputFilename);

    const timestamps = imagePrompts.map((p: any) => ({ seconds: p.seconds ?? null }));
    const assemblyOk = await createVideo(imagesDir, audioPath, outputPath, srtPath, timestamps, isShort, quality, params.animationStyle, params.effects, params.transition, params.transitionDuration, params.subtitleAnimation, params.composition, useVideoClips);
    if (!assemblyOk) throw new Error("Video assembly failed");

    const sizeMb = existsSync(outputPath) ? readFileSync(outputPath).length / 1048576 : 0;

    // ── Metadata ──────────────────────────────────────────────────────────
    const meta = {
      version: "1.0", created_at: new Date().toISOString(),
      video: { filename: outputFilename, title, is_short: isShort, quality, size_mb: Math.round(sizeMb * 100) / 100 },
      content: { topic: params.topic, word_count: storyText.split(" ").length, story: storyText.slice(0, 500) },
      production: { model, tts_engine: params.ttsEngine || "auto", image_engine: params.imageEngine || "auto", image_count: imgCount, subtitles: Boolean(srtPath) },
    };
    writeFileSync(join(workDir, "metadata.json"), JSON.stringify(meta, null, 2));

    // Done
    job.status = "done";
    job.progress = 100;
    job.outputPath = outputPath;
    job.updatedAt = new Date().toISOString();
    job.meta = { sizeMb: Math.round(sizeMb * 100) / 100, wordCount: storyText.split(" ").length };
    emitEvent({ type: "event", kind: "message", sessionId: jobId, data: { step: "done", text: `Video ready: ${outputPath}` } });
    saveJobs();

  } catch (e: unknown) {
    if (signal.aborted) {
      job.status = "cancelled";
    } else {
      job.status = "failed";
      job.error = safeMessage(e);
    }
    job.updatedAt = new Date().toISOString();
    saveJobs();
  } finally {
    abortControllers.delete(jobId);
  }
}

function pushLog(job: VideoJob, msg: string): void {
  if (!job.log) job.log = [];
  job.log.push(msg);
  job.updatedAt = new Date().toISOString();
}

function updateJob(job: VideoJob, status: VideoJob["status"], progress: number, msg?: string): void {
  job.status = status;
  job.progress = progress;
  job.updatedAt = new Date().toISOString();
  if (msg) pushLog(job, msg);
}
