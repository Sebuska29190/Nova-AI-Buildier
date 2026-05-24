import { useState, useEffect } from "react";

export function EnvPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { loadProviders(); }, []);

  async function loadProviders() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/config/providers");
      const data = await res.json();
      const providers = data.providers || data || [];
      setProviders(providers);
      const ek: Record<string, string> = {};
      const sk: Record<string, boolean> = {};
      const sv: Record<string, boolean> = {};
      for (const p of providers) { ek[p.id] = ""; sk[p.id] = false; sv[p.id] = false; }
      setEditingKey(ek);
      setShowKey(sk);
      setSaving(sv);
    } catch (e: any) {
      setErrorMsg("Failed to load providers: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function saveApiKey(providerId: string) {
    const key = editingKey[providerId];
    if (!key) return;
    setSaving((prev) => ({ ...prev, [providerId]: true }));
    setErrorMsg("");
    try {
      const res = await fetch(`/api/config/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditingKey((prev) => ({ ...prev, [providerId]: "" }));
      await loadProviders();
    } catch (e: any) {
      setErrorMsg("Failed to save API key: " + (e.message || e));
    } finally {
      setSaving((prev) => ({ ...prev, [providerId]: false }));
    }
  }

  async function toggleProvider(providerId: string) {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;
    const enabled = !provider.enabled;
    setErrorMsg("");
    try {
      const res = await fetch(`/api/config/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      provider.enabled = enabled;
      setProviders([...providers]);
    } catch (e: any) {
      setErrorMsg("Failed to toggle provider: " + (e.message || e));
    }
  }

  function maskKey(key: string): string {
    if (!key || key.length < 8) return key || "";
    return key.slice(0, 4) + "****" + key.slice(-4);
  }

  function keyLabel(providerId: string): string {
    const p = providers.find((x) => x.id === providerId);
    if (p?.apiKey) return "Update";
    return "Save";
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">API Keys Management</h2>
          <p className="text-xs text-slate-400 mt-1">Control secure keys, tokens, and verification secrets used by the orchestrator.</p>
        </div>
        <button className="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onClick={loadProviders}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="glass-panel rounded-xl p-3 mb-4 border border-red-500/30">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {loading ? (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <p className="text-sm text-slate-400">Loading providers...</p>
        </div>
      ) : providers.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-slate-400">No providers configured</p>
          <p className="text-xs text-slate-500">Add API keys to enable AI model providers.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-xl p-5 space-y-4">
          {providers.map((provider) => (
            <div key={provider.id} className="flex items-center justify-between border-b border-slate-800/50 last:border-0 pb-4 last:pb-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{provider.name || provider.id}</h3>
                  <button
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${provider.enabled
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}
                    onClick={() => toggleProvider(provider.id)}
                  >
                    {provider.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
                {provider.description && (
                  <p className="text-[11px] text-slate-500 mt-0.5">{provider.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                {editingKey[provider.id] ? (
                  <input
                    type={showKey[provider.id] ? "text" : "password"}
                    className="bg-[#020408]/60 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300 font-mono w-56 focus:outline-none focus:border-[#00f2fe]"
                    placeholder="Enter API key..."
                    value={editingKey[provider.id]}
                    onChange={(e) => setEditingKey((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    {provider.apiKey || provider.apiKeyConfigured ? (
                      <span className="text-xs text-slate-400 font-mono bg-[#020408]/60 px-2 py-1 rounded">
                        {showKey[provider.id] && provider.apiKey
                          ? provider.apiKey
                          : maskKey(provider.apiKey || "")}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No key set</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  {provider.apiKey && (
                    <button
                      className="text-[10px] px-2 py-1 rounded text-slate-400 hover:text-white transition-all"
                      onClick={() => setShowKey((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                      title={showKey[provider.id] ? "Hide" : "Show"}
                    >
                      {showKey[provider.id] ? "Hide" : "Show"}
                    </button>
                  )}
                  {editingKey[provider.id] ? (
                    <>
                      <button
                        className="btn-premium px-2.5 py-1.5 rounded text-[10px] disabled:opacity-40"
                        onClick={() => saveApiKey(provider.id)}
                        disabled={saving[provider.id] || !editingKey[provider.id].trim()}
                      >
                        {saving[provider.id] ? "Saving..." : keyLabel(provider.id)}
                      </button>
                      <button
                        className="text-[10px] px-2 py-1 rounded text-slate-400 hover:text-white transition-all"
                        onClick={() => setEditingKey((prev) => ({ ...prev, [provider.id]: "" }))}
                      >Cancel</button>
                    </>
                  ) : (
                    <button
                      className="text-[10px] px-2 py-1 rounded border border-slate-800 text-slate-400 hover:text-white transition-all"
                      onClick={() => setEditingKey((prev) => ({ ...prev, [provider.id]: provider.apiKey || "" }))}
                    >{provider.apiKey ? "Change" : "Add"}</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
