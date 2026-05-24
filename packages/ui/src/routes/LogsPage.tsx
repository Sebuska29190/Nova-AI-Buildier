import { useState, useEffect, useRef, useMemo } from "react";

export function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterComponent, setFilterComponent] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [connected, setConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (filterLevel !== "all") {
      result = result.filter((l) => l.level === filterLevel);
    }
    if (filterComponent) {
      result = result.filter((l) =>
        (l.component || l.source || "").toLowerCase().includes(filterComponent.toLowerCase())
      );
    }
    return result;
  }, [logs, filterLevel, filterComponent]);

  useEffect(() => {
    loadInitialLogs();
    connectSSE();
    return () => {
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  async function loadInitialLogs() {
    try {
      const res = await fetch("/api/logs?limit=500");
      const data = await res.json();
      setLogs(data.logs || data || []);
    } catch { /* silent */ }
  }

  function connectSSE() {
    const sse = new EventSource("/api/logs/stream");
    sseRef.current = sse;
    sse.onopen = () => setConnected(true);
    sse.onmessage = (ev) => {
      try {
        const entry = JSON.parse(ev.data);
        setLogs((prev) => {
          const next = [...prev, entry];
          return next.length > 2000 ? next.slice(-1000) : next;
        });
      } catch { /* ignore */ }
    };
    sse.onerror = () => {
      setConnected(false);
      setTimeout(() => {
        sse.close();
        connectSSE();
      }, 3000);
    };
  }

  function levelColor(level: string): string {
    switch (level?.toLowerCase()) {
      case "error": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "warn":
      case "warning": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "info": return "bg-sky-500/20 text-sky-400 border-sky-500/30";
      case "debug": return "bg-slate-500/20 text-slate-400 border-slate-500/30";
      case "trace": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  }

  function formatTime(ts: string | number): string {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Comprehensive Logs</h2>
          <p className="text-xs text-slate-400 mt-1">Filter system logs, search by keyword, and stream trace-level debugging messages directly.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] flex items-center gap-1 ${connected ? "text-emerald-400" : "text-slate-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-500"}`} />
            {connected ? "Live" : "Disconnected"}
          </span>
          <button className="btn-premium px-3 py-1.5 rounded text-xs" onClick={() => setLogs([])}>Clear</button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-medium">Level:</span>
            <select
              className="bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-[#00f2fe]"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
            >
              <option value="all">All</option>
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
              <option value="trace">Trace</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-medium">Component:</span>
            <input
              className="bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 w-40 placeholder-slate-600 focus:outline-none focus:border-[#00f2fe]"
              placeholder="Filter component..."
              value={filterComponent}
              onChange={(e) => setFilterComponent(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer ml-auto">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="accent-[#00f2fe]" />
            Auto-scroll
          </label>
        </div>
        <div className="mt-2 text-[10px] text-slate-500">
          {filteredLogs.length} / {logs.length} entries
        </div>
      </div>

      {/* Log Entries */}
      <div ref={scrollRef} className="glass-panel rounded-xl p-4 overflow-y-auto" style={{ maxHeight: "65vh" }}>
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-slate-400">No log entries</p>
            <p className="text-xs text-slate-500 mt-1">Waiting for incoming log data...</p>
          </div>
        ) : (
          <div className="space-y-1 font-mono">
            {filteredLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] py-1 border-b border-slate-800/30 last:border-0">
                <span className="text-slate-600 w-20 shrink-0">{formatTime(log.timestamp || log.time)}</span>
                <span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase shrink-0 ${levelColor(log.level)}`}>
                  {log.level || "info"}
                </span>
                <span className="text-slate-500 w-28 shrink-0 truncate" title={log.component || log.source}>
                  {log.component || log.source || "system"}
                </span>
                <span className="text-slate-300 break-words min-w-0">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
