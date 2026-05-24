import { useState, useEffect } from "react";

export function PluginsPage() {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [configPlugin, setConfigPlugin] = useState<any>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [configRawJson, setConfigRawJson] = useState("");
  const [configSaving, setConfigSaving] = useState(false);

  useEffect(() => { loadPlugins(); }, []);

  async function loadPlugins() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/plugins");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPlugins(data.plugins || data || []);
    } catch (e: any) {
      setErrorMsg("Failed to load plugins: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function installPlugin(id: string) {
    setInstalling(id);
    setErrorMsg("");
    try {
      const res = await fetch("/api/plugins/" + id + "/install", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      await loadPlugins();
    } catch (e: any) {
      setErrorMsg("Failed to install plugin: " + (e.message || e));
    } finally {
      setInstalling(null);
    }
  }

  async function uninstallPlugin(id: string) {
    setInstalling(id);
    setErrorMsg("");
    try {
      const res = await fetch("/api/plugins/" + id + "/uninstall", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      await loadPlugins();
    } catch (e: any) {
      setErrorMsg("Failed to uninstall plugin: " + (e.message || e));
    } finally {
      setInstalling(null);
    }
  }

  async function configurePlugin(id: string) {
    setConfigSaving(true);
    setErrorMsg("");
    try {
      let body: any;
      if (Object.keys(configValues).length > 0) {
        body = configValues;
      } else if (configRawJson.trim()) {
        try { body = JSON.parse(configRawJson); }
        catch { throw new Error("Invalid JSON configuration"); }
      } else {
        body = {};
      }
      const res = await fetch("/api/plugins/" + id + "/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadPlugins();
      setConfigPlugin(null);
    } catch (e: any) {
      setErrorMsg("Failed to configure plugin: " + (e.message || e));
    } finally {
      setConfigSaving(false);
    }
  }

  function openConfig(plugin: any) {
    setConfigPlugin(plugin);
    setConfigValues(plugin.config || plugin.settings || {});
    setConfigRawJson("");
  }

  function filteredPlugins() {
    let list = plugins;
    if (filterType !== "all") {
      list = list.filter(p => p.type === filterType || p.category === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.author?.toLowerCase().includes(q)
      );
    }
    return list;
  }

  function typeBadgeColor(type: string) {
    switch (type?.toLowerCase()) {
      case "mcp": case "mcp-server": return "bg-indigo-950/50 text-indigo-400 border-indigo-500/30";
      case "tool": case "developer tool": return "bg-slate-900 text-slate-400 border-slate-800";
      case "skill": return "bg-emerald-950 text-emerald-400 border-emerald-500/20";
      case "bridge": return "bg-amber-950 text-amber-400 border-amber-500/20";
      default: return "bg-slate-900 text-slate-500 border-slate-800";
    }
  }

  const list = filteredPlugins();

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Plugin Integration Hub</h2>
        <p className="text-xs text-slate-400 mt-0.5">Extend and customize AI abilities with community and corporate modules.</p>
      </div>

      {errorMsg && (
        <div className="glass-panel rounded-xl p-3 mb-4 border border-red-500/30">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <input className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500"
            placeholder="Search plugins..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <select className="px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white"
          value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="mcp">MCP</option>
          <option value="tool">Tool</option>
          <option value="skill">Skill</option>
          <option value="bridge">Bridge</option>
        </select>
        <button className="btn-premium px-3 py-1.5 rounded-lg text-xs" onClick={loadPlugins} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {loading && plugins.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <p className="text-sm text-slate-400">Loading plugins...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((plugin) => (
              <div key={plugin.id || plugin.name} className="glass-panel rounded-xl p-5 flex flex-col justify-between transition-all hover:border-indigo-500/30">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center">
                      {plugin.icon ? (
                        <span className="text-base">{plugin.icon}</span>
                      ) : (
                        <svg className="w-4.5 h-4.5 text-[#00f2fe]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
                      )}
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${plugin.installed ? "bg-emerald-950 text-emerald-400 border-emerald-500/20" : "bg-slate-900 text-slate-500 border-slate-800"}`}>
                      {plugin.installed ? "Installed" : "Available"}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-white mb-1">{plugin.name}</h3>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed line-clamp-2">{plugin.description || "No description"}</p>
                  {(plugin.type || plugin.category) && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${typeBadgeColor(plugin.type || plugin.category)}`}>
                      {plugin.type || plugin.category}
                    </span>
                  )}
                  {plugin.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {plugin.tags.map((tag: string, i: number) => (
                        <span key={i} className="custom-badge text-[9px]">{tag?.name ?? tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-3">
                  <span className="text-[10px] font-mono text-slate-500">by {plugin.author || "unknown"}</span>
                  <div className="flex gap-1.5">
                    {plugin.installed ? (
                      <>
                        <button className="text-[11px] px-2.5 py-1 rounded bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-400 border border-indigo-900/30 transition-all"
                          onClick={() => openConfig(plugin)}>Configure</button>
                        <button className="text-[11px] px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 transition-all"
                          onClick={() => uninstallPlugin(plugin.id || plugin.name)}
                          disabled={installing === (plugin.id || plugin.name)}>
                          {installing === (plugin.id || plugin.name) ? "..." : "Remove"}
                        </button>
                      </>
                    ) : (
                      <button className="btn-premium px-3 py-1 rounded text-xs"
                        onClick={() => installPlugin(plugin.id || plugin.name)}
                        disabled={installing === (plugin.id || plugin.name)}>
                        {installing === (plugin.id || plugin.name) ? "Installing..." : "Install"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {list.length === 0 && !loading && (
            <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2 mt-4">
              <p className="text-sm text-slate-400">No plugins found</p>
              {(searchQuery || filterType !== "all") ? (
                <p className="text-xs text-slate-500">Try adjusting your search or filters</p>
              ) : (
                <p className="text-xs text-slate-500">The plugin registry is empty</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Configure Modal */}
      {configPlugin && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-slate-800 max-w-lg w-full rounded-xl overflow-hidden shadow-2xl">
            <div className="bg-[#05080f] px-4 py-3 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <span className="text-sm font-bold">{configPlugin.name}</span>
                <span className="text-[10px] text-slate-400">Configuration</span>
              </div>
              <button onClick={() => setConfigPlugin(null)} className="text-slate-500 hover:text-white">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-400">Configure settings for this plugin.</p>
              {Object.keys(configValues).length === 0 ? (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Plugin has no predefined config. Enter raw JSON configuration:</p>
                  <textarea
                    value={configRawJson}
                    onChange={(e) => setConfigRawJson(e.target.value)}
                    placeholder='{"apiKey": "..."}'
                    rows={6}
                    className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg p-3 text-xs text-white font-mono focus:outline-none focus:border-[#00f2fe] resize-none"
                  />
                </div>
              ) : (
                Object.entries(configValues).map(([key, val]) => (
                  <div key={key}>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1">{key}</label>
                    <input
                      type="text"
                      value={configValues[key] || ""}
                      onChange={(e) => setConfigValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-full bg-[#020408]/60 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#00f2fe]"
                    />
                  </div>
                ))
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button onClick={() => setConfigPlugin(null)}
                  className="px-3 py-1.5 rounded text-xs border border-slate-800 text-slate-400 hover:bg-slate-900 transition-all">Cancel</button>
                <button onClick={() => configurePlugin(configPlugin.id || configPlugin.name)}
                  disabled={configSaving}
                  className="btn-premium px-4 py-1.5 rounded text-xs disabled:opacity-40">
                  {configSaving ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
