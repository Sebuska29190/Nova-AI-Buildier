import { useState, useEffect } from "react";

export function VideoEditorPage() {
  const [kimuStatus, setKimuStatus] = useState<string>("unknown");
  const [loading, setLoading] = useState(false);
  const [cmdText, setCmdText] = useState("");
  const [cmdResult, setCmdResult] = useState("");
  const [showIframe, setShowIframe] = useState(false);

  useEffect(() => { checkStatus(); }, []);

  async function checkStatus() {
    try {
      const res = await fetch("/api/kimu/status");
      if (res.ok) {
        const data = await res.json();
        setKimuStatus(data.status || "unknown");
        setShowIframe(data.ready === true || data.status === "running");
      } else {
        setKimuStatus("unavailable");
      }
    } catch {
      setKimuStatus("unavailable");
    }
  }

  async function startKimu() {
    setLoading(true);
    try {
      const res = await fetch("/api/kimu/start", { method: "POST" });
      if (res.ok) {
        setKimuStatus("running");
        setShowIframe(true);
      } else {
        const data = await res.json();
        setCmdResult(data.error || "Failed to start");
      }
    } catch (e: any) {
      setCmdResult(e.message);
    }
    setLoading(false);
  }

  async function sendCommand() {
    if (!cmdText.trim()) return;
    setCmdResult("");
    try {
      const res = await fetch("/api/kimu/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmdText.trim() }),
      });
      const data = await res.json();
      setCmdResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setCmdResult(e.message);
    }
  }

  function handleCmdKeydown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); sendCommand(); }
  }

  const statusColor = kimuStatus === "running"
    ? "bg-emerald-500"
    : kimuStatus === "starting"
    ? "bg-amber-500 animate-pulse"
    : "bg-rose-500";

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Kimu Video Editor</h2>
        <p className="text-xs text-slate-400 mt-1">Visual timeline-based video composer with drag-drop assets, transitions, and effects.</p>
      </div>

      {/* Status Bar */}
      <div className="glass-panel rounded-xl p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
            <span className="text-xs font-mono text-slate-300">
              {kimuStatus === "running" ? "Kimu Editor Active" : kimuStatus === "starting" ? "Starting..." : "Kimu Editor Offline"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkStatus}
            className="text-[10px] px-3 py-1.5 rounded-lg border border-slate-800 bg-[#020408]/60 text-slate-400 hover:border-slate-600 transition-all"
          >Refresh Status</button>
          {kimuStatus !== "running" && (
            <button
              onClick={startKimu}
              disabled={loading}
              className="btn-premium px-4 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-40"
            >{loading ? "Starting..." : "Launch Editor"}</button>
          )}
        </div>
      </div>

      {showIframe ? (
        /* Editor Frame */
        <div className="glass-panel rounded-xl overflow-hidden border border-slate-800 mb-6">
          <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-[11px] font-mono text-slate-500 ml-2">kimu-editor — localhost:3100</span>
            </div>
            <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg>
          </div>
          <div className="bg-[#020408] w-full" style={{ height: 520 }}>
            <iframe
              src="/api/kimu/editor"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Kimu Video Editor"
            />
          </div>
        </div>
      ) : (
        /* Offline Placeholder */
        <div className="glass-panel rounded-xl p-12 mb-6 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="22"/><line x1="17" y1="17" x2="22" y2="17"/></svg>
          </div>
          <p className="text-sm text-slate-400 mb-1">Editor is not running</p>
          <p className="text-xs text-slate-600 mb-4">Launch the Kimu editor daemon to start editing videos</p>
          <button
            onClick={startKimu}
            disabled={loading}
            className="btn-premium px-6 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
          >{loading ? "Starting..." : "Launch Editor"}</button>
        </div>
      )}

      {/* Command Console */}
      <div className="glass-panel rounded-xl p-4">
        <h3 className="text-xs font-bold text-white mb-3">Command Console</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={cmdText}
            onChange={(e) => setCmdText(e.target.value)}
            onKeyDown={handleCmdKeydown}
            placeholder="Type a command (e.g. /help, /open project, /render timeline)"
            className="flex-1 bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe]"
          />
          <button
            onClick={sendCommand}
            disabled={!cmdText.trim()}
            className="btn-premium px-4 py-2 rounded-lg text-[10px] font-semibold disabled:opacity-40"
          >Send</button>
        </div>
        {cmdResult && (
          <pre className="bg-[#020408]/60 border border-slate-800 rounded-lg p-3 text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-48 overflow-y-auto">{cmdResult}</pre>
        )}
      </div>
    </div>
  );
}
