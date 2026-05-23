import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync, renameSync } from "node:fs";
import { join } from "node:path";
import { emitEvent } from "../event-bus/index.ts";
import type { VideoParams, VideoJob } from "./types.ts";
import { safeFilename, VIDEO_LANGUAGES } from "./types.ts";
import { generateStory } from "./story.ts";
import { generateTTS } from "./tts.ts";
import { textToSrt } from "./subtitles.ts";
import { generateImages } from "./images.ts";
import { safeMessage } from "../errors.ts";
import { createVideo, audioDuration, ffmpegPath } from "./assembly.ts";

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
    // Check cancellation before each step
    if (signal.aborted) { job.status = "cancelled"; saveJobs(); return; }

    // ── Step 1: Story Generation ──────────────────────────────────────────
    updateJob(job, "generating_story", 10);
    emitEvent({ type: "event", kind: "message", sessionId: jobId, data: { step: "story", text: "Generating story..." } });

    const storyData = params.scriptText ? null : await generateStory(
      params.topic, model, params.nicheName,
      params.duration ? Math.floor(params.duration * 135) : undefined,
      isShort, storyInstr,
    );

    if (signal.aborted) { job.status = "cancelled"; saveJobs(); return; }

    // If script text provided, build story data manually
    let title: string;
    let storyText: string;
    let imagePrompts: any[];
    let sfxCues: any[];

    if (params.scriptText) {
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
    const ttsVoice = params.edgeVoice || langEntry?.edgeVoice || "en-US-GuyNeural";
    const ttsOk = await generateTTS(storyText, audioPath, params.ttsEngine || "auto", ttsVoice);
    if (!ttsOk) throw new Error("TTS generation failed");
    let actualDuration = await audioDuration(audioPath);

    // Respect user-requested duration: pad with silence if audio is too short
    const targetDurationSec = params.duration ? params.duration * 60 : 0;
    if (targetDurationSec > 0 && actualDuration < targetDurationSec) {
      const paddedAudio = join(workDir, "audio_padded.mp3");
      const padSec = targetDurationSec - actualDuration;
      try {
        const ff = ffmpegPath();
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(ff, [
            "-y", "-i", audioPath,
            "-af", `apad=pad_dur=${padSec}`,
            "-c:a", "libmp3lame", "-b:a", "192k",
            "-shortest", paddedAudio,
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

    if (subMode !== "none") {
      const srtPathActual = join(workDir, "subs.srt");
      await textToSrt(storyText, audioPath, srtPathActual);
      if (existsSync(srtPathActual)) srtPath = srtPathActual;
      emitEvent({ type: "event", kind: "message", sessionId: jobId, data: { step: "subtitles", text: srtPath ? "Subtitles generated" : "No subtitles" } });
    }

    if (signal.aborted) { job.status = "cancelled"; saveJobs(); return; }

    // ── Step 4: Images ────────────────────────────────────────────────────
    updateJob(job, "generating_images", 55);
    const imagesDir = join(storyDir, "images");
    const imgCount = await generateImages(imagePrompts.map((p: any) => ({
      prompt: p.prompt || "",
      timestamp: p.timestamp || null,
      seconds: p.seconds ?? null,
    })), imagesDir, params.imageEngine || "auto", isShort, params.imageCount, params.imageStyle, `${title}\n${storyText.slice(0, 500)}`);

    if (imgCount === 0) throw new Error("Image generation failed");
    emitEvent({ type: "event", kind: "message", sessionId: jobId, data: { step: "images", text: `${imgCount} images ready` } });

    if (signal.aborted) { job.status = "cancelled"; saveJobs(); return; }

    // ── Step 5: Assembly ──────────────────────────────────────────────────
    updateJob(job, "assembling", 75);
    const safeName = safeFilename(title);
    const outputFilename = `video_${ts}_${safeName}.mp4`;
    const outputPath = join(workDir, outputFilename);

    const timestamps = imagePrompts.map((p: any) => ({ seconds: p.seconds ?? null }));
    const assemblyOk = await createVideo(imagesDir, audioPath, outputPath, srtPath, timestamps, isShort, quality, params.animationStyle, params.effects);
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
