import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { loadSessions(); }, []);

  async function loadSessions() {
    setLoading(true);
    setErrorMsg("");
    try {
      setSessions(await api.sessions());
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  async function doSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/sessions/search?q=${encodeURIComponent(searchQuery)}&limit=15`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleSearchKeydown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") doSearch();
  }

  async function deleteSession(id: string) {
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to delete session");
    }
  }

  async function resumeSession(id: string) {
    window.dispatchEvent(new CustomEvent("nova-resume-session", { detail: { sessionId: id } }));
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Core Sessions</h2>
          <p className="text-xs text-slate-400 mt-1">Track long-term session IDs, multi-agent orchestrations, and conversation histories.</p>
        </div>
        <button className="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onClick={loadSessions}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* FTS5 Transcript Search */}
      <div className="glass-panel rounded-xl p-4 mb-6 border border-[#00f2fe]/10">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              placeholder="Search all transcripts (FTS5) — e.g. 'video bug', 'trading setup'..."
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00f2fe] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeydown}
            />
          </div>
          <button className="btn-premium px-4 py-2 rounded-lg text-xs" onClick={doSearch} disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
            {searchResults.map((result, i) => (
              <div key={i}
                className="bg-slate-950/40 rounded-lg px-3 py-2 border border-slate-800/40 hover:border-slate-700/60 cursor-pointer transition-all"
                onClick={() => resumeSession(result.sessionId)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-[#00f2fe] font-mono">{result.sessionId?.slice(0, 8)}...</span>
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{result.role}</span>
                  <span className="text-[9px] text-slate-600">rank: {Math.round(result.rank * 100) / 100}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: result.snippet }} />
              </div>
            ))}
          </div>
        )}
        {searchQuery && !searching && searchResults.length === 0 && (
          <p className="text-[10px] text-slate-600 mt-3">No matches found for "{searchQuery}".</p>
        )}
      </div>

      {errorMsg && (
        <div className="glass-panel rounded-xl p-4 mb-6 border border-red-500/30">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {loading ? (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Loading sessions...</span>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <p className="text-xs text-slate-500">No sessions found.</p>
          <p className="text-[10px] text-slate-600 mt-1">Start a conversation in the chat to create a session.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((session) => (
            <div key={session.id} className="glass-panel rounded-xl p-5 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-[#00f2fe] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <h3 className="font-bold text-sm text-white truncate">{session.model || "Unknown Model"}</h3>
                </div>
                <span className="text-[9px] bg-slate-900 text-slate-500 px-2 py-0.5 rounded font-mono shrink-0">
                  {session.messages?.length || 0} msgs
                </span>
              </div>

              <div className="mb-3">
                <span className="text-[10px] text-slate-500 font-mono">{session.id}</span>
              </div>

              {session.created_at && (
                <p className="text-[10px] text-slate-600 mb-4">
                  {new Date(session.created_at).toLocaleString()}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button className="btn-premium px-3 py-1 rounded text-[10px]" onClick={() => resumeSession(session.id)}>
                  Resume
                </button>
                <button className="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1 rounded text-[10px] transition-all"
                  onClick={() => deleteSession(session.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSession && (
        <div className="glass-panel rounded-xl p-5 mt-6 border border-[#00f2fe]/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-white">Session Details</h3>
            <button className="text-xs text-slate-500 hover:text-slate-300 transition-colors" onClick={() => setSelectedSession(null)}>Close</button>
          </div>
          <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
            {JSON.stringify(selectedSession, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
