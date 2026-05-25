import { useState, useEffect } from "react";

interface Account {
  id: string; name: string; platform: string;
  username?: string; createdAt: string; lastUsed?: string;
}

interface PostEntry {
  id: string; text: string; platforms: string[];
  status: "draft" | "published" | "error";
  error?: string; createdAt: string;
}

const PLATFORMS = [
  { id: "bluesky", icon: "🦋", label: "Bluesky", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { id: "tiktok", icon: "🎵", label: "TikTok", color: "bg-pink-500/10 text-pink-400 border-pink-500/30" },
  { id: "instagram", icon: "📸", label: "Instagram", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  { id: "youtube", icon: "▶️", label: "YouTube", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  { id: "linkedin", icon: "💼", label: "LinkedIn", color: "bg-blue-700/10 text-blue-400 border-blue-700/30" },
  { id: "facebook", icon: "👍", label: "Facebook", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" },
  { id: "reddit", icon: "👽", label: "Reddit", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  { id: "threads", icon: "🧵", label: "Threads", color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
  { id: "x", icon: "🐦", label: "X / Twitter", color: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
];

const PLATFORM_ICONS: Record<string, string> = Object.fromEntries(
  PLATFORMS.map(p => [p.id, p.icon])
);

function loadPostHistory(): PostEntry[] {
  try {
    const raw = localStorage.getItem("nova-social-posts");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePostHistory(posts: PostEntry[]) {
  try { localStorage.setItem("nova-social-posts", JSON.stringify(posts.slice(0, 100))); } catch {}
}

export function SocialPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlatform, setNewPlatform] = useState("bluesky");
  const [newName, setNewName] = useState("");

  // Compose
  const [composeText, setComposeText] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["bluesky"]);
  const [publishing, setPublishing] = useState(false);

  // Post history
  const [postHistory, setPostHistory] = useState<PostEntry[]>(loadPostHistory);

  // Messages
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    loadAccounts();
    refreshPostHistory();
  }, []);

  useEffect(() => {
    savePostHistory(postHistory);
  }, [postHistory]);

  function msg(m: string, type: "error" | "success") {
    if (type === "error") { setErrorMsg(m); setSuccessMsg(""); }
    else { setSuccessMsg(m); setErrorMsg(""); }
    setTimeout(() => { setErrorMsg(""); setSuccessMsg(""); }, 5000);
  }

  async function loadAccounts() {
    try {
      const res = await fetch("/api/social/accounts");
      if (res.ok) { const d = await res.json(); setAccounts(d.accounts || []); }
    } catch {}
    setLoading(false);
  }

  async function addAccount() {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/social/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, platform: newPlatform }),
      });
      if (res.ok) {
        const d = await res.json();
        setAccounts(prev => [...prev, d.account]);
        setShowAdd(false);
        setNewName("");
        msg(`✅ ${newName} (${newPlatform}) added!`, "success");
      }
    } catch { msg("Failed to add account", "error"); }
  }

  async function removeAccount(id: string) {
    try {
      await fetch(`/api/social/accounts/${id}`, { method: "DELETE" });
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch {}
  }

  async function launchBrowser(id: string) {
    try {
      const res = await fetch(`/api/social/accounts/${id}/launch`, { method: "POST" });
      const data = await res.json();
      msg(data.message || "🌐 Browser opening...", "success");
    } catch { msg("Failed to launch browser", "error"); }
  }

  // ─── Posting ──────────────────────────────────────────────────

  function refreshPostHistory() {
    setPostHistory(loadPostHistory());
  }

  function togglePlatform(pid: string) {
    setSelectedPlatforms(prev =>
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
    );
  }

  async function publishPost() {
    if (!composeText.trim()) { msg("Write something to post", "error"); return; }
    if (selectedPlatforms.length === 0) { msg("Select at least one platform", "error"); return; }
    setPublishing(true);

    const results: string[] = [];
    let allOk = true;

    for (const platform of selectedPlatforms) {
      if (platform === "bluesky") {
        try {
          const res = await fetch("/api/agent/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId: "cron-worker",
              message: `Post this to Bluesky (using bsky_post tool): ${composeText.trim()}`,
            }),
          });
          if (res.ok) {
            results.push(`🦋 Bluesky: posted`);
          } else {
            results.push(`🦋 Bluesky: ${await res.text()}`);
            allOk = false;
          }
        } catch (e: any) {
          results.push(`🦋 Bluesky: ${e.message}`);
          allOk = false;
        }
      } else {
        // For other platforms, use the social account
        const acc = accounts.find(a => a.platform === platform);
        if (acc) {
          try {
            const res = await fetch(`/api/social/accounts/${acc.id}/launch`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "post", text: composeText.trim() }),
            });
            const data = await res.json();
            results.push(`${PLATFORM_ICONS[platform] || "🌐"} ${platform}: ${data.message || "Browser opening for post..."}`);
          } catch (e: any) {
            results.push(`${PLATFORM_ICONS[platform] || "🌐"} ${platform}: ${e.message}`);
            allOk = false;
          }
        } else {
          results.push(`${PLATFORM_ICONS[platform] || "🌐"} ${platform}: no account connected`);
          allOk = false;
        }
      }
    }

    const post: PostEntry = {
      id: Date.now().toString(36),
      text: composeText.trim(),
      platforms: [...selectedPlatforms],
      status: allOk ? "published" : "error",
      error: results.filter(r => r.includes("error") || r.includes("no account")).join("; "),
      createdAt: new Date().toISOString(),
    };

    setPostHistory(prev => [post, ...prev]);
    setComposeText("");

    if (allOk) {
      msg("✅ Published! " + results.join(" | "), "success");
    } else {
      msg("⚠️ " + results.join(" | "), "error");
    }
    setPublishing(false);
  }

  const connectedPlatforms = new Set(accounts.map(a => a.platform));

  return (
    <div className="max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 border border-sky-500/30 flex items-center justify-center text-lg">
            🌐
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Social Media Hub</h2>
            <p className="text-[10px] text-slate-500">Compose, publish, and manage your social presence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </span>
          <button onClick={() => setShowAdd(!showAdd)}
            className="px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-[10px] font-bold text-sky-400 hover:bg-sky-500/20 transition-all">
            + Add Account
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && <div className="glass-panel rounded-xl p-3 mb-4 border border-red-500/30 bg-red-950/20"><p className="text-[11px] text-red-400">{errorMsg}</p></div>}
      {successMsg && <div className="glass-panel rounded-xl p-3 mb-4 border border-emerald-500/30 bg-emerald-950/20"><p className="text-[11px] text-emerald-400">{successMsg}</p></div>}

      {/* Add Account Form */}
      {showAdd && (
        <div className="glass-panel rounded-xl p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Platform</label>
              <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}
                className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                {PLATFORMS.map(p => (
                  <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Account Name</label>
              <input type="text" placeholder="e.g. My TikTok Channel" value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600" />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={addAccount} disabled={!newName.trim()}
                className="flex-1 px-3 py-2 rounded-lg bg-sky-500/20 border border-sky-500/30 text-xs font-bold text-sky-400 hover:bg-sky-500/30 transition-all disabled:opacity-50">
                Add
              </button>
              <button onClick={() => setShowAdd(false)}
                className="px-3 py-2 rounded-lg bg-slate-800/60 text-xs text-slate-400 hover:text-white transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main grid: Compose + Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Compose Panel */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-5">
          <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Compose & Publish
          </h3>

          <textarea value={composeText} onChange={(e) => setComposeText(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full bg-[#020408]/60 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 min-h-[120px] resize-y" />

          <div className="flex items-center justify-between mt-3">
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => {
                const active = selectedPlatforms.includes(p.id);
                const connected = connectedPlatforms.has(p.id);
                return (
                  <button key={p.id} onClick={() => togglePlatform(p.id)}
                    className={`text-[10px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                      active
                        ? p.color + " font-medium"
                        : "border-slate-800 text-slate-500 hover:text-white hover:border-slate-600"
                    }`}>
                    {p.icon} {p.label}
                    {!connected && active && <span className="text-[8px] text-amber-400 ml-0.5">⚠️</span>}
                  </button>
                );
              })}
            </div>
            <span className="text-[10px] text-slate-600 font-mono">{composeText.length}/300</span>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
            <div className="text-[10px] text-slate-500">
              {selectedPlatforms.length === 0
                ? "Select platforms above to publish"
                : `Publishing to ${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? "s" : ""}`
              }
            </div>
            <button onClick={publishPost} disabled={publishing || !composeText.trim() || selectedPlatforms.length === 0}
              className="px-5 py-2 rounded-lg bg-sky-500/20 border border-sky-500/30 text-xs font-bold text-sky-400 hover:bg-sky-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
              {publishing ? (
                <><span className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" /> Publishing...</>
              ) : (
                <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg> Publish</>
              )}
            </button>
          </div>
        </div>

        {/* Accounts Panel */}
        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Connected Accounts
          </h3>
          {loading ? (
            <p className="text-xs text-slate-500 text-center py-6">Loading...</p>
          ) : accounts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-slate-500 mb-2">No accounts yet</p>
              <button onClick={() => setShowAdd(true)}
                className="text-[10px] text-sky-400 hover:underline">+ Add your first account</button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center gap-2 p-2 bg-[#020408]/40 rounded-lg border border-slate-800/50 group">
                  <span className="text-base">{PLATFORM_ICONS[acc.platform] || "🌐"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white font-medium truncate">{acc.name}</p>
                    <p className="text-[9px] text-slate-500 capitalize">{acc.platform}{acc.username ? ` • @${acc.username}` : ""}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => launchBrowser(acc.id)}
                      className="w-5 h-5 rounded flex items-center justify-center bg-sky-900/20 text-sky-400 text-[9px] hover:bg-sky-900/40"
                      title="Open browser login">🌐</button>
                    <button onClick={() => removeAccount(acc.id)}
                      className="w-5 h-5 rounded flex items-center justify-center bg-red-950/20 text-red-400 text-[9px] hover:bg-red-950/40"
                      title="Remove">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Post History */}
      <div className="glass-panel rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Post History
          </h3>
          <button onClick={refreshPostHistory}
            className="text-[9px] text-slate-500 hover:text-white transition-colors">Refresh</button>
        </div>
        {postHistory.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">No posts yet. Write something and publish above.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {postHistory.map(post => (
              <div key={post.id} className="flex items-start gap-3 p-3 bg-[#020408]/40 rounded-lg border border-slate-800/50">
                <div className="flex gap-1 flex-wrap mt-0.5 min-w-[80px]">
                  {post.platforms.map(p => (
                    <span key={p} className="text-xs">{PLATFORM_ICONS[p] || "🌐"}</span>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 whitespace-pre-wrap line-clamp-2">{post.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                      post.status === "published" ? "bg-emerald-500/15 text-emerald-400" :
                      post.status === "error" ? "bg-red-500/15 text-red-400" :
                      "bg-slate-600/15 text-slate-400"
                    }`}>{post.status}</span>
                    <span className="text-[9px] text-slate-600">
                      {new Date(post.createdAt).toLocaleDateString()} {new Date(post.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {post.error && <p className="text-[9px] text-red-400 mt-0.5">{post.error}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-white">{accounts.length}</div>
          <div className="text-[9px] text-slate-500 mt-1">Accounts</div>
        </div>
        <div className="glass-panel rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-white">{postHistory.filter(p => p.status === "published").length}</div>
          <div className="text-[9px] text-slate-500 mt-1">Posts Published</div>
        </div>
        <div className="glass-panel rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-white">{connectedPlatforms.size}</div>
          <div className="text-[9px] text-slate-500 mt-1">Platforms</div>
        </div>
        <div className="glass-panel rounded-xl p-4 text-center">
          <div className="text-xl font-bold text-white">{PLATFORMS.length}</div>
          <div className="text-[9px] text-slate-500 mt-1">Available</div>
        </div>
      </div>
    </div>
  );
}
