import { useState, useEffect } from "react";
import { useToast } from "../lib/components/ui/Toast";

const LANGUAGES = [
  { value: "en", label: "English" }, { value: "fr", label: "French" }, { value: "es", label: "Spanish" },
  { value: "de", label: "German" }, { value: "it", label: "Italian" }, { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" }, { value: "pt", label: "Portuguese" }, { value: "ru", label: "Russian" },
  { value: "pl", label: "Polish" },
];

export function EditorPage() {
  const { showToast } = useToast();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLangIdx, setTargetLangIdx] = useState(0);
  const [ttsEngine, setTtsEngine] = useState("edge");
  const [subMode, setSubMode] = useState("burned");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadJobs(); }, []);

  async function loadJobs() {
    try {
      const res = await fetch("/api/dub/jobs");
      if (res.ok) { const d = await res.json(); setJobs(d.jobs || []); }
    } catch {}
  }

  async function startDubbing() {
    if (!videoFile) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("video", videoFile);
      fd.append("language", LANGUAGES[targetLangIdx].value);
      fd.append("sourceLanguage", sourceLang);
      fd.append("ttsEngine", ttsEngine);
      fd.append("subtitleMode", subMode);
      const res = await fetch("/api/dub/start", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setVideoFile(null);
      setVideoFileName("");
      await loadJobs();
    } catch (e: any) { showToast("Dub failed: " + (e.message || e), "error"); }
    setLoading(false);
  }

  function statusBadge(s: string) {
    if (s === "done") return "bg-emerald-500/20 text-emerald-400";
    if (s === "failed") return "bg-red-500/20 text-red-400";
    if (s === "extracting_audio" || s === "transcribing" || s === "translating" || s === "generating_audio" || s === "subtitles" || s === "assembling") return "bg-amber-500/20 text-amber-400";
    return "bg-slate-800 text-slate-500";
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Video Editor — AI Dubbing</h2>
          <p className="text-xs text-slate-400 mt-1">
            Transcribe, translate, and re-voice any MP4 video. Original video preserved.
          </p>
        </div>
      </div>

      {/* Upload Card */}
      <div className="glass-panel rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left: Upload */}
          <div className="space-y-4">
            <div>
              <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Source Video (MP4)</label>
              <label className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all ${videoFileName ? "border-[#6366f1]/50 bg-[#6366f1]/5" : "border-slate-700 bg-[#020408]/40 hover:border-slate-500"}`}>
                {videoFileName ? (
                  <div className="text-center">
                    <span className="text-sm text-white">\uD83C\uDFAC {videoFileName}</span>
                    <p className="text-[10px] text-slate-500 mt-1">Click to change</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="text-2xl">\uD83C\uDFAC</span>
                    <p className="text-xs text-slate-400 mt-2">Drop MP4 here or click to browse</p>
                    <p className="text-[9px] text-slate-600 mt-1">Any language, any length</p>
                  </div>
                )}
                <input type="file" accept=".mp4,video/mp4" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { setVideoFile(f); setVideoFileName(f.name); } }} />
              </label>
            </div>
          </div>

          {/* Right: Settings */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Source Language</label>
                <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                  <option value="auto">Auto-detect</option>
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Target Language</label>
                <select value={targetLangIdx} onChange={(e) => setTargetLangIdx(Number(e.target.value))}
                  className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                  {LANGUAGES.map((l, i) => <option key={i} value={i}>{l.label}</option>)}
                </select>
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
                </select>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Subtitles</label>
                <select value={subMode} onChange={(e) => setSubMode(e.target.value)}
                  className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                  <option value="burned">Burned In</option>
                  <option value="srt">SRT only</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
            <button onClick={startDubbing} disabled={loading || !videoFile}
              className="btn-premium w-full py-2.5 rounded-lg text-xs font-semibold disabled:opacity-40 mt-2">
              {loading ? "Processing..." : "\uD83C\uDFAC Dub Video"}
            </button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="glass-panel rounded-xl p-4 mb-6 border border-indigo-500/10">
        <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">\uD83D\uDCA1 How it works</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px] text-slate-400">
          <div className="p-2 bg-[#020408]/40 rounded"><strong>1. Extract</strong> audio from video</div>
          <div className="p-2 bg-[#020408]/40 rounded"><strong>2. Transcribe</strong> with Whisper</div>
          <div className="p-2 bg-[#020408]/40 rounded"><strong>3. Translate</strong> via AI</div>
          <div className="p-2 bg-[#020408]/40 rounded"><strong>4. Generate</strong> new voiceover</div>
          <div className="p-2 bg-[#020408]/40 rounded"><strong>5. Assemble</strong> — original video + new audio + subs</div>
        </div>
        <p className="text-[9px] text-slate-600 mt-2">
          Powered by FFmpeg + Whisper + Nova TTS.{' '}
          <a href="https://github.com/OmniVoice/OmniVoice-Studio" target="_blank" className="text-indigo-400 hover:underline">Inspired by OmniVoice-Studio</a>
          {' '}(Apache 2.0)
        </p>
      </div>

      {/* Job List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">Dubbing Jobs</h3>
          <button onClick={loadJobs} className="text-[10px] text-[#6366f1] hover:underline">Refresh</button>
        </div>
        {jobs.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">No dubbing jobs yet.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="glass-panel rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{job.inputFile?.split(/[/\\]/).pop() || job.id}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {job.sourceLanguage} \u2192 {job.targetLanguage}
                    {job.log?.length > 0 && <span className="ml-2 text-slate-600">\u00B7 {job.log[job.log.length - 1]}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {job.status === "done" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-emerald-400 font-mono">Done</span>
                      {job.outputPath && (
                        <a href={`/api/dub/download/${job.id}`} target="_blank"
                          className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded hover:bg-emerald-500/30">
                          Download
                        </a>
                      )}
                    </div>
                  ) : job.status === "failed" ? (
                    <div className="text-right">
                      <span className="text-[10px] text-red-400 font-mono">Failed</span>
                      {job.error && <p className="text-[9px] text-red-400/70 max-w-[200px] truncate mt-0.5">{job.error}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[10px] text-amber-400 font-mono">{job.progress}%</span>
                    </div>
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
