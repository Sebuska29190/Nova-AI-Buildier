import { useState, useEffect } from "react";

// ─── Prosty Markdown renderer (bez zależności) ──────────────────
function renderMarkdown(text: string): string {
  if (!text) return "";

  let html = text
    // Escaping HTML
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Headers
    .replace(/^###### (.*$)/gm, '<h6 class="text-xs font-bold text-white mt-3 mb-1">$1</h6>')
    .replace(/^##### (.*$)/gm, '<h5 class="text-sm font-bold text-white mt-3 mb-1">$1</h5>')
    .replace(/^#### (.*$)/gm, '<h4 class="text-sm font-bold text-[#00f2fe] mt-4 mb-1">$1</h4>')
    .replace(/^### (.*$)/gm, '<h3 class="text-base font-bold text-[#00f2fe] mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-lg font-bold text-white mt-5 mb-2 border-b border-slate-800/50 pb-1">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold text-white mt-5 mb-3">$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-[#020408]/60 text-cyan-300 px-1 py-0.5 rounded text-[10px] font-mono">$1</code>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<div class="bg-[#020408]/80 border border-slate-800 rounded-lg p-3 my-2 overflow-x-auto"><pre class="text-[10px] text-cyan-300 font-mono leading-relaxed whitespace-pre-wrap">$2</pre></div>')
    // Tables
    .replace(/\n\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n)*)/g, (_, headerRow: string, bodyRows: string) => {
      const headers = headerRow.split("|").map((h: string) => h.trim()).filter(Boolean);
      const rows = bodyRows.trim().split("\n").map((row: string) =>
        row.split("|").map((c: string) => c.trim()).filter(Boolean)
      );
      let tableHtml = '<div class="overflow-x-auto my-3"><table class="w-full text-[10px] border-collapse">';
      tableHtml += '<thead><tr>' + headers.map((h: string) => `<th class="text-left text-slate-300 font-bold px-2 py-1 border-b border-slate-700">${h}</th>`).join("") + '</tr></thead>';
      tableHtml += '<tbody>';
      for (const row of rows) {
        tableHtml += '<tr>' + row.map((c: string) => `<td class="text-slate-400 px-2 py-1 border-b border-slate-800/50">${c}</td>`).join("") + '</tr>';
      }
      tableHtml += '</tbody></table></div>';
      return tableHtml;
    })
    // Lists
    .replace(/^\s*[-*]\s+(.*)/gm, '<li class="text-slate-400 text-[11px] ml-4 list-disc">$1</li>')
    .replace(/^\s*\d+\.\s+(.*)/gm, '<li class="text-slate-400 text-[11px] ml-4 list-decimal">$1</li>')
    // Blockquotes
    .replace(/^>\s+(.*)/gm, '<blockquote class="border-l-2 border-[#00f2fe]/30 pl-3 text-slate-400 text-[11px] italic my-2">$1</blockquote>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-slate-800 my-3" />')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p class="text-slate-400 text-[11px] leading-relaxed mb-2">')
    // Line breaks
    .replace(/\n/g, '<br />');

  html = '<p class="text-slate-400 text-[11px] leading-relaxed mb-2">' + html + '</p>';
  // Fix empty paragraphs
  html = html.replace(/<p[^>]*>\s*<br\s*\/>\s*<\/p>/g, "");
  return html;
}

// ─── Copy to clipboard hook ────────────────────────────────────
function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };
  return { copiedId, copy };
}

// ─── Helpers ───────────────────────────────────────────────────
function isAgentReport(memory: any): boolean {
  const tags = memory.tags || [];
  const name = (memory.name || "").toLowerCase();
  return tags.includes("agent-report") || name.startsWith("agent-report-");
}

function extractReportMeta(content: string): { agent: string; runId: string; model: string; duration: string } {
  const agent = content.match(/\*\*Agent:\*\*\s*(.+)/)?.[1] || "";
  const runId = content.match(/\*\*Run ID:\*\*\s*(.+)/)?.[1] || "";
  const model = content.match(/\*\*Model:\*\*\s*(.+)/)?.[1] || "";
  const started = content.match(/\*\*Started:\*\*\s*(.+)/)?.[1] || "";
  const completed = content.match(/\*\*Completed:\*\*\s*(.+)/)?.[1] || "";
  let duration = "";
  if (started && completed) {
    const s = new Date(started).getTime();
    const c = new Date(completed).getTime();
    if (!isNaN(s) && !isNaN(c)) {
      const diff = c - s;
      duration = diff > 1000 ? `${(diff / 1000).toFixed(1)}s` : `${diff}ms`;
    }
  }
  return { agent, runId, model, duration };
}

