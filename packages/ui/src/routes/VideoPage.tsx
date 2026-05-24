import { useState, useEffect } from "react";

const LANGUAGES = [
  { value: "en", label: "English" }, { value: "fr", label: "French" }, { value: "es", label: "Spanish" },
  { value: "de", label: "German" }, { value: "it", label: "Italian" }, { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" }, { value: "pt", label: "Portuguese" }, { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" }, { value: "pl", label: "Polish" },
];

const NICHES = [
  { name: "Custom", prompt: "" }, { name: "Travel Vlog", prompt: "Create a cinematic travel vlog..." },
  { name: "Tech Review", prompt: "Create an engaging tech review video..." },
  { name: "Cooking Tutorial", prompt: "Create a step-by-step cooking tutorial..." },
  { name: "Fitness Workout", prompt: "Create a high-energy fitness workout video..." },
  { name: "Gaming Montage", prompt: "Create an epic gaming montage..." },
  { name: "Educational Explain", prompt: "Create an educational explainer video..." },
  { name: "Product Showcase", prompt: "Create a professional product showcase..." },
  { name: "Nature Documentary", prompt: "Create a serene nature documentary..." },
  { name: "Music Lyric Video", prompt: "Create a dynamic music lyric video..." },
  { name: "News Summary", prompt: "Create a concise news summary video..." },
  { name: "Fashion Lookbook", prompt: "Create a stylish fashion lookbook video..." },
];

const ALL_EFFECTS = ["vignette", "glitch", "vhs", "grain", "bloom", "sepia", "invert", "color_shift", "pixelate"];

const ANIMATION_STYLES = [
  { value: "cinematic-zoom", label: "Cinematic", icon: "\u{1F3AC}" }, { value: "zoom", label: "Animated", icon: "\u{1F3A8}" },
  { value: "fade", label: "Modern", icon: "\u2728" }, { value: "vhs", label: "Retro", icon: "\u{1F4FA}" },
  { value: "none", label: "Minimal", icon: "\u25FB\uFE0F" }, { value: "blur-zoom", label: "Dramatic", icon: "\u{1F525}" },
  { value: "slide", label: "Corporate", icon: "\u{1F4BC}" }, { value: "ken-burns", label: "Storybook", icon: "\u{1F4D6}" },
];

type InputMode = "text" | "audio" | "video";

