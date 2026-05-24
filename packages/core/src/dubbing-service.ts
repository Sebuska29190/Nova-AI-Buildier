/**
 * Dubbing Service — MP4 video dubbing with transcription, translation, and voiceover.
 *
 * Inspired by OmniVoice-Studio (Apache 2.0) — https://github.com/OmniVoice/OmniVoice-Studio
 * This is a standalone implementation using Nova's existing TTS + LLM + FFmpeg.
 *
 * Pipeline: input MP4 → extract audio → whisper transcribe → LLM translate →
 *           generate TTS → time-stretch to match original duration → burn subtitles → output MP4
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { safeMessage } from "./errors.ts";

const DATA_DIR = join(process.cwd(), "data", "dubbing");
const JOBS_FILE = join(DATA_DIR, "jobs.json");
mkdirSync(DATA_DIR, { recursive: true });

// ── Persistence ────────────────────────────────────────
function persistJobs(): void {
  try {
    writeFileSync(JOBS_FILE, JSON.stringify([...jobs.values()], null, 2), "utf-8");
  } catch {}
}

function loadJobs(): void {
  try {
    if (existsSync(JOBS_FILE)) {
      const data = JSON.parse(readFileSync(JOBS_FILE, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach((j: DubJob) => jobs.set(j.id, j));
        console.log(`[dub] Loaded ${data.length} job(s) from ${JOBS_FILE}`);
      }
    }
  } catch (e) {
    console.log(`[dub] Could not load jobs: ${safeMessage(e)}`);
  }
}

// Load persisted jobs on module init
loadJobs();

// Detect Python path — Bun on Windows doesn't inherit PATH for spawn/execSync
function findPython(): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  // Try where python via cmd.exe
  try {
    const result = execSync("where python 2>NUL", { timeout: 5000, encoding: "utf-8", windowsHide: true, shell: "cmd.exe" });
    const p = result.toString().split("\r\n")[0]?.trim();
    if (p && existsSync(p)) { process.env.PYTHON_PATH = p; return p; }
  } catch {}
  // Fallback: common locations
  const candidates = [
    "C:\\Users\\Domowy\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\python.exe",
    "C:\\Users\\Domowy\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
    "C:\\Python313\\python.exe",
    "C:\\Windows\\py.exe",
  ];
  for (const c of candidates) {
    if (existsSync(c)) { process.env.PYTHON_PATH = c; return c; }
  }
  return "python";
}

// Mapowanie języka na głos Edge TTS
const EDGE_VOICES: Record<string, string> = {
  pl: "pl-PL-MarekNeural", "pl-PL": "pl-PL-MarekNeural",
  fr: "fr-FR-HenriNeural", "fr-FR": "fr-FR-HenriNeural",
  de: "de-DE-ConradNeural", "de-DE": "de-DE-ConradNeural",
  es: "es-ES-AlvaroNeural", "es-ES": "es-ES-AlvaroNeural",
  it: "it-IT-DiegoNeural", "it-IT": "it-IT-DiegoNeural",
  pt: "pt-BR-AntonioNeural", "pt-BR": "pt-BR-AntonioNeural",
  ru: "ru-RU-DmitryNeural", "ru-RU": "ru-RU-DmitryNeural",
  ja: "ja-JP-KeitaNeural", "ja-JP": "ja-JP-KeitaNeural",
  zh: "zh-CN-YunxiNeural", "zh-CN": "zh-CN-YunxiNeural",
  ko: "ko-KR-InJoonNeural", "ko-KR": "ko-KR-InJoonNeural",
  ar: "ar-SA-HamedNeural",
  nl: "nl-NL-MaartenNeural", tr: "tr-TR-AhmetNeural",
  sv: "sv-SE-MattiasNeural", da: "da-DK-JeppeNeural",
  fi: "fi-FI-HarriNeural", nb: "nb-NO-FinnNeural",
  cs: "cs-CZ-AntoninNeural", hu: "hu-HU-TamasNeural",
  ro: "ro-RO-EmilNeural", th: "th-TH-NiwatNeural",
  vi: "vi-VN-NamMinhNeural",
};

function resolveVoice(targetLang: string, uiVoice?: string): string {
  if (uiVoice && uiVoice !== "en-US-GuyNeural") return uiVoice;
  return EDGE_VOICES[targetLang] || EDGE_VOICES[targetLang.split("-")[0]] || "en-US-GuyNeural";
}

export interface DubJob {
  id: string;
  status: "uploading" | "extracting_audio" | "transcribing" | "translating" | "generating_audio" | "subtitles" | "assembling" | "done" | "failed" | "cancelled";
  progress: number;
  inputFile: string;
  sourceLanguage: string;
  targetLanguage: string;
  outputPath?: string;
  error?: string;
  log: string[];
  createdAt: string;
  updatedAt: string;
}

const jobs = new Map<string, DubJob>();

export function getDubJobs(): DubJob[] {
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getDubJob(id: string): DubJob | undefined {
  return jobs.get(id);
}

export function startDubbing(params: {
  inputPath: string;
  sourceLanguage?: string;
  targetLanguage: string;
  ttsEngine?: string;
  edgeVoice?: string;
  subtitleMode?: string;
  model?: string;
}): DubJob {
  const id = `dub_${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const job: DubJob = {
    id, status: "extracting_audio", progress: 0,
    inputFile: params.inputPath,
    sourceLanguage: params.sourceLanguage || "auto",
    targetLanguage: params.targetLanguage,
    log: [], createdAt: now, updatedAt: now,
  };
  jobs.set(id, job);
  persistJobs();

  runPipeline(job, params).catch((e) => {
    job.status = "failed";
    job.error = safeMessage(e);
    job.updatedAt = new Date().toISOString();
    persistJobs();
  });

  return job;
}

function runFFmpeg(label: string, args: string[], timeout = 120000): Promise<void> {
  const ff = process.env.FFMPEG_PATH || "C:\\Windows\\system32\\ffmpeg.exe";
  if (!process.env.FFMPEG_PATH) process.env.FFMPEG_PATH = ff;
  const cmd = `"${ff}" ${args.map(a => `"${a}"`).join(" ")}`;
  console.log(`[ffmpeg][${label}] ${cmd.slice(0, 300)}`);
  return new Promise((resolve, reject) => {
    try {
      execSync(cmd, { timeout, windowsHide: true, stdio: "pipe", encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
      resolve();
    } catch (e: any) {
      const stderr = (e.stderr || e.stdout || e.message || "").toString().slice(-300);
      reject(new Error(`FFmpeg failed: ${stderr}`));
    }
  });
}

async function getVideoInfo(videoPath: string): Promise<{ duration: number; width: number; height: number }> {
  const ff = process.env.FFMPEG_PATH || "C:\\Windows\\system32\\ffmpeg.exe";
  try {
    const result = execSync(`"${ff}" -i "${videoPath}" -f null - 2>&1`, { timeout: 10000, windowsHide: true, encoding: "utf-8", maxBuffer: 1024 * 1024 });
    const err = result.toString();
    let duration = 0;
    const durMatch = err.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
    if (durMatch) duration = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseInt(durMatch[3]) + parseInt(durMatch[4]) / 100;
    let width = 0, height = 0;
    const streamMatch = err.match(/Stream.*Video.*?(\d+)x(\d+)/);
    if (streamMatch) { width = parseInt(streamMatch[1]); height = parseInt(streamMatch[2]); }
    return { duration, width, height };
  } catch { return { duration: 60, width: 1920, height: 1080 }; }
}

// ── Pipeline ─────────────────────────────────────────────────
async function runPipeline(job: DubJob, params: {
  inputPath: string; sourceLanguage?: string; targetLanguage: string;
  ttsEngine?: string; edgeVoice?: string; subtitleMode?: string; model?: string;
}) {
  const inputPath = params.inputPath;
  const workDir = join(DATA_DIR, job.id);
  mkdirSync(workDir, { recursive: true });
  const TTL = 120000;

  // Check FFmpeg
  const ff = process.env.FFMPEG_PATH || "C:\\Windows\\system32\\ffmpeg.exe";
  try {
    await runFFmpeg("check", ["-version"], 5000);
    job.log.push(`✅ FFmpeg OK (${ff})`);
  } catch (e) {
    throw new Error(`FFmpeg not found. You confirmed ffmpeg.exe is at C:\\Windows\\system32\\ffmpeg.exe\n` +
      `Open PowerShell as Admin and run this ONCE:\n` +
      `  [Environment]::SetEnvironmentVariable("FFMPEG_PATH", "C:\\Windows\\system32\\ffmpeg.exe", "Machine")\n` +
      `Then CLOSE this terminal, open NEW one, and restart server.`);
  }

  // Get video info
  const info = await getVideoInfo(inputPath);
  job.log.push(`📹 Video: ${info.width}x${info.height}, ${info.duration.toFixed(1)}s`);
  if (info.duration === 0) {
    job.log.push(`⚠️ Input file size: ${existsSync(inputPath) ? statSync(inputPath).size : 0} bytes`);
    // Try to probe the file
    try {
      const probe = execSync(`"${ff}" -v quiet -print_format json -show_format "${inputPath}"`, { timeout: 10000, windowsHide: true, encoding: "utf-8" });
      job.log.push(`🔍 Probe: ${probe.slice(0, 200)}`);
    } catch (e) { job.log.push(`🔍 Probe failed: ${safeMessage(e)}`); }
  }

  // Step 1: Extract audio
  job.status = "extracting_audio"; job.progress = 5; job.updatedAt = new Date().toISOString();
  const audioPath = join(workDir, "audio.wav");
  await runFFmpeg("extract_audio", ["-y", "-i", inputPath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", audioPath], TTL);
  job.log.push(`🔊 Audio extracted`);

  // Step 2: Transcribe with whisper
  job.status = "transcribing"; job.progress = 20; job.updatedAt = new Date().toISOString();
  let sourceText = "";
  try {
    const result = await transcribe(audioPath, params.sourceLanguage || "auto");
    sourceText = result.text;
    writeFileSync(join(workDir, "transcript.txt"), sourceText, "utf-8");
    job.log.push(`📝 Transcribed: ${sourceText.split(" ").length} words`);
  } catch (e) {
    job.log.push(`⚠️ Transcription: ${safeMessage(e)}`);
  }

  // Step 3: Translate
  job.status = "translating"; job.progress = 35; job.updatedAt = new Date().toISOString();
  let targetText = sourceText;
  if (sourceText && params.targetLanguage && params.sourceLanguage !== params.targetLanguage) {
    const fromLabel = params.sourceLanguage === "auto" ? "the detected language" : params.sourceLanguage;
    targetText = await translate(sourceText, fromLabel, params.targetLanguage, params.model || "deepseek/deepseek-chat");
    writeFileSync(join(workDir, "translated.txt"), targetText, "utf-8");
    job.log.push(`🌐 Translated to ${params.targetLanguage}: ${targetText.split(" ").length} words`);
  }

  // Step 4: Generate TTS + time-stretch
  job.status = "generating_audio"; job.progress = 50; job.updatedAt = new Date().toISOString();
  const finalAudio = join(workDir, "tts_final.wav");
  if (targetText && targetText.trim().length > 0) {
    const rawAudio = join(workDir, "tts_raw.mp3");
    const { generateTTS } = await import("./video/tts.ts");
    const voice = resolveVoice(params.targetLanguage, params.edgeVoice);
    job.log.push(`🗣️ TTS voice: ${voice} (lang: ${params.targetLanguage})`);
    const ttsOk = await generateTTS(targetText, rawAudio, params.ttsEngine || "edge", voice);
    if (!ttsOk) throw new Error("TTS generation failed");

    // Time-stretch to match original duration
    const rawDur = await audioDuration(rawAudio);
    if (Math.abs(rawDur - info.duration) > 0.5) {
      const ratio = Math.max(0.5, Math.min(2.0, rawDur / info.duration));
      // Convert to WAV (no MPEG frame sync issues)
      await runFFmpeg("atempo", ["-y", "-i", rawAudio, "-af", `atempo=${ratio}`, finalAudio], TTL);
      try { unlinkSync(rawAudio); } catch {}
      job.log.push(`⏱️ Audio stretched: ${rawDur.toFixed(1)}s → ${info.duration.toFixed(1)}s`);
    } else {
      // Just convert to WAV
      await runFFmpeg("tone", ["-y", "-i", rawAudio, finalAudio], TTL);
      try { unlinkSync(rawAudio); } catch {}
    }
  } else {
    // No text — use original audio from video (extract to WAV)
    job.log.push(`🔇 No transcription available (install whisper for speech-to-text). Using original audio.`);
    // Extract original audio as WAV from the input video
    await runFFmpeg("orig_audio", ["-y", "-i", inputPath, "-vn", "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "2", finalAudio], TTL);
  }

  // Step 5: Subtitles
  job.status = "subtitles"; job.progress = 65; job.updatedAt = new Date().toISOString();
  let srtPath: string | undefined;
  if (targetText) {
    const { textToSrt } = await import("./video/subtitles.ts");
    const srtPathActual = join(workDir, "subs.srt");
    try {
      const ok = await textToSrt(targetText, finalAudio, srtPathActual);
      if (ok && existsSync(srtPathActual)) {
        srtPath = srtPathActual;
        job.log.push(`📄 SRT subtitles generated (${existsSync(srtPathActual) ? statSync(srtPathActual).size : 0} bytes)`);
      } else {
        job.log.push(`⚠️ Subtitle generation returned: ${ok}, exists: ${existsSync(srtPathActual)}`);
      }
    } catch (e) {
      job.log.push(`⚠️ Subtitle error: ${safeMessage(e)}`);
    }
  }

  // Step 6: Assemble — replace audio only, no subtitle burning (font issues on Windows)
  job.status = "assembling"; job.progress = 80; job.updatedAt = new Date().toISOString();
  const outName = `dubbed_${job.id}.mp4`;
  const outPath = join(workDir, outName);

  // If subtitles were generated, save SRT separately (don't burn)
  if (srtPath) {
    const srtOut = join(workDir, `${outName}.srt`);
    try { unlinkSync(srtOut); } catch {}
    writeFileSync(srtOut, readFileSync(srtPath));
    job.log.push(`📄 SRT subtitles: ${srtOut}`);
  }

  // Replace audio — use aac for MP4 output, WAV input (no MPEG frame sync issues)
  if (!existsSync(finalAudio)) throw new Error("TTS audio file not found before assembly");
  const outSize = statSync(finalAudio).size;
  job.log.push(`🔊 TTS audio: ${(outSize/1024).toFixed(0)}KB`);
  await runFFmpeg("assemble", ["-y", "-i", inputPath, "-i", finalAudio,
    "-map", "0:v:0", "-map", "1:a",
    "-c:v", "libx264", "-crf", "23", "-preset", "fast",
    "-c:a", "aac", "-b:a", "192k",
    "-shortest", outPath], TTL * 3);

  job.status = "done"; job.progress = 100;
  job.outputPath = outPath;
  job.updatedAt = new Date().toISOString();
  job.log.push(`✅ Dubbed video ready`);
  persistJobs();
}

// ── Whisper Transcription ────────────────────────────────────
async function transcribe(audioPath: string, language: string): Promise<{ text: string; segments: any[] }> {
  const py = findPython();
  console.log(`[dub][whisper] Python: ${py}`);

  // Check if whisper is available
  try {
    execSync(`"${py}" -c "import whisper; print('ok')"`, { timeout: 10000, windowsHide: true, encoding: "utf-8", shell: "cmd.exe" });
    console.log(`[dub][whisper] ✅ whisper dostępny`);
  } catch (e) {
    console.log(`[dub][whisper] ❌ whisper nie dostępny`);
    return { text: "", segments: [] };
  }

  // Build the whisper script
  const audioSafe = audioPath.replace(/\\/g, "/"); // Python works with forward slashes on Windows
  const langArg = language === "auto" ? "" : language;
  const langCode = langArg ? `, language="${langArg}"` : "";
  const script = `import sys, json, whisper; model = whisper.load_model("base"); r = model.transcribe("${audioSafe}"${langCode}); print(json.dumps({"text":r["text"],"segments":[{"start":s["start"],"end":s["end"],"text":s["text"]}for s in r.get("segments",[])]}))`;

  try {
    const result = execSync(`"${py}" -c "${script.replace(/"/g, '\\"')}"`, { timeout: 300000, windowsHide: true, encoding: "utf-8", maxBuffer: 50 * 1024 * 1024, shell: "cmd.exe" });
    return JSON.parse(result);
  } catch (e: any) {
    const msg = safeMessage(e).slice(-200);
    return { text: "", segments: [] };
  }
}

// ── LLM Translation ──────────────────────────────────────────
async function translate(text: string, from: string, to: string, model: string): Promise<string> {
  const { sessionManager } = await import("./session/manager.ts");
  const { runAgent } = await import("./agent/runner.ts");
  const session = sessionManager.createSession(model, {
    systemPrompt: `Translate ${from} to ${to}. Output ONLY the translated text.`,
  });
  const result = await runAgent({ sessionId: session.id, message: text, modelRef: model, systemPrompt: session.systemPrompt, tools: false });
  return result.text.trim();
}

// ── Audio Duration ───────────────────────────────────────────
async function audioDuration(audioPath: string): Promise<number> {
  const ff = process.env.FFMPEG_PATH || "C:\\Windows\\system32\\ffmpeg.exe";
  try {
    const result = execSync(`"${ff}" -i "${audioPath}" -f null - 2>&1`, { timeout: 10000, windowsHide: true, encoding: "utf-8" });
    const m = result.toString().match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
    if (m) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 100;
  } catch {}
  return 60;
}
