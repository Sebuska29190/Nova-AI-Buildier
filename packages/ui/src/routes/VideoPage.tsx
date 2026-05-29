import { useState, useEffect } from "react";

interface StockPhoto {
  id: number; url: string; photographer: string;
  src: { medium: string; large: string; original: string }; alt: string;
}
interface StockVideo {
  id: number; url: string; photographer: string;
  duration: number; width: number; height: number;
  videoUrl: string; thumbnail: string;
}
interface MusicTrack {
  id: string; title: string; artist: string; duration: number; genre: string; url: string;
}
interface Scene {
  id: number; imageUrl: string; animationStyle: string; duration: number;
  effects: string[]; transition: string; overlayText: string; overlayPosition: "top" | "center" | "bottom";
}

const LANGUAGES = [
  { value: "en", label: "English" }, { value: "fr", label: "French" }, { value: "es", label: "Spanish" },
  { value: "de", label: "German" }, { value: "it", label: "Italian" }, { value: "pl", label: "Polish" },
  { value: "ja", label: "Japanese" }, { value: "zh", label: "Chinese" }, { value: "pt", label: "Portuguese" },
];
const ANIMATIONS = [
  { value: "ken-burns", label: "Ken Burns" }, { value: "zoom", label: "Zoom" },
  { value: "fade", label: "Fade" }, { value: "slide", label: "Slide" },
  { value: "cinematic-zoom", label: "Cinematic" }, { value: "parallax", label: "Parallax" },
  { value: "blur-zoom", label: "Blur Zoom" }, { value: "dolly-zoom", label: "Dolly Zoom" },
  { value: "sway", label: "Sway" }, { value: "parallax-deep", label: "Deep Parallax" },
  { value: "pulse", label: "Pulse" }, { value: "rotate-zoom", label: "Rotate Zoom" },
  { value: "shake", label: "Shake" }, { value: "cinematic-pan", label: "Cinematic Pan" },
  { value: "none", label: "Static" },
];
const EFFECTS_LIST = [
  "vignette", "glitch", "vhs", "grain", "bloom", "sepia", "invert", "color_shift", "pixelate",
  "lens_flare", "light_leak", "bokeh", "chromatic_aberration", "film_burn", "speed_ramp", "mirror", "thermal", "neon_glow",
];
const TRANSITIONS = [
  { value: "cut", label: "Cut" }, { value: "fade", label: "Fade" },
  { value: "dissolve", label: "Dissolve" }, { value: "wipe-left", label: "Wipe Left" },
  { value: "wipe-right", label: "Wipe Right" }, { value: "wipe-up", label: "Wipe Up" },
  { value: "wipe-down", label: "Wipe Down" }, { value: "zoom-in", label: "Zoom In" },
  { value: "zoom-out", label: "Zoom Out" }, { value: "blur", label: "Blur" },
  { value: "glitch-cut", label: "Glitch" }, { value: "light-leak", label: "Light Leak" },
  { value: "random", label: "Random" },
];
const EXPORT_PRESETS = [
  { id: "youtube", label: "YouTube", w: 1920, h: 1080, short: false },
  { id: "tiktok", label: "TikTok", w: 1080, h: 1920, short: true },
  { id: "instagram", label: "IG Reels", w: 1080, h: 1920, short: true },
  { id: "1080p", label: "1080p", w: 1920, h: 1080, short: false },
  { id: "4k", label: "4K", w: 3840, h: 2160, short: false },
  { id: "square", label: "Square 1:1", w: 1080, h: 1080, short: false },
];
const TTS_ENGINES = ["edge", "gtts", "elevenlabs", "openai"];