function truncate(text: string, max = 120) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function importanceColor(level: string) {
  switch (level?.toLowerCase()) {
    case "high":   return "bg-red-950 text-red-400 border-red-900/30";
    case "medium": return "bg-amber-950 text-amber-400 border-amber-900/30";
    case "low":    return "bg-slate-800 text-slate-400 border-slate-700/30";
    default:       return "bg-slate-800 text-slate-500 border-slate-700/30";
  }
}

// ─── Agent Report Card ─────────────────────────────────────────
function AgentReportCard({ memory, onDelete }: { memory: any; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { copiedId, copy } = useCopy();
  const meta = extractReportMeta(memory.content || "");

  return (
    <div className="glass-panel rounded-xl p-5 transition-all border border-[#00f2fe]/10 hover:border-[#00f2fe]/20">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00f2fe] to-[#4facfe] flex items-center justify-center text-[10px] font-bold text-black shrink-0">
            {meta.agent.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-white truncate flex items-center gap-2">
              📋 {meta.agent || memory.name || "Agent Report"}
              <span className="text-[9px] bg-indigo-950/60 text-indigo-400 border border-indigo-900/30 px-1.5 py-0.5 rounded font-mono">REPORT</span>
            </h3>
          </div>
        </div>
        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${importanceColor(memory.importance || memory.importance_level)} shrink-0`}>
          {(memory.importance || memory.importance_level || "medium").toUpperCase()}
        </span>
      </div>

      {/* Meta info row */}
      <div className="flex flex-wrap gap-2 mb-3 text-[9px] text-slate-500 font-mono">
        {meta.runId && <span className="bg-[#020408]/40 px-1.5 py-0.5 rounded">🆔 {meta.runId.slice(0, 12)}</span>}
        {meta.model && <span className="bg-[#020408]/40 px-1.5 py-0.5 rounded">🤖 {meta.model}</span>}
        {meta.duration && <span className="bg-[#020408]/40 px-1.5 py-0.5 rounded">⏱ {meta.duration}</span>}
      </div>

      {/* Preview */}
      <div
        className="text-[11px] text-slate-400 mb-3 leading-relaxed line-clamp-3 [&_br]:hidden"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(truncate(memory.content || "", 200)) }}
      />

      {/* Tags */}
      {memory.tags && memory.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {memory.tags.map((tag: string, i: number) => (
            <span key={i} className="text-[9px] bg-[#020408]/60 text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded font-mono">
              {tag?.name ?? tag}
            </span>
          ))}
        </div>
      )}

      {/* Timestamp */}
      {memory.created_at && (
        <p className="text-[9px] text-slate-600 mb-3">📅 {new Date(memory.created_at).toLocaleString()}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          onClick={() => setExpanded(!expanded)}>
          <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          {expanded ? "Hide Full Report" : "View Full Report"}
        </button>

        <button className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-1"
          onClick={() => copy(memory.id, memory.content || "")}>
          {copiedId === memory.id ? (
            <>✅ Copied</>
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </>
          )}
        </button>

        <button className="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1 rounded text-[10px] transition-all ml-auto"
          onClick={() => onDelete(memory.id)}>
          Delete
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-800/50">
          <div
            className="prose prose-invert max-w-none text-[11px] leading-relaxed [&_p]:text-slate-400 [&_h2]:text-white [&_h3]:text-[#00f2fe] [&_strong]:text-white [&_code]:text-cyan-300 [&_code]:bg-[#020408]/60 [&_pre]:bg-[#020408]/80 [&_pre]:border [&_pre]:border-slate-800 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_th]:text-slate-300 [&_th]:border-b [&_th]:border-slate-700 [&_td]:text-slate-400 [&_td]:border-b [&_td]:border-slate-800/50 [&_hr]:border-slate-800"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(memory.content || "") }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Regular Memory Card ───────────────────────────────────────
function MemoryCard({ memory, onDelete }: { memory: any; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { copiedId, copy } = useCopy();

  return (
    <div className="glass-panel rounded-xl p-5 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          <h3 className="font-bold text-sm text-white truncate">{memory.name || "Unnamed"}</h3>
        </div>
        {(memory.importance || memory.importance_level) && (
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${importanceColor(memory.importance || memory.importance_level)} shrink-0`}>
            {(memory.importance || memory.importance_level).toUpperCase()}
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">{truncate(memory.content || memory.description || "")}</p>

      {memory.tags && memory.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {memory.tags.map((tag: string, i: number) => (
            <span key={i} className="text-[9px] bg-[#020408]/60 text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded font-mono">{tag?.name ?? tag}</span>
          ))}
        </div>
      )}

      {(memory.created_at || memory.updated_at) && (
        <p className="text-[9px] text-slate-600 mb-3">
          {memory.updated_at ? "Updated: " + new Date(memory.updated_at).toLocaleString() : "Created: " + new Date(memory.created_at).toLocaleString()}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button className="text-[10px] text-slate-400 hover:text-white transition-colors"
          onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide Details" : "View Details"}
        </button>

        <button className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-1"
          onClick={() => copy(memory.id, JSON.stringify(memory, null, 2))}>
          {copiedId === memory.id ? (
            <>✅ Copied</>
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </>
          )}
        </button>

        <button className="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1 rounded text-[10px] transition-all ml-auto"
          onClick={() => onDelete(memory.id)}>
          Delete
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/50">
          <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
            {JSON.stringify(memory, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export function MemoryPage() {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "reports" | "memories">("all");

  useEffect(() => { loadMemories(); }, []);

  async function loadMemories() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/memory");
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load memories");
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }

  async function deleteMemory(id: string) {
    if (!confirm("Delete this memory entry?")) return;
    try {
      await fetch(`/api/memory/${id}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to delete memory");
    }
  }

  async function searchMemories(query: string) {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setMemories(data.results || []);
    } catch (e: any) {
      setErrorMsg(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    if (searchQuery.trim()) {
      searchMemories(searchQuery.trim());
    } else {
      loadMemories();
    }
  }

  // Filtrowanie
  const filtered = memories.filter((m) => {
    if (filter === "reports") return isAgentReport(m);
    if (filter === "memories") return !isAgentReport(m);
    return true;
  });

  const reportCount = memories.filter(isAgentReport).length;
  const memoryCount = memories.length - reportCount;

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">🧠 Memory DB</h2>
          <p className="text-xs text-slate-400 mt-1">
            Agent reports & persistent memory records
            {!loading && <span className="ml-2 text-[10px] text-slate-600">({memories.length} total)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onClick={loadMemories}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="glass-panel rounded-xl p-4 mb-6 border border-red-500/30">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* Search & Filters */}
      <div className="glass-panel rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <svg className="w-4 h-4 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            placeholder="Search memories..."
            className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-slate-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          {searchQuery && (
            <button className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors shrink-0"
              onClick={() => { setSearchQuery(""); loadMemories(); }}>
              Clear
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2">
          {([
            { key: "all", label: `All (${memories.length})` },
            { key: "reports", label: `📋 Reports (${reportCount})` },
            { key: "memories", label: `🧠 Memories (${memoryCount})` },
          ] as const).map((f) => (
            <button key={f.key}
              className={`text-[10px] px-3 py-1 rounded-full transition-all border ${
                filter === f.key
                  ? "bg-[#00f2fe]/10 text-[#00f2fe] border-[#00f2fe]/30"
                  : "text-slate-500 border-slate-800 hover:border-slate-600"
              }`}
              onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Loading...</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <p className="text-xs text-slate-500">
            {searchQuery ? "No results found." : filter === "reports" ? "No agent reports yet." : filter === "memories" ? "No memories yet." : "No entries found."}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            {searchQuery ? "Try a different search term." : "Entries will appear here once the system stores them."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((memory) =>
            isAgentReport(memory) ? (
              <AgentReportCard key={memory.id} memory={memory} onDelete={deleteMemory} />
            ) : (
              <MemoryCard key={memory.id} memory={memory} onDelete={deleteMemory} />
            )
          )}
        </div>
      )}
    </div>
  );
}
