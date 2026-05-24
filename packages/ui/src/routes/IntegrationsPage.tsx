import { useState, useEffect } from "react";

interface ServiceDef {
  id: string; name: string; description: string; icon: string;
  authType: string; category: string;
  configFields: { key: string; label: string; type: string; required: boolean }[];
}

interface Integration {
  id: string; service: string; name: string; authType: string;
  config: Record<string, string>; enabled: boolean;
  createdAt: string; updatedAt: string;
}

const CATEGORIES = ["All", "Communication", "Developer", "Productivity", "Social", "AI", "Business", "DevOps", "Design"];

export function IntegrationsPage() {
  const [services, setServices] = useState<ServiceDef[]>([]);
  const [accounts, setAccounts] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [showConnect, setShowConnect] = useState<string | null>(null);
  const [connectName, setConnectName] = useState("");
  const [connectConfig, setConnectConfig] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        fetch("/api/integrations/services"),
        fetch("/api/integrations/accounts"),
      ]);
      if (sRes.ok) setServices((await sRes.json()).services || []);
      if (aRes.ok) setAccounts((await aRes.json()).accounts || []);
    } catch {}
    setLoading(false);
  }

  async function connect(serviceId: string) {
    if (!connectName.trim()) return;
    setErrorMsg(""); setSuccessMsg("");
    try {
      const res = await fetch("/api/integrations/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: serviceId, name: connectName.trim(), config: connectConfig }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccessMsg("✅ Integration connected!");
      setShowConnect(null); setConnectName(""); setConnectConfig({});
      await load();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) { setErrorMsg(e.message || String(e)); }
  }

  async function remove(id: string) {
    if (!confirm("Remove this integration?")) return;
    setErrorMsg("");
    try {
      const res = await fetch(`/api/integrations/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setSuccessMsg("🗑️ Removed");
      await load();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) { setErrorMsg(e.message || String(e)); }
  }

  async function toggle(id: string, enabled: boolean) {
    try {
      await fetch(`/api/integrations/accounts/${id}/toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await load();
    } catch {}
  }

  async function testConnection(id: string) {
    setTestingId(id); setErrorMsg(""); setSuccessMsg("");
    try {
      const res = await fetch(`/api/integrations/accounts/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.success) setSuccessMsg(`✅ ${data.message}`);
      else setErrorMsg(`❌ ${data.message}`);
      setTimeout(() => { setSuccessMsg(""); setErrorMsg(""); }, 5000);
    } catch (e: any) { setErrorMsg(e.message || String(e)); }
    setTestingId(null);
  }

  const filtered = services.filter((s) => {
    if (category !== "All" && s.category !== category) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const connectedIds = new Set(accounts.map((a) => a.service));

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00f2fe]/20 to-[#4facfe]/20 border border-[#00f2fe]/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#00f2fe]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Integrations Hub</h2>
            <p className="text-[10px] text-slate-500">Connect Nova to 30+ services — Slack, GitHub, Notion, Google, Discord & more</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800">
            {accounts.filter(a => a.enabled).length} / {accounts.length} active
          </span>
        </div>
      </div>

      {errorMsg && <div className="glass-panel rounded-xl p-3 mb-4 border border-red-500/30 bg-red-950/20"><p className="text-[11px] text-red-400">{errorMsg}</p></div>}
      {successMsg && <div className="glass-panel rounded-xl p-3 mb-4 border border-emerald-500/30 bg-emerald-950/20"><p className="text-[11px] text-emerald-400">{successMsg}</p></div>}

      {/* Search + Categories */}
      <div className="flex items-center gap-3 mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services..." className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500" />
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${category === c ? "border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe]" : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-600"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Connected Accounts */}
      {accounts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-2">Connected</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {accounts.map((acc) => {
              const svc = services.find((s) => s.id === acc.service);
              return (
                <div key={acc.id} className="glass-panel rounded-xl p-3 border border-slate-800/60 flex items-center gap-2">
                  <span className="text-lg">{svc?.icon || "🔌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white font-medium truncate">{acc.name}</p>
                    <p className="text-[8px] text-slate-500">{svc?.name || acc.service}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggle(acc.id, !acc.enabled)}
                      className={`w-5 h-5 rounded flex items-center justify-center text-[9px] ${acc.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700/40 text-slate-500"}`}>
                      {acc.enabled ? "✓" : "⏸"}
                    </button>
                    <button onClick={() => testConnection(acc.id)} disabled={testingId === acc.id}
                      className="w-5 h-5 rounded flex items-center justify-center bg-slate-800/40 text-slate-500 hover:text-slate-300 text-[9px]">
                      {testingId === acc.id ? "..." : "↻"}
                    </button>
                    <button onClick={() => remove(acc.id)}
                      className="w-5 h-5 rounded flex items-center justify-center bg-red-950/20 text-red-400/60 hover:text-red-300 text-[9px]">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Services */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {filtered.map((svc) => {
          const connected = connectedIds.has(svc.id);
          return (
            <div key={svc.id} className={`glass-panel rounded-xl p-3 border transition-all ${connected ? "border-emerald-900/40" : "border-slate-800/40 hover:border-slate-700"}`}>
              <div className="flex items-start justify-between mb-2">
                <span className="text-xl">{svc.icon}</span>
                {connected && <span className="text-[8px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/25">Connected</span>}
              </div>
              <p className="text-[10px] text-white font-medium">{svc.name}</p>
              <p className="text-[8px] text-slate-500 mt-0.5 line-clamp-2">{svc.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[7px] text-slate-600 uppercase">{svc.authType}</span>
                {connected ? (
                  <span className="text-[8px] text-emerald-500">✓</span>
                ) : (
                  <button onClick={() => { setShowConnect(svc.id); setConnectName(""); setConnectConfig({}); }}
                    className="text-[8px] text-[#00f2fe] hover:underline">Connect</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Modal */}
      {showConnect && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowConnect(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-[420px]" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const svc = services.find((s) => s.id === showConnect);
              if (!svc) return null;
              return (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{svc.icon}</span>
                    <div><h3 className="text-sm font-bold text-white">Connect {svc.name}</h3><p className="text-[10px] text-slate-500">{svc.authType} authentication</p></div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Connection Name</label>
                      <input type="text" value={connectName} onChange={(e) => setConnectName(e.target.value)}
                        placeholder={`My ${svc.name}`} className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500" />
                    </div>
                    {svc.configFields.map((field) => (
                      <div key={field.key}>
                        <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">{field.label}</label>
                        <input type={field.type} value={connectConfig[field.key] || ""} onChange={(e) => setConnectConfig({ ...connectConfig, [field.key]: e.target.value })}
                          placeholder={field.label} className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500" />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 mt-5">
                    <button onClick={() => setShowConnect(null)} className="px-3 py-1.5 rounded-lg text-[11px] text-slate-400 border border-slate-800 hover:bg-slate-900 transition-all">Cancel</button>
                    <button onClick={() => connect(svc.id)}
                      className="btn-premium px-4 py-1.5 rounded-lg text-[11px] disabled:opacity-40"
                      disabled={!connectName.trim() || svc.configFields.some((f) => f.required && !connectConfig[f.key])}>
                      Connect
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