export function VideoPage() {
  // ─── State ───────────────────────────────────────────────────
  const [topic, setTopic] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [langIdx, setLangIdx] = useState(0);
  const [isShort, setIsShort] = useState(false);
  const [durationMin, setDurationMin] = useState(1);
  const [ttsEngine, setTtsEngine] = useState("edge");
  const [quality, setQuality] = useState("standard");
  const [subMode, setSubMode] = useState("story");
  const [imageCount, setImageCount] = useState(4);
  const [animationStyle, setAnimationStyle] = useState("cinematic-zoom");
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [exportPreset, setExportPreset] = useState("youtube");
  const [transition, setTransition] = useState("cut");
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const [subtitleAnimation, setSubtitleAnimation] = useState("static");
  const [composition, setComposition] = useState("single");

  // Audio / Video upload
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "audio" | "video">("text");
  const [sourceLang, setSourceLang] = useState("auto");

  // Music library
  const [showMusic, setShowMusic] = useState(false);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);

  // Stock
  const [showStock, setShowStock] = useState(false);
  const [stockQuery, setStockQuery] = useState("");
  const [stockPhotos, setStockPhotos] = useState<StockPhoto[]>([]);
  const [stockVideos, setStockVideos] = useState<StockVideo[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockTab, setStockTab] = useState<"photos" | "videos">("photos");
  const [selectedStockVideos, setSelectedStockVideos] = useState<StockVideo[]>([]);

  // Media type
  const [mediaType, setMediaType] = useState<"images" | "videos">("images");
  const [musicVideoMode, setMusicVideoMode] = useState(false);

  // Scenes
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState(0);

  // Jobs
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => { loadMusic(); }, []);

  async function loadJobs() {
    try { const res = await fetch("/api/video/jobs"); if (res.ok) setJobs((await res.json()).jobs || []); } catch {}
  }
  async function loadMusic() {
    try { const res = await fetch("/api/music/library"); if (res.ok) setMusicTracks((await res.json()).tracks || []); } catch {}
  }
  async function searchStock() {
    if (!stockQuery.trim()) return;
    setStockLoading(true);
    try {
      if (stockTab === "videos") {
        const res = await fetch(`/api/stock/video-search?q=${encodeURIComponent(stockQuery)}&page=1`);
        if (res.ok) setStockVideos((await res.json()).videos || []);
      } else {
        const res = await fetch(`/api/stock/search?q=${encodeURIComponent(stockQuery)}&page=1`);
        if (res.ok) setStockPhotos((await res.json()).photos || []);
      }
    } catch {}
    setStockLoading(false);
  }

  function toggleEffect(fx: string) {
    setSelectedEffects(p => p.includes(fx) ? p.filter(e => e !== fx) : [...p, fx]);
  }

  async function generateVideo() {
    // ── Dubbing mode ──
    if (inputMode === "video") {
      if (!videoFile) return;
      setLoading(true);
      try {
        const fd = new FormData();
        fd.append("video", videoFile);
        fd.append("language", LANGUAGES[langIdx]?.value || "en");
        fd.append("sourceLanguage", sourceLang);
        fd.append("ttsEngine", ttsEngine);
        fd.append("quality", quality);
        fd.append("subtitleMode", subMode === "off" ? "story" : subMode);
        fd.append("imageCount", String(imageCount));
        fd.append("animationStyle", animationStyle);
        if (selectedEffects.length > 0) fd.append("effects", selectedEffects.join(","));
        if (transition !== "cut") { fd.append("transition", transition); fd.append("transitionDuration", String(transitionDuration)); }
        if (subtitleAnimation !== "static") fd.append("subtitleAnimation", subtitleAnimation);
        if (composition !== "single") fd.append("composition", composition);
        fd.append("mediaType", mediaType);
        if (selectedStockVideos.length > 0) fd.append("stockVideos", JSON.stringify(selectedStockVideos.map(v => v.videoUrl)));
        const res = await fetch("/api/video/dub", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`API ${res.status}`);
        await loadJobs();
      } catch (e: any) { console.error("Dub failed:", e); }
      setLoading(false);
      return;
    }

    // ── Audio mode ──
    if (inputMode === "audio" && audioFile) {
      setLoading(true);
      try {
        const fd = new FormData();
        fd.append("audio", audioFile);
        fd.append("language", LANGUAGES[langIdx]?.value || "en");
        fd.append("duration", String(durationMin));
        fd.append("quality", quality);
        fd.append("subtitleMode", subMode === "off" ? "none" : subMode);
        fd.append("imageCount", String(imageCount));
        fd.append("animationStyle", animationStyle);
        if (selectedEffects.length > 0) fd.append("effects", selectedEffects.join(","));
        if (selectedMusic) fd.append("backgroundMusic", selectedMusic.url);
        if (transition !== "cut") { fd.append("transition", transition); fd.append("transitionDuration", String(transitionDuration)); }
        if (subtitleAnimation !== "static") fd.append("subtitleAnimation", subtitleAnimation);
        if (composition !== "single") fd.append("composition", composition);
        fd.append("mediaType", musicVideoMode ? "videos" : mediaType);
        if (selectedStockVideos.length > 0) fd.append("stockVideos", JSON.stringify(selectedStockVideos.map(v => v.videoUrl)));
        if (musicVideoMode) fd.append("musicVideoMode", "true");
        const res = await fetch("/api/video/generate", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`API ${res.status}`);
        await loadJobs();
      } catch (e: any) { console.error("Audio gen failed:", e); }
      setLoading(false);
      return;
    }

    // ── Text mode ──
    if (!topic.trim() && !scriptText.trim()) return;
    setLoading(true);
    try {
      const payload = {
        topic: topic.trim() || scriptText.trim().slice(0, 60),
        language: LANGUAGES[langIdx]?.value || "en",
        isShort: EXPORT_PRESETS.find(p => p.id === exportPreset)?.short || isShort,
        durationMin,
        ttsEngine: ttsEngine === "edge" ? undefined : ttsEngine,
        quality,
        subtitleMode: subMode === "off" ? "none" : "story",
        scriptText: scriptText.trim() || undefined,
        imageCount: scenes.length > 0 ? scenes.length : imageCount,
        animationStyle: scenes[selectedScene]?.animationStyle || animationStyle,
        effects: selectedEffects.length > 0 ? selectedEffects.join(",") : undefined,
        backgroundMusic: selectedMusic?.url || undefined,
        transition: transition !== "cut" ? transition : undefined,
        transitionDuration: transition !== "cut" ? transitionDuration : undefined,
        subtitleAnimation: subtitleAnimation !== "static" ? subtitleAnimation : undefined,
        composition: composition !== "single" ? composition : undefined,
        mediaType,
        stockVideos: selectedStockVideos.length > 0 ? selectedStockVideos.map(v => v.videoUrl) : undefined,
      };
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      await loadJobs();
    } catch (e: any) { console.error("Generate failed:", e); }
    setLoading(false);
  }

  return (
    <div className="max-w-6xl mx-auto w-full">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00f2fe]/20 to-[#4facfe]/20 border border-[#00f2fe]/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#00f2fe]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Video Pro Studio</h2>
            <p className="text-[10px] text-slate-500">Generate AI videos from text, audio, or dub existing MP4</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={exportPreset} onChange={(e) => setExportPreset(e.target.value)}
            className="bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-slate-300">
            {EXPORT_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label} ({p.w}x{p.h})</option>)}
          </select>
          <button onClick={generateVideo} disabled={loading || (inputMode === "video" ? !videoFile : inputMode === "audio" ? !audioFile : !topic.trim() && !scriptText.trim())}
            className="btn-premium px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 transition-all hover:scale-[1.02] flex items-center gap-2">
            {loading ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Processing...</>
            : <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> {inputMode === "video" ? "Dub Video" : "Generate"}</>}
          </button>
        </div>
      </div>

      {/* ─── Main Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        {/* ─── LEFT: Scenes + Timeline ──────────────────────────── */}
        <div className="col-span-3 space-y-3">
          <div className="glass-panel rounded-xl p-3 border border-slate-800/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Scenes</span>
              <div className="flex gap-1">
                {inputMode !== "video" && (
                  <button onClick={() => setShowStock(true)}
                    className="text-[9px] text-[#00f2fe] hover:underline">
                    {selectedStockVideos.length > 0 ? `Stock (${selectedStockVideos.length})` : "Stock"}
                  </button>
                )}
              </div>
            </div>
            {inputMode !== "video" && scenes.length > 0 ? (
              <div className="space-y-1.5">
                {scenes.map((scene, idx) => (
                  <div key={scene.id}
                    onClick={() => setSelectedScene(idx)}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                      selectedScene === idx ? "bg-[#00f2fe]/10 border-[#00f2fe]/40" : "bg-slate-900/40 border-slate-800/40 hover:border-slate-700"
                    }`}>
                    <div className="w-10 h-8 rounded bg-slate-800 flex items-center justify-center text-[8px] text-slate-600 overflow-hidden shrink-0">
                      {scene.imageUrl ? <img src={scene.imageUrl} className="w-full h-full object-cover" /> : <span>🎬</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] text-white truncate">Scene {idx + 1}</p>
                      <p className="text-[7px] text-slate-500">{scene.duration}s · {scene.animationStyle}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-slate-600 text-center py-3">Scenes auto-generated from topic</p>
            )}
          </div>

          {/* Timeline */}
          {inputMode !== "video" && scenes.length > 0 && (
            <div className="glass-panel rounded-xl p-2 border border-slate-800/60">
              <div className="flex justify-between text-[8px] text-slate-500 mb-1"><span>Timeline</span><span>{scenes.reduce((a, s) => a + s.duration, 0).toFixed(0)}s</span></div>
              <div className="h-5 rounded bg-slate-900/80 flex overflow-hidden">
                {scenes.map((s, i) => {
                  const total = scenes.reduce((a, s) => a + s.duration, 0);
                  const pct = total > 0 ? (s.duration / total) * 100 : 0;
                  return <div key={s.id} onClick={() => setSelectedScene(i)}
                    className={`h-full flex items-center justify-center text-[6px] text-white/50 border-r border-slate-800/40 last:border-r-0 cursor-pointer ${
                      selectedScene === i ? "bg-[#00f2fe]/20" : "bg-slate-800/60 hover:bg-slate-700/60"
                    }`} style={{ width: `${pct}%` }}>{pct > 8 ? `${Math.round(s.duration)}s` : ''}</div>;
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── CENTER: Form ──────────────────────────────────────── */}
        <div className="col-span-6 space-y-4">
          {/* Input Mode */}
          <div className="glass-panel rounded-xl p-4 border border-slate-800/60">
            <div className="flex gap-2 mb-4">
              {(["text", "audio", "video"] as const).map(mode => (
                <button key={mode} onClick={() => { setInputMode(mode); if (mode === "video") setSourceLang("auto"); }}
                  className={`flex-1 text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
                    inputMode === mode ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-600"
                  }`}>
                  {mode === "text" ? "✍️ Text" : mode === "audio" ? "🎤 Audio" : "🎬 Dubbing"}
                </button>
              ))}
            </div>

            {inputMode === "video" ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Source Video</label>
                  <label className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all ${videoFileName ? "border-[#00f2fe]/50 bg-[#00f2fe]/5" : "border-slate-700 bg-slate-900/30 hover:border-slate-500"}`}>
                    {videoFileName ? <span className="text-xs text-white">🎬 {videoFileName}</span> : <><span className="text-xs text-slate-400">⬇ Drop MP4 here</span><span className="text-[9px] text-slate-600">Transcribe, translate, re-voice</span></>}
                    <input type="file" accept=".mp4,video/mp4" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setVideoFile(f); setVideoFileName(f.name); } }} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Source Lang</label>
                    <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white">
                      <option value="auto">Auto</option>
                      {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Target Lang</label>
                    <select value={langIdx} onChange={(e) => setLangIdx(Number(e.target.value))} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white">
                      {LANGUAGES.map((l, i) => <option key={i} value={i}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ) : inputMode === "audio" ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Audio File</label>
                  <label className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all ${audioFileName ? "border-[#00f2fe]/50 bg-[#00f2fe]/5" : "border-slate-700 bg-slate-900/30 hover:border-slate-500"}`}>
                    {audioFileName ? <span className="text-xs text-white">🎵 {audioFileName}</span> : <span className="text-xs text-slate-400">⬇ Drop MP3 / WAV here</span>}
                    <input type="file" accept=".mp3,audio/mpeg,.wav,audio/wav" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAudioFile(f); setAudioFileName(f.name); } }} />
                  </label>
                </div>
                {audioFileName && (
                  <div className="flex items-center gap-3">
                    <label className="text-[9px] text-slate-400 uppercase tracking-wider">Music Video</label>
                    <button onClick={() => { setMusicVideoMode(!musicVideoMode); if (!musicVideoMode) setMediaType("videos"); }}
                      className={`relative w-9 h-5 rounded-full transition-all ${musicVideoMode ? "bg-[#00f2fe]" : "bg-slate-700"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${musicVideoMode ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                    <span className="text-[9px] text-slate-500">{musicVideoMode ? "Song = main audio, stock videos auto-matched" : "Narration mode (TTS)"}</span>
                  </div>
                )}
                {musicVideoMode && (
                  <div>
                    <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Video Keywords</label>
                    <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g. nature ocean sunset city night"
                      className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe]/40" />
                  </div>
                )}
                <p className="text-[9px] text-slate-600">{musicVideoMode ? "Keywords used to search matching stock videos on Pexels." : "Topic optional — video auto-generated from audio transcription."}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Topic / Prompt</label>
                  <textarea value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder="Describe your video concept..." rows={3}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe]/40 resize-none" />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Script (optional)</label>
                  <textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)}
                    placeholder="Write custom narration..." rows={2}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe]/40 resize-none" />
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="glass-panel rounded-xl p-4 border border-slate-800/60">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Language</label>
                <select value={langIdx} onChange={(e) => setLangIdx(Number(e.target.value))} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white">
                  {LANGUAGES.map((l, i) => <option key={i} value={i}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Duration (min)</label>
                <input type="number" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} min={0.5} max={10} step={0.5}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white" disabled={inputMode === "video"} />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Voice</label>
                <select value={ttsEngine} onChange={(e) => setTtsEngine(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white">
                  {TTS_ENGINES.map(e => <option key={e} value={e}>{e === 'edge' ? 'Edge TTS' : e === 'gtts' ? 'Google TTS' : e === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI TTS'}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Quality</label>
                <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white">
                  <option value="draft">Draft</option><option value="standard">Standard</option><option value="premium">Premium</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Format</label>
                <div className="flex gap-1">
                  <button onClick={() => setIsShort(false)}
                    className={`flex-1 text-[9px] px-2 py-1.5 rounded-lg border ${!isShort ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-slate-900/60 text-slate-400"}`}>16:9</button>
                  <button onClick={() => setIsShort(true)}
                    className={`flex-1 text-[9px] px-2 py-1.5 rounded-lg border ${isShort ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-slate-900/60 text-slate-400"}`}>9:16</button>
                </div>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">
                  {mediaType === "videos" ? "Video Clips" : "Images"}
                </label>
                <input type="number" value={imageCount} onChange={(e) => setImageCount(Number(e.target.value))} min={1} max={20}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white" disabled={inputMode === "video"} />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Media Type</label>
                <div className="flex gap-1">
                  <button onClick={() => setMediaType("images")}
                    className={`flex-1 text-[9px] px-2 py-1.5 rounded-lg border ${mediaType === "images" ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-slate-900/60 text-slate-400"}`}>Photos</button>
                  <button onClick={() => setMediaType("videos")}
                    className={`flex-1 text-[9px] px-2 py-1.5 rounded-lg border ${mediaType === "videos" ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-slate-900/60 text-slate-400"}`}>Videos</button>
                </div>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Subtitles</label>
                <select value={subMode} onChange={(e) => setSubMode(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white">
                  <option value="off">Off</option><option value="story">Burned In</option><option value="srt">SRT File</option><option value="both">Burned + SRT</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Animation</label>
                <select value={animationStyle} onChange={(e) => setAnimationStyle(e.target.value)} disabled={mediaType === "videos"}
                  className={`w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white ${mediaType === "videos" ? "opacity-40" : ""}`}>
                  {ANIMATIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Transition</label>
                <select value={transition} onChange={(e) => setTransition(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white">
                  {TRANSITIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {transition !== "cut" && (
                <div>
                  <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Transition Dur</label>
                  <input type="range" min={0.3} max={1.5} step={0.1} value={transitionDuration}
                    onChange={(e) => setTransitionDuration(Number(e.target.value))}
                    className="w-full mt-1 accent-[#00f2fe]" />
                  <p className="text-[8px] text-slate-500 text-center">{transitionDuration.toFixed(1)}s</p>
                </div>
              )}
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Text Animation</label>
                <select value={subtitleAnimation} onChange={(e) => setSubtitleAnimation(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white">
                  <option value="static">Static</option>
                  <option value="typewriter">Typewriter</option>
                  <option value="word-fade">Word Fade</option>
                  <option value="bounce-in">Bounce In</option>
                  <option value="highlight">Highlight</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Composition</label>
                <select value={composition} onChange={(e) => setComposition(e.target.value)} className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white">
                  <option value="single">Single</option>
                  <option value="picture-in-picture">Picture-in-Picture</option>
                  <option value="split-screen">Split Screen</option>
                  <option value="grid">2x2 Grid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Effects + Music */}
          <div className="glass-panel rounded-xl p-4 border border-slate-800/60">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-2">Visual Effects</label>
                <div className="flex flex-wrap gap-1.5">
                  {EFFECTS_LIST.map(fx => (
                    <button key={fx} onClick={() => toggleEffect(fx)}
                      className={`text-[9px] px-1.5 py-0.5 rounded border capitalize ${
                        selectedEffects.includes(fx) ? "border-[#00f2fe]/50 bg-[#00f2fe]/15 text-[#00f2fe]" : "border-slate-800 bg-slate-900/60 text-slate-500 hover:border-slate-600"
                      }`}>{fx.replace(/_/g, ' ')}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-2">Background Music</label>
                {selectedMusic ? (
                  <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg p-2">
                    <span>🎵</span>
                    <div className="flex-1 min-w-0"><p className="text-[10px] text-white truncate">{selectedMusic.title}</p><p className="text-[8px] text-slate-500">{selectedMusic.artist}</p></div>
                    <button onClick={() => setSelectedMusic(null)} className="text-slate-500 hover:text-red-400 text-[9px]">✕</button>
                  </div>
                ) : (
                  <div className="text-center"><p className="text-[9px] text-slate-600">No music selected</p></div>
                )}
                <button onClick={() => setShowMusic(true)} className="text-[9px] text-[#00f2fe] hover:underline mt-1">Browse library</button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Preview + Jobs ──────────────────────────────── */}
        <div className="col-span-3 space-y-3">
          <div className="glass-panel rounded-xl overflow-hidden border border-slate-800/60">
            <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
              <svg className="w-10 h-10 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            </div>
            <div className="p-2 text-center text-[9px] text-slate-600">Preview generated after job completes</div>
          </div>

          <div className="glass-panel rounded-xl p-3 border border-slate-800/60">
            <h3 className="text-[9px] text-slate-400 uppercase tracking-wider font-medium mb-2">Jobs</h3>
            <button onClick={loadJobs} className="text-[8px] text-[#00f2fe] hover:underline mb-2 block">Refresh</button>
            {jobs.length === 0 ? (
              <p className="text-[9px] text-slate-600 text-center py-4">No jobs yet</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {jobs.slice(0, 6).map((job) => (
                  <div key={job.id} className="flex items-center justify-between bg-slate-900/40 rounded-lg p-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] text-white truncate">{job.topic || `#${job.id?.slice(0, 8)}`}</p>
                      <span className={`text-[8px] font-mono ${
                        job.status === "done" ? "text-emerald-400" : job.status === "failed" ? "text-red-400" : "text-amber-400"
                      }`}>{job.status}</span>
                    </div>
                    {job.outputPath && <a href={`/api/video/download/${job.id}`} target="_blank" className="text-[9px] text-[#00f2fe] hover:underline shrink-0">View</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Stock Modal ──────────────────────────────────────────── */}
      {showStock && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowStock(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-[700px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Stock Media</h3>
              <button onClick={() => setShowStock(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 mb-3">
              <button onClick={() => setStockTab("photos")} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${stockTab === "photos" ? "bg-[#00f2fe]/20 text-[#00f2fe] border border-[#00f2fe]/30" : "text-slate-400 hover:text-white border border-transparent"}`}>Photos</button>
              <button onClick={() => setStockTab("videos")} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${stockTab === "videos" ? "bg-[#00f2fe]/20 text-[#00f2fe] border border-[#00f2fe]/30" : "text-slate-400 hover:text-white border border-transparent"}`}>Videos</button>
            </div>
            <div className="flex gap-2 mb-4">
              <input type="text" value={stockQuery} onChange={(e) => setStockQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchStock()}
                placeholder={stockTab === "videos" ? "Search stock videos..." : "Search free photos..."}
                className="flex-1 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500" />
              <button onClick={searchStock} disabled={stockLoading} className="btn-premium px-4 py-2 rounded-lg text-xs disabled:opacity-40">{stockLoading ? "..." : "Search"}</button>
            </div>

            {/* Photo results */}
            {stockTab === "photos" && stockPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {stockPhotos.map((photo) => (
                  <div key={photo.id} className="rounded-lg overflow-hidden border border-slate-800 hover:border-[#00f2fe]/50 transition-all cursor-pointer">
                    <img src={photo.src.medium} alt={photo.alt} className="w-full h-24 object-cover" loading="lazy" />
                    <div className="px-2 py-1 bg-slate-800/60">
                      <p className="text-[9px] text-slate-400 truncate">{photo.photographer}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {stockTab === "photos" && stockPhotos.length === 0 && !stockLoading && (
              <div className="text-center py-6 text-[10px] text-slate-600">Set PEXELS_API_KEY for stock photo access</div>
            )}

            {/* Video results */}
            {stockTab === "videos" && stockVideos.length > 0 && (
              <div className="space-y-2 mb-3">
                {selectedStockVideos.length > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[#00f2fe]">{selectedStockVideos.length} video(s) selected</span>
                    <button onClick={() => setSelectedStockVideos([])} className="text-[9px] text-slate-500 hover:text-white">Clear</button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {stockVideos.map((video) => {
                    const isSelected = selectedStockVideos.some(v => v.id === video.id);
                    return (
                      <div key={video.id} onClick={() => {
                        setSelectedStockVideos(prev => isSelected ? prev.filter(v => v.id !== video.id) : [...prev, video]);
                      }} className={`rounded-lg overflow-hidden border cursor-pointer transition-all ${isSelected ? "border-[#00f2fe] bg-[#00f2fe]/10" : "border-slate-800 hover:border-slate-600"}`}>
                        <div className="relative">
                          <img src={video.thumbnail} alt="" className="w-full h-28 object-cover" loading="lazy" />
                          <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] text-white px-1.5 py-0.5 rounded">{video.duration}s</span>
                          {isSelected && <span className="absolute top-1 left-1 bg-[#00f2fe] text-black text-[9px] font-bold px-1.5 py-0.5 rounded">Selected</span>}
                        </div>
                        <div className="px-2 py-1.5 bg-slate-800/60">
                          <p className="text-[9px] text-slate-400 truncate">{video.photographer} &middot; {video.width}x{video.height}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {stockTab === "videos" && stockVideos.length === 0 && !stockLoading && (
              <div className="text-center py-6 text-[10px] text-slate-600">Set PEXELS_API_KEY for stock video access</div>
            )}

            {stockTab === "videos" && selectedStockVideos.length > 0 && (
              <button onClick={() => setShowStock(false)} className="w-full btn-premium px-4 py-2 rounded-lg text-xs font-medium">
                Use {selectedStockVideos.length} Selected Video{selectedStockVideos.length > 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Music Modal ──────────────────────────────────────────── */}
      {showMusic && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowMusic(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-[450px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Music Library</h3>
              <button onClick={() => setShowMusic(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="space-y-1.5">
              <button onClick={() => { setSelectedMusic(null); setShowMusic(false); }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/40 text-[11px] text-slate-400 transition-all">No music (voice only)</button>
              {musicTracks.map((track) => (
                <div key={track.id} onClick={() => { setSelectedMusic(track); setShowMusic(false); }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                    selectedMusic?.id === track.id ? "bg-[#00f2fe]/10 border border-[#00f2fe]/30" : "hover:bg-slate-800/40 border border-transparent"
                  }`}>
                  <span className="text-lg">🎵</span>
                  <div className="flex-1 min-w-0"><p className="text-[11px] text-white font-medium truncate">{track.title}</p><p className="text-[9px] text-slate-500">{track.artist} · {track.genre}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
