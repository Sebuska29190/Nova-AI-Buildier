import { useState, useEffect, useRef } from "react";

const ENV_VARS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  gemini: "GEMINI_API_KEY",
  grok: "XAI_API_KEY",
  kimi: "KIMI_API_KEY",
  minimax: "MINIMAX_API_KEY",
  qwen: "DASHSCOPE_API_KEY",
  zhipu: "ZHIPU_API_KEY",
  lmstudio: "LMSTUDIO_API_KEY",
  ollama: "OLLAMA_API_KEY",
  custom: "CUSTOM_API_KEY",
};

const THEMES = ["dark", "light", "system"];
const FONT_SIZES = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];
const ACCENT_COLORS = [
  { value: "#00f2fe", label: "Cyan" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#ec4899", label: "Pink" },
];

interface ConfigPageProps {
  models?: Array<{ id: string }>;
}

export function ConfigPage({ models: _models = [] }: ConfigPageProps) {
  const [providers, setProviders] = useState<any[]>([]);
  const [models, setModels] = useState<Array<{ id: string }>>([]);
  const [rules, setRules] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [tab, setTab] = useState<"providers" | "rules" | "defaults" | "appearance" | "backup">("providers");
  const [editingTtsEngine, setEditingTtsEngine] = useState("auto");
  const [editingVideoQuality, setEditingVideoQuality] = useState("medium");
  const [editingImageEngine, setEditingImageEngine] = useState("auto");

  // Appearance state
  const [appearance, setAppearance] = useState({ theme: "dark", fontSize: "medium", accentColor: "#00f2fe", compact: false });
  const [loadingAppearance, setLoadingAppearance] = useState(false);

  // Backup state
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs = [
    { id: "providers" as const, label: "Providers & Keys" },
    { id: "rules" as const, label: "System Rules" },
    { id: "defaults" as const, label: "Defaults" },
    { id: "appearance" as const, label: "Appearance" },
    { id: "backup" as const, label: "Backup & Restore" },
  ];

  useEffect(() => {
    loadConfig();
    setModels(_models || []);
  }, []);

  useEffect(() => {
    setModels(_models || []);
  }, [_models]);

  useEffect(() => {
    if (tab === "appearance") loadAppearance();
  }, [tab]);

  function showError(msg: string) {
    setErrorMsg(msg);
    setSuccessMsg("");
    setTimeout(() => setErrorMsg(""), 5000);
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setErrorMsg("");
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  async function loadConfig() {
    setLoading(true);
    setErrorMsg("");
    try {
      const [provRes, rulesRes] = await Promise.all([
        fetch("/api/config/providers"),
        fetch("/api/config/rules"),
      ]);
      const provData = await provRes.json();
      const rulesData = await rulesRes.json();
      setProviders(provData.providers || []);
      setRules(rulesData.rules || rulesData.content || "");
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }

  async function saveRules() {
    setSaving(true);
    setErrorMsg("");
    try {
      await fetch("/api/config/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      showSuccess("Rules saved");
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to save rules");
    } finally {
      setSaving(false);
    }
  }

  async function toggleProvider(id: string) {
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;
    const enabled = !provider.enabled;
    try {
      await fetch(`/api/config/providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      provider.enabled = enabled;
      setProviders([...providers]);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to toggle provider");
    }
  }

  async function updateApiKey(providerId: string, key: string) {
    try {
      await fetch(`/api/config/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to update API key");
    }
  }

  async function loadAppearance() {
    setLoadingAppearance(true);
    try {
      const res = await fetch("/api/config/appearance");
      const data = await res.json();
      setAppearance(data);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load appearance settings");
    } finally {
      setLoadingAppearance(false);
    }
  }

  async function saveAppearance() {
    try {
      const res = await fetch("/api/config/appearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appearance),
      });
      const data = await res.json();
      if (data.status === "saved") {
        showSuccess("Appearance saved");
        applyAppearance(appearance);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to save appearance");
    }
  }

  function applyAppearance(a: typeof appearance) {
    // Apply theme via data attribute
    document.documentElement.dataset.theme = a.theme === "light" ? "light" : "dark";
    // Apply font size
    const root = document.documentElement;
    root.style.setProperty("--nova-font-size", a.fontSize === "small" ? "12px" : a.fontSize === "large" ? "16px" : "14px");
    // Apply accent color
    root.style.setProperty("--nova-accent", a.accentColor);
    // Apply compact
    root.style.setProperty("--nova-spacing", a.compact ? "0.5" : "1");
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/config/export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nova-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("Config exported");
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to export config");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.exportVersion) {
        showError("Invalid config file");
        return;
      }
      const res = await fetch("/api/config/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.status === "imported") {
        showSuccess("Config imported — reloading...");
        // Reload settings
        loadConfig();
        loadAppearance();
        if (data.appearance) applyAppearance({ ...appearance, ...data.appearance });
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to import config");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Configuration Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">Tweak system values: provider preferences, API keys, system rules, appearance, and backups.</p>
        </div>
        <button className="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onClick={loadConfig}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800 pb-0 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${tab === t.id ? "border-[#00f2fe] text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="glass-panel rounded-xl p-4 mb-6 border border-red-500/30">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="glass-panel rounded-xl p-4 mb-6 border border-emerald-500/30">
          <p className="text-xs text-emerald-400">{successMsg}</p>
        </div>
      )}

      {tab === "providers" && (
        <>
          {loading && (
            <div className="glass-panel rounded-xl p-8 flex items-center justify-center mb-6">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400">Loading configuration...</span>
              </div>
            </div>
          )}

          {/* Providers */}
          <div className="glass-panel rounded-xl p-5 mb-6">
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#00f2fe]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>
              </svg>
              LLM Providers
            </h3>

            {providers.length === 0 && !loading ? (
              <p className="text-xs text-slate-500">No providers configured.</p>
            ) : (
              <div className="space-y-3">
                {providers.map((provider) => (
                  <div key={provider.id}>
                    <div className="flex items-center justify-between p-3 bg-[#020408]/40 rounded-lg border border-slate-800/50">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          className={`w-7 h-4 rounded-full transition-colors relative shrink-0 ${provider.enabled ? "bg-[#00f2fe]" : "bg-slate-700"}`}
                          onClick={() => toggleProvider(provider.id)}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${provider.enabled ? "left-3.5" : "left-0.5"}`} />
                        </button>
                        <div className="min-w-0">
                          <span className="text-sm text-white font-medium">{provider.name || provider.id}</span>
                          {provider.model && <span className="text-[10px] text-slate-500 ml-2 font-mono">{provider.model}</span>}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {provider.keySource === "env" ? (
                              <>
                                <span className="text-[9px] bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded border border-green-700/30 font-mono">.env</span>
                                <span className="text-[9px] bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded border border-blue-700/30 font-mono">
                                  {ENV_VARS[provider.providerId] || (provider.providerId?.toUpperCase() + "_API_KEY")}
                                </span>
                              </>
                            ) : provider.keySource === "saved" ? (
                              <span className="text-[9px] bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded border border-amber-700/30 font-mono">saved</span>
                            ) : (
                              <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700/30 font-mono">no key</span>
                            )}
                            <span className="text-[9px] bg-slate-800/60 text-slate-500 px-1.5 py-0.5 rounded font-mono">{provider.modelCount} models</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {provider.id && (
                      <div className="pl-10 -mt-2 mb-1">
                        <input
                          type="password"
                          placeholder="API Key..."
                          className="w-full bg-[#020408]/60 border border-slate-800 rounded px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe]"
                          onChange={(e) => updateApiKey(provider.id, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Models */}
          {models.length > 0 && (
            <div className="glass-panel rounded-xl p-5 mb-6">
              <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
                </svg>
                Available Models
              </h3>
              <div className="flex flex-wrap gap-2">
                {models.map((model) => (
                  <span key={model.id} className="text-[10px] bg-[#020408]/60 text-slate-400 border border-slate-800 px-2 py-1 rounded font-mono">{model.id}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "rules" && (
        <div className="glass-panel rounded-xl p-5 mb-6">
          <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 21h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z"/><path d="M10 8h4"/><path d="M10 12h4"/><path d="M10 16h4"/><path d="M4 20V5a2 2 0 0 1 2-2"/><path d="M4 20a2 2 0 0 0 2 2"/><path d="M4 13V5"/>
            </svg>
            System Rules
          </h3>
          <textarea
            className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-[#00f2fe] resize-y"
            rows={8}
            placeholder="Define system behavior rules..."
            value={rules}
            onChange={(e) => setRules(e.target.value)}
          />
          <div className="flex justify-end mt-3">
            <button
              className="btn-premium px-4 py-1.5 rounded text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={saveRules}
              disabled={saving}
            >
              {saving && <span className="w-3 h-3 border-2 border-[#020408] border-t-transparent rounded-full animate-spin" />}
              {saving ? "Saving..." : "Save Rules"}
            </button>
          </div>
        </div>
      )}

      {tab === "defaults" && (
        <div className="glass-panel rounded-xl p-5 mb-6">
          <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="10" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
            Generation Defaults
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">Default TTS Engine</label>
              <div className="flex gap-2 flex-wrap">
                {["auto", "edge", "gTTS", "elevenlabs", "azure"].map((engine) => (
                  <button key={engine} onClick={() => setEditingTtsEngine(engine)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${editingTtsEngine === engine ? "border-[#00f2fe] text-white bg-[#00f2fe]/10" : "border-slate-800 text-slate-500 hover:text-white hover:border-slate-600"}`}>
                    {engine}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">Default Image Engine</label>
              <div className="flex gap-2 flex-wrap">
                {["auto", "dalle3", "stable-diffusion", "imagen"].map((engine) => (
                  <button key={engine} onClick={() => setEditingImageEngine(engine)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${editingImageEngine === engine ? "border-[#00f2fe] text-white bg-[#00f2fe]/10" : "border-slate-800 text-slate-500 hover:text-white hover:border-slate-600"}`}>
                    {engine}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">Video Quality</label>
              <div className="flex gap-2">
                  {["low", "medium", "high"].map((q) => {
                    const qActive = editingVideoQuality === q;
                    return (
                    <button key={q} onClick={() => setEditingVideoQuality(q)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${qActive ? "border-[#00f2fe] text-white bg-[#00f2fe]/10" : "border-slate-800 text-slate-500 hover:text-white hover:border-slate-600"}`}>
                      {q}
                    </button>
                    );
                  })}
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button className="btn-premium px-4 py-1.5 rounded text-xs flex items-center gap-1.5"
                onClick={async () => {
                  try {
                    await fetch("/api/config/settings", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ttsEngine: editingTtsEngine, imageEngine: editingImageEngine, videoQuality: editingVideoQuality }),
                    });
                    showSuccess("Defaults saved");
                  } catch (e: any) {
                    setErrorMsg(e?.message || "Failed to save defaults");
                  }
                }}>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "appearance" && (
        <div className="glass-panel rounded-xl p-5 mb-6">
          <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            Appearance
          </h3>

          {loadingAppearance ? (
            <div className="flex items-center justify-center py-8">
              <span className="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Theme */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2">Theme</label>
                <div className="flex gap-2">
                  {THEMES.map((t) => (
                    <button key={t} onClick={() => setAppearance({ ...appearance, theme: t })}
                      className={`px-4 py-2 text-xs rounded-lg border transition-all capitalize ${
                        appearance.theme === t
                          ? "border-[#00f2fe] text-white bg-[#00f2fe]/10"
                          : "border-slate-800 text-slate-500 hover:text-white hover:border-slate-600"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2">Font Size</label>
                <div className="flex gap-2">
                  {FONT_SIZES.map((fs) => (
                    <button key={fs.id} onClick={() => setAppearance({ ...appearance, fontSize: fs.id })}
                      className={`px-4 py-2 text-xs rounded-lg border transition-all ${
                        appearance.fontSize === fs.id
                          ? "border-[#00f2fe] text-white bg-[#00f2fe]/10"
                          : "border-slate-800 text-slate-500 hover:text-white hover:border-slate-600"
                      }`}>
                      {fs.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2">Accent Color</label>
                <div className="flex gap-2">
                  {ACCENT_COLORS.map((c) => (
                    <button key={c.value} onClick={() => setAppearance({ ...appearance, accentColor: c.value })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        appearance.accentColor === c.value ? "border-white scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Compact Mode */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs text-white font-medium">Compact Mode</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Reduced spacing for denser layout</p>
                </div>
                <button
                  className={`w-10 h-5 rounded-full transition-colors relative ${appearance.compact ? "bg-[#00f2fe]" : "bg-slate-700"}`}
                  onClick={() => setAppearance({ ...appearance, compact: !appearance.compact })}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${appearance.compact ? "left-5.5" : "left-0.5"}`} />
                </button>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button className="btn-premium px-4 py-1.5 rounded text-xs flex items-center gap-1.5" onClick={saveAppearance}>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Save Appearance
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "backup" && (
        <div className="space-y-6">
          {/* Export */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Configuration
            </h3>
            <p className="text-xs text-slate-400 mb-4">Download all settings, rules, and defaults as a JSON file. API keys are NOT exported for security.</p>
            <button className="btn-premium px-4 py-2 rounded text-xs flex items-center gap-1.5 disabled:opacity-40" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <span className="w-3 h-3 border-2 border-[#020408] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              )}
              {exporting ? "Exporting..." : "Export Config"}
            </button>
          </div>

          {/* Import */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import Configuration
            </h3>
            <p className="text-xs text-slate-400 mb-4">Restore settings from a previously exported config file. Current rules, defaults, and appearance will be overwritten.</p>
            <div className="flex items-center gap-3">
              <button className="btn-premium px-4 py-2 rounded text-xs flex items-center gap-1.5 disabled:opacity-40" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? (
                  <span className="w-3 h-3 border-2 border-[#020408] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                )}
                {importing ? "Importing..." : "Import Config"}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              <span className="text-[10px] text-slate-500">Select a .json config file</span>
            </div>
          </div>

          {/* Quick Profile Switch */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Quick Profile Access
            </h3>
            <p className="text-xs text-slate-400 mb-4">Manage user profiles and agent presets.</p>
            <a href="#profiles" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("nova-navigate", { detail: "profiles" })); }}
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              Go to Profiles
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
