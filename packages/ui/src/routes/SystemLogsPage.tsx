/**
 * SystemLogsPage — Real-time log viewer with filtering and search
 */
import { useState, useRef, useEffect } from "react";
import { ScrollText, Search, XCircle, AlertTriangle, Info, Bug, Download, Trash2, Pause, Play } from "lucide-react";

type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
interface LogEntry { id: string; time: string; level: LogLevel; module: string; message: string; detail?: string; }

const LEVEL_ICON: Record<LogLevel, React.ElementType> = { ERROR: XCircle, WARN: AlertTriangle, INFO: Info, DEBUG: Bug };
const LEVEL_COLOR: Record<LogLevel, string> = { ERROR: 'text-[#ef4444]', WARN: 'text-[#f59e0b]', INFO: 'text-[#3b82f6]', DEBUG: 'text-[#10b981]' };
const LEVEL_BG: Record<LogLevel, string> = { ERROR: 'bg-[rgba(239,68,68,0.08)] border-l-[#ef4444]', WARN: 'bg-[rgba(245,158,11,0.06)] border-l-[#f59e0b]', INFO: 'bg-transparent border-l-transparent', DEBUG: 'bg-transparent border-l-transparent' };

const MOCK_LOGS: LogEntry[] = [
  { id: "1", time: "01:56:32", level: "ERROR", module: "api", message: "POST /api/chat — Request timeout after 30s", detail: "Provider: DeepSeek · Session: abc123" },
  { id: "2", time: "01:56:15", level: "WARN", module: "quota", message: "Session xyz789 at 92% of daily quota" },
  { id: "3", time: "01:56:00", level: "INFO", module: "agent", message: "Agent switched: Main → Coder Agent" },
  { id: "4", time: "01:55:45", level: "DEBUG", module: "tool", message: "web_search completed · 1.2s · 3 results · 450 tokens" },
  { id: "5", time: "01:55:30", level: "INFO", module: "session", message: "Session started: abc123 · Agent: Main Assistant" },
  { id: "6", time: "01:55:00", level: "DEBUG", module: "plugin", message: "Plugin chromadb health check: OK" },
  { id: "7", time: "01:54:30", level: "WARN", module: "auth", message: "Failed login attempt from 192.168.1.100" },
  { id: "8", time: "01:54:00", level: "INFO", module: "cron", message: "Cron job 'Daily Summary' completed · Duration: 4.2s" },
  { id: "9", time: "01:53:00", level: "ERROR", module: "git", message: "Git push failed: remote rejected", detail: "Branch: feature/auth · Reason: pre-receive hook declined" },
  { id: "10", time: "01:52:00", level: "INFO", module: "api", message: "GET /api/health — 200 OK · 2ms" },
];

const MODULES = ["all", "api", "agent", "session", "tool", "plugin", "auth", "cron", "quota", "git"];

function SystemLogsPage() {
  const [logs] = useState<LogEntry[]>(MOCK_LOGS);
  const [filter, setFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = logs.filter(l => {
    if (filter !== "all" && l.module !== filter) return false;
    if (levelFilter.size > 0 && !levelFilter.has(l.level)) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase()) && !(l.detail?.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const toggleLevel = (level: string) => {
    setLevelFilter(prev => { const next = new Set(prev); next.has(level) ? next.delete(level) : next.add(level); return next; });
  };

  const stats = { error: logs.filter(l => l.level === 'ERROR').length, warn: logs.filter(l => l.level === 'WARN').length, info: logs.filter(l => l.level === 'INFO').length, debug: logs.filter(l => l.level === 'DEBUG').length };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(100,116,139,0.1)] border border-[rgba(100,116,139,0.2)] flex items-center justify-center">
              <ScrollText className="w-5 h-5 text-[#94a3b8]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#e8ecf2]">System Logs</h1>
              <p className="text-xs text-[#4a5068]">
                {filtered.length} entries · 🔴 {stats.error} · 🟡 {stats.warn} · 🔵 {stats.info} · 🟢 {stats.debug}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPaused(!paused)} className="btn-glass px-3 py-2 text-sm flex items-center gap-2">
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {paused ? "Resume" : "Pause"}
            </button>
            <button className="btn-glass px-3 py-2 text-sm flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button className="p-2 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#fca5a5] hover:bg-[rgba(239,68,68,0.2)] transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 px-6 py-3 border-b border-[rgba(255,255,255,0.04)] flex items-center gap-3 bg-[rgba(255,255,255,0.01)]">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a5068]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="glass-input pl-9 pr-3 py-1.5 text-xs w-full"
          />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="glass-input px-3 py-1.5 text-xs">
          {MODULES.map(m => <option key={m} value={m}>{m === 'all' ? 'All Modules' : m}</option>)}
        </select>
        <div className="flex gap-1.5">
          {(['ERROR','WARN','INFO','DEBUG'] as LogLevel[]).map(level => {
            const LIcon = LEVEL_ICON[level];
            const active = levelFilter.has(level);
            return (
              <button key={level} onClick={() => toggleLevel(level)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider border transition-all ${active ? LEVEL_BG[level].split(' ')[0] + ' ' + LEVEL_COLOR[level] + ' border-current' : 'text-[#4a5068] border-[rgba(255,255,255,0.06)] hover:text-[#8892a8]'}`}>
                <LIcon className="w-3 h-3" /> {level}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-[10px] text-[#4a5068] cursor-pointer ml-auto">
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="accent-[#00d4ff]" />
          Auto-scroll
        </label>
      </div>

      {/* Log entries */}
      <div ref={containerRef} className="flex-1 overflow-y-auto font-mono text-xs">
        {filtered.map(entry => {
          const LIcon = LEVEL_ICON[entry.level];
          return (
            <div key={entry.id} className={`px-6 py-2.5 border-l-2 hover:bg-[rgba(255,255,255,0.01)] transition-colors ${LEVEL_BG[entry.level]}`}>
              <div className="flex items-start gap-3">
                <span className="text-[#4a5068] shrink-0 w-16">{entry.time}</span>
                <LIcon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${LEVEL_COLOR[entry.level]}`} />
                <span className="text-[#4a5068] shrink-0 w-14 uppercase text-[10px] tracking-wider font-semibold">[{entry.module}]</span>
                <span className="text-[#8892a8] flex-1">{entry.message}</span>
              </div>
              {entry.detail && (
                <div className="ml-[calc(7rem+2.75rem)] mt-0.5 text-[#4a5068]">{entry.detail}</div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-full text-[#4a5068] text-sm">No log entries match your filters</div>
        )}
      </div>
    </div>
  );
}

export { SystemLogsPage };
export default SystemLogsPage;
