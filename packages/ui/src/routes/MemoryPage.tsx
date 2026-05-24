import { useState, useEffect } from "react";

export function MemoryPage() {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemory, setSelectedMemory] = useState<any>(null);

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

  function handleSearchInput() {
    if (searchQuery.trim()) {
      searchMemories(searchQuery.trim());
    } else {
      loadMemories();
    }
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

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Memory DB Configurations</h2>
          <p className="text-xs text-slate-400 mt-1">Observe dynamic contextual long-term memory records and graph associations.</p>
        </div>
        <button className="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onClick={loadMemories}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="glass-panel rounded-xl p-4 mb-6 border border-red-500/30">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* Search */}
      <div className="glass-panel rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            placeholder="Search memories..."
            className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-slate-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onInput={handleSearchInput}
          />
          {searchQuery && (
            <button className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors shrink-0"
              onClick={() => { setSearchQuery(""); loadMemories(); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Loading memories...</span>
          </div>
        </div>
      ) : memories.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <p className="text-xs text-slate-500">No memories found.</p>
          <p className="text-[10px] text-slate-600 mt-1">
            {searchQuery ? "Try a different search term." : "Memories will appear here once the system stores them."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memories.map((memory) => (
            <div key={memory.id} className="glass-panel rounded-xl p-5 transition-all">
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
                  onClick={() => setSelectedMemory(selectedMemory?.id === memory.id ? null : memory)}>
                  {selectedMemory?.id === memory.id ? "Hide Details" : "View Details"}
                </button>
                <button className="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1 rounded text-[10px] transition-all ml-auto"
                  onClick={() => deleteMemory(memory.id)}>
                  Delete
                </button>
              </div>

              {selectedMemory?.id === memory.id && (
                <div className="mt-3 pt-3 border-t border-slate-800/50">
                  <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {JSON.stringify(memory, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