export function VideoPage() {
  const [topic, setTopic] = useState("");
  const [nicheName, setNicheName] = useState("Custom");
  const [langIdx, setLangIdx] = useState(0);
  const [isShort, setIsShort] = useState(false);
  const [durationMin, setDurationMin] = useState(1);
  const [ttsEngine, setTtsEngine] = useState("edge");
  const [imageEngine, setImageEngine] = useState("auto");
  const [quality, setQuality] = useState("standard");
  const [subMode, setSubMode] = useState("off");
  const [scriptText, setScriptText] = useState("");
  const [imageCount, setImageCount] = useState(4);
  const [animationStyle, setAnimationStyle] = useState("cinematic-zoom");
  const [imageStyle, setImageStyle] = useState("photorealistic");
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [jobs, setJobs] = useState<Array<{ id: string; status: string; topic: string; progress: number; error?: string; outputPath?: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadJobs(); }, []);

  function toggleEffect(effect: string) {
    setSelectedEffects((prev) =>
      prev.includes(effect) ? prev.filter((e) => e !== effect) : [...prev, effect]
    );
  }

  function handleNicheChange(name: string) {
    setNicheName(name);
    if (name !== "Custom") {
      const niche = NICHES.find((n) => n.name === name);
      if (niche?.prompt) setTopic(niche.prompt);
    }
  }

  async function generateVideo() {
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
        const res = await fetch("/api/video/dub", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`API ${res.status}`);
        await loadJobs();
      } catch (e: any) { console.error("Dub failed:", e); }
      setLoading(false);
      return;
    }

    if (!topic.trim() && !scriptText.trim() && !audioFile) return;
    setLoading(true);
    try {
      if (inputMode === "audio" && audioFile) {
        const fd = new FormData();
        fd.append("audio", audioFile);
        fd.append("language", LANGUAGES[langIdx]?.value || "en");
        fd.append("imageEngine", imageEngine);
        fd.append("quality", quality);
        fd.append("subtitleMode", "story");
        fd.append("imageCount", String(imageCount));
        fd.append("animationStyle", animationStyle);
        fd.append("imageStyle", imageStyle || "photorealistic");
        if (selectedEffects.length > 0) fd.append("effects", selectedEffects.join(","));
        if (nicheName !== "Custom") fd.append("nicheName", nicheName);
        const res = await fetch("/api/video/generate", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`API ${res.status}`);
        await loadJobs();
        setLoading(false);
        return;
      }

      const payload = {
        topic: topic.trim() || scriptText.trim().slice(0, 60),
        nicheName: nicheName === "Custom" ? undefined : nicheName,
        language: LANGUAGES[langIdx]?.value || "en",
        isShort,
        durationMin,
        ttsEngine: ttsEngine === "auto" ? undefined : ttsEngine,
        quality,
        subtitleMode: subMode === "off" ? "none" : "story",
        scriptText: scriptText.trim() || undefined,
        imageCount,
        animationStyle,
        imageStyle: imageStyle || undefined,
        effects: selectedEffects.length > 0 ? selectedEffects.join(",") : undefined,
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

  async function loadJobs() {
    try {
      const res = await fetch("/api/video/jobs");
      if (res.ok) { const data = await res.json(); setJobs(data.jobs || []); }
    } catch {}
  }

  function statusColor(s: string) {
    if (s === "done" || s === "completed") return "text-emerald-400";
    if (s === "failed" || s === "error") return "text-rose-400";
    if (s === "queued" || s === "processing" || s === "extracting_audio" || s === "transcribing" || s === "translating") return "text-amber-400";
    return "text-slate-400";
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Video Factory</h2>
        <p className="text-xs text-slate-400 mt-1">Generate AI-powered narrated videos or dub existing MP4 with translation.</p>
      </div>

      <div className="glass-panel rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            {/* Niche */}
            <div>
              <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Niche / Template</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {NICHES.map((niche) => (
                  <button key={niche.name} onClick={() => handleNicheChange(niche.name)}
                    className={`text-[10px] px-2 py-1.5 rounded-lg border transition-all truncate ${nicheName === niche.name ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-[#020408]/60 text-slate-400 hover:border-slate-600"}`}>
                    {niche.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Mode */}
            <div>
              <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Input Mode</label>
              <div className="flex gap-1.5 flex-wrap">
                {(["text", "audio", "video"] as InputMode[]).map((mode) => (
                  <button key={mode} onClick={() => { setInputMode(mode); if (mode === "video") setSourceLang("auto"); }}
                    className={`flex-1 text-[10px] px-3 py-1.5 rounded-lg border transition-all ${inputMode === mode ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-[#020408]/60 text-slate-400 hover:border-slate-600"}`}>
                    {mode === "text" ? "\u270F\uFE0F Text" : mode === "audio" ? "\uD83C\uDFA4 Audio" : "\uD83C\uDFAC Dubbing"}
                  </button>
                ))}
              </div>
            </div>

            {/* Video / Dubbing mode */}
            {inputMode === "video" ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Source Video (.mp4)</label>
                  <label className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all ${videoFileName ? "border-[#00f2fe]/50 bg-[#00f2fe]/5" : "border-slate-700 bg-[#020408]/40 hover:border-slate-500"}`}>
                    {videoFileName ? (
                      <><span className="text-xs text-white">\uD83C\uDFAC {videoFileName}</span><span className="text-[9px] text-slate-400">Click to change file</span></>
                    ) : (
                      <><span className="text-xs text-slate-400">\u2B07 Drop MP4 here or click</span><span className="text-[9px] text-slate-500">Transcribe, translate, re-voice, burn subtitles</span></>
                    )}
                    <input type="file" accept=".mp4,video/mp4" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) { setVideoFile(f); setVideoFileName(f.name); } }} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Source Language</label>
                    <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}
                      className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                      <option value="auto">Auto-detect</option>
                      {LANGUAGES.map((lang) => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Target Language</label>
                    <select value={langIdx} onChange={(e) => setLangIdx(Number(e.target.value))}
                      className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                      {LANGUAGES.map((lang, i) => <option key={i} value={i}>{lang.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ) : inputMode === "audio" ? (
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Audio File (.mp3)</label>
                <label className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all ${audioFileName ? "border-[#00f2fe]/50 bg-[#00f2fe]/5" : "border-slate-700 bg-[#020408]/40 hover:border-slate-500"}`}>
                  {audioFileName ? (
                    <><span className="text-xs text-white">\uD83C\uDFB5 {audioFileName}</span><span className="text-[9px] text-slate-400">Click to change</span></>
                  ) : (
                    <><span className="text-xs text-slate-400">\u2B07 Drop MP3 here</span></>
                  )}
                  <input type="file" accept=".mp3,audio/mpeg" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAudioFile(f); setAudioFileName(f.name); } }} />
                </label>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Topic / Prompt</label>
                  <textarea value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder="Describe your video concept..." rows={4}
                    className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe] resize-none" />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Narration Script (optional)</label>
                  <textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)}
                    placeholder="Write custom narration..." rows={3}
                    className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe] resize-none" />
                </div>
              </>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Language</label>
                <select value={inputMode === "video" ? langIdx : langIdx} onChange={(e) => setLangIdx(Number(e.target.value))}
                  className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                  {LANGUAGES.map((lang, i) => <option key={i} value={i}>{lang.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Duration (min)</label>
                <input type="number" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} min={0.5} max={10} step={0.5}
                  className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" disabled={inputMode === "video"} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Voice Engine</label>
                <select value={ttsEngine} onChange={(e) => setTtsEngine(e.target.value)}
                  className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                  <option value="edge">Edge TTS</option>
                  <option value="gtts">Google TTS</option>
                  <option value="elevenlabs">ElevenLabs</option>
                  <option value="openai">OpenAI TTS</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Quality</label>
                <select value={quality} onChange={(e) => setQuality(e.target.value)}
                  className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                  <option value="draft">Draft</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Format</label>
                <div className="flex gap-2">
                  <button onClick={() => setIsShort(false)}
                    className={`flex-1 text-[10px] px-2 py-1.5 rounded-lg border ${!isShort ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-[#020408]/60 text-slate-400"}`}>Standard</button>
                  <button onClick={() => setIsShort(true)}
                    className={`flex-1 text-[10px] px-2 py-1.5 rounded-lg border ${isShort ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-[#020408]/60 text-slate-400"}`}>Short (9:16)</button>
                </div>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Images</label>
                <input type="number" value={imageCount} onChange={(e) => setImageCount(Number(e.target.value))} min={1} max={20}
                  className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" disabled={inputMode === "video"} />
              </div>
            </div>

            <div>
              <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Subtitles</label>
              <select value={subMode} onChange={(e) => setSubMode(e.target.value)}
                className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                <option value="off">Off</option>
                <option value="story">Burned In</option>
                <option value="srt">SRT File</option>
                <option value="both">Burned + SRT</option>
              </select>
            </div>

            {/* Animation Style */}
            <div>
              <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Animation Style</label>
              <div className="grid grid-cols-4 gap-2">
                {ANIMATION_STYLES.map((style) => (
                  <button key={style.value} onClick={() => setAnimationStyle(style.value)}
                    className={`flex flex-col items-center gap-1 text-[10px] px-2 py-2 rounded-lg border ${animationStyle === style.value ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-[#020408]/60 text-slate-400 hover:border-slate-600"}`}>
                    <span>{style.icon}</span>
                    <span>{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Effects */}
            <div>
              <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Visual Effects</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_EFFECTS.map((effect) => (
                  <button key={effect} onClick={() => toggleEffect(effect)}
                    className={`text-[10px] px-2 py-1 rounded-lg border capitalize ${selectedEffects.includes(effect) ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-[#020408]/60 text-slate-400 hover:border-slate-600"}`}>
                    {effect.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end mt-5">
          <button onClick={generateVideo} disabled={loading || (inputMode === "video" ? !videoFile : !topic.trim() && !scriptText.trim() && !audioFile)}
            className="btn-premium px-6 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-40">
            {loading ? "Processing..." : inputMode === "video" ? "Dub Video" : "Generate Video"}
          </button>
        </div>
      </div>

      {/* Job List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">Jobs</h3>
          <button onClick={loadJobs} className="text-[10px] text-[#00f2fe] hover:underline">Refresh</button>
        </div>
        {jobs.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">No jobs yet.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="glass-panel rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{job.topic}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">#{job.id.slice(0, 8)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {job.progress > 0 && job.progress < 100 ? (
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-800 rounded-full h-1.5">
                        <div className="bg-[#00f2fe] h-1.5 rounded-full" style={{ width: `${job.progress}%` }} />
                      </div>
                      <span className={`text-[10px] font-mono ${statusColor(job.status)}`}>{job.progress}%</span>
                    </div>
                  ) : (
                    <span className={`text-[10px] font-mono ${statusColor(job.status)}`}>
                      {job.status === "done" ? "Done" : job.status === "failed" ? "Failed" : job.status}
                    </span>
                  )}
                  {job.outputPath && (
                    <a href={`/api/video/download/${job.id}`} target="_blank" className="text-[10px] text-[#00f2fe] hover:underline">View</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
