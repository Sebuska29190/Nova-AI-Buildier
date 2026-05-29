export interface ImagePrompt {
  prompt: string;
  timestamp: string | null;
  seconds: number | null;
}

export interface SfxCue {
  timestamp: string;
  seconds: number;
  name: string;
}

export interface Niche {
  nombre: string;
  tono: string;
  narrativa: string;
  hooks: string[];
  titulo_formatos: string[];
  titulo_ejemplos: string[];
  cliches_prohibidos: string[];
  imagen_estilo: string;
  tags: string[];
}

export interface StoryData {
  title: string;
  story: string;
  nicheId: string;
  niche: Niche;
  imagePrompts: ImagePrompt[];
  sfxCues: SfxCue[];
  hasTimestamps: boolean;
}

export interface VideoParams {
  topic: string;
  model?: string;
  duration?: number;
  isShort?: boolean;
  quality?: "high" | "medium" | "low" | "minimal";
  ttsEngine?: "auto" | "edge" | "gemini" | "elevenlabs";
  imageEngine?: "auto" | "web-search" | "gemini-web" | "placeholder";
  subtitleMode?: "auto" | "story" | "none" | "custom";
  subtitleText?: string;
  language?: string;
  edgeVoice?: string;
  sourceDir?: string;
  outputDir?: string;
  nicheName?: string;
  scriptText?: string;
  // NEW: user controls
  imageCount?: number;       // 1-20, default 6
  animationStyle?: string;   // "ken-burns" | "zoom" | "fade" | "slide" | "none" | "cinematic-zoom" | "parallax" | "whip-pan" | "random" | "blur-zoom" | "dolly-zoom" | "sway" | "parallax-deep" | "pulse" | "rotate-zoom" | "shake" | "cinematic-pan"
  imageStyle?: string;       // visual style hint e.g. "cinematic", "anime", "3d render"
  effects?: string;          // comma-separated visual effects: "vignette,glitch,vhs,grain,bloom"
  audioPath?: string;        // pre-recorded audio file path (skip TTS, use duration from file)
  useAudioEffects?: boolean; // add music-like effects to uploaded audio (reverb, compression etc.)
  transcriptionSegments?: Array<{ text: string; start: number; end: number }>; // Whisper timestamps
  transition?: string;       // clip transition: "cut" | "fade" | "dissolve" | "wipe-left" | "wipe-right" | "wipe-up" | "wipe-down" | "zoom-in" | "zoom-out" | "blur" | "glitch-cut" | "light-leak" | "random"
  transitionDuration?: number; // 0.3-1.5s, default 0.5
  subtitleAnimation?: string; // subtitle animation: "static" | "typewriter" | "word-fade" | "bounce-in" | "highlight"
  composition?: string;       // composition mode: "single" | "picture-in-picture" | "split-screen" | "grid"
  /** Path to input video file for dubbing (MP4) */
  inputVideoPath?: string;
  /** Source language of input video (for translation dubbing) */
  sourceLanguage?: string;
  /** Media type: use stock images or stock video clips */
  mediaType?: "images" | "videos";
  /** Pre-selected stock video URLs (from stock search) */
  stockVideos?: string[];
  /** Music video mode: use uploaded audio as-is, no TTS, no bg music, no effects */
  musicVideoMode?: boolean;
}

export interface VideoJob {
  id: string;
  status: "queued" | "generating_story" | "generating_audio" | "generating_images" | "subtitles" | "assembling" | "done" | "failed" | "cancelled";
  topic: string;
  progress: number;
  outputPath?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  meta?: Record<string, unknown>;
  log?: string[];
}

export const QUALITY_PRESETS: Record<string, { crf: string; preset: string; maxrate: string; bufsize: string }> = {
  high:    { crf: "18", preset: "slow",      maxrate: "8M",  bufsize: "16M" },
  medium:  { crf: "23", preset: "medium",    maxrate: "4M",  bufsize: "8M" },
  low:     { crf: "28", preset: "fast",      maxrate: "2M",  bufsize: "4M" },
  minimal: { crf: "32", preset: "veryfast",  maxrate: "1M",  bufsize: "2M" },
};

export function parseTimestamp(ts: string): number {
  const m = ts.match(/^(\d+):(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  return 0;
}

export function safeFilename(title: string, maxLen = 50): string {
  let s = title.replace(/[^\x20-\x7E]/g, "").replace(/[^\w\s-]/g, "").trim();
  s = s.replace(/[\s-]+/g, "_").slice(0, maxLen).toLowerCase().replace(/_$/, "");
  return s || "video";
}

// Language table matching CheetahClaws 1:1
export interface LangEntry {
  flag: string;
  name: string;
  whisperCode: string;
  edgeVoice: string;
  storyInstruction: string;
}

export const VIDEO_LANGUAGES: LangEntry[] = [
  { flag: "🇨🇳", name: "Chinese",       whisperCode: "zh",   edgeVoice: "zh-CN-YunxiNeural",   storyInstruction: "Write the story ENTIRELY in Simplified Chinese (中文)." },
  { flag: "🇺🇸", name: "English",       whisperCode: "en",   edgeVoice: "en-US-GuyNeural",      storyInstruction: "Write the story ENTIRELY in English." },
  { flag: "🇪🇸", name: "Spanish",       whisperCode: "es",   edgeVoice: "es-ES-AlvaroNeural",   storyInstruction: "Write the story ENTIRELY in Spanish." },
  { flag: "🇫🇷", name: "French",        whisperCode: "fr",   edgeVoice: "fr-FR-HenriNeural",    storyInstruction: "Write the story ENTIRELY in French." },
  { flag: "🇯🇵", name: "Japanese",      whisperCode: "ja",   edgeVoice: "ja-JP-KeitaNeural",    storyInstruction: "Write the story ENTIRELY in Japanese (日本語)." },
  { flag: "🇰🇷", name: "Korean",        whisperCode: "ko",   edgeVoice: "ko-KR-InJoonNeural",   storyInstruction: "Write the story ENTIRELY in Korean (한국어)." },
  { flag: "🇩🇪", name: "German",        whisperCode: "de",   edgeVoice: "de-DE-ConradNeural",   storyInstruction: "Write the story ENTIRELY in German." },
  { flag: "🇵🇹", name: "Portuguese",    whisperCode: "pt",   edgeVoice: "pt-BR-AntonioNeural",  storyInstruction: "Write the story ENTIRELY in Portuguese." },
  { flag: "🇷🇺", name: "Russian",       whisperCode: "ru",   edgeVoice: "ru-RU-DmitryNeural",   storyInstruction: "Write the story ENTIRELY in Russian." },
  { flag: "🇵🇱", name: "Polish",        whisperCode: "pl",   edgeVoice: "pl-PL-MarekNeural",    storyInstruction: "Write the story ENTIRELY in Polish (polski)." },
];
