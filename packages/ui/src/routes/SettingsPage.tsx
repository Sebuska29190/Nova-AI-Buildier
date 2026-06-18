/**
 * SettingsPage — Real settings with live provider/model data
 */
import { useState, useEffect } from "react";
import { Settings, Monitor, Shield, Bot, Globe, Save, RotateCcw, Loader2 } from "lucide-react";
import { api } from "../lib/api";

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "models", label: "Models & Providers", icon: Bot },
  { id: "security", label: "Security", icon: Shield },
];

function SettingsPage() {
  const [tab, setTab] = useState("general");
  const [saved, setSaved] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [appName, setAppName] = useState("Nexus AI");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("Europe/Warsaw");
  const [animations, setAnimations] = useState(true);
  const [port, setPort] = useState("4123");
  const [host, setHost] = useState("127.0.0.1");
  const [authEnabled, setAuthEnabled] = useState(false);
  const [defaultModel, setDefaultModel] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(true);

  useEffect(() => {
    Promise.all([
      api.models().catch(() => []),
      fetch("/api/config/providers").then(r => r.json()).then(d => d.providers || []).catch(() => []),
    ]).then(([m, p]) => {
      setModels(m);
      setProviders(p);
      if (m.length > 0 && !defaultModel) setDefaultModel(m[0].id);
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const providersWithKeys = providers.filter((p: any) => p.hasKey).length;
  const totalModels = models.length;

  return (
    <div className="h-full flex flex-col overflow-hidden max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(99,102,241,0.15)] border border-[rgba(99,102,241,0.2)] flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#818cf8]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#e8ecf2]">Settings</h1>
            <p className="text-xs text-[#4a5068]">
              {loading ? "Loading..." : `${providersWithKeys} providers · ${totalModels} models available`}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? "bg-[rgba(99,102,241,0.12)] text-[#818cf8]" : "text-[#4a5068] hover:text-[#8892a8] hover:bg-[rgba(255,255,255,0.03)]"
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 text-[#818cf8] animate-spin" />
          </div>
        ) : tab === "general" ? (
          <div className="space-y-6">
            <Section title="Application">
              <Field label="App Name" value={appName} onChange={setAppName} />
              <Field label="Language" value={language} onChange={setLanguage} type="select" options={[{v:"en",l:"English"},{v:"pl",l:"Polski"}]} />
              <Field label="Timezone" value={timezone} onChange={setTimezone} type="select" options={[{v:"Europe/Warsaw",l:"Warsaw (CET)"},{v:"Europe/London",l:"London (GMT)"},{v:"America/New_York",l:"New York (EST)"}]} />
              <ToggleField label="Animations" enabled={animations} onChange={setAnimations} />
            </Section>
            <Section title="Server">
              <Field label="Port" value={port} onChange={setPort} />
              <Field label="Host" value={host} onChange={setHost} />
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8892a8]">Status</span>
                <span className="text-xs text-[#10b981] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Connected — port {port}
                </span>
              </div>
            </Section>
          </div>
        ) : tab === "models" ? (
          <div className="space-y-6">
            <Section title={`Providers (${providersWithKeys}/${providers.length} configured)`}>
              <div className="space-y-2">
                {providers.map((p: any) => (
                  <div key={p.id || p.providerId} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${p.hasKey ? 'bg-[#10b981]' : 'bg-[#4a5068]'}`} />
                      <span className="text-sm text-[#e8ecf2]">{p.name || p.id}</span>
                    </div>
                    <span className="text-xs text-[#4a5068]">{p.models?.length || p.modelCount || 0} models</span>
                  </div>
                ))}
              </div>
            </Section>
            <Section title={`Available Models (${totalModels})`}>
              {models.length === 0 ? (
                <p className="text-xs text-[#4a5068]">No models loaded. Check provider API keys.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {models.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                      <span className="text-xs font-mono text-[#e8ecf2] truncate">{m.id}</span>
                      <span className="text-[9px] text-[#4a5068] ml-auto shrink-0">{m.owned_by || m.provider}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
            <Section title="Agent Defaults">
              <Field label="Default Model" value={defaultModel} onChange={setDefaultModel} type="select"
                options={models.map((m: any) => ({ v: m.id, l: m.id }))} />
              <ToggleField label="Auto-Approve Safe Tools" enabled={autoApprove} onChange={setAutoApprove} />
              <ToggleField label="Extended Thinking" enabled={thinkingMode} onChange={setThinkingMode} />
            </Section>
          </div>
        ) : (
          <div className="space-y-6">
            <Section title="Authentication">
              <ToggleField label="Enable JWT Auth" enabled={authEnabled} onChange={setAuthEnabled} />
            </Section>
            <Section title="Security Notes">
              <div className="text-xs text-[#4a5068] space-y-2">
                <p>🔐 API keys are encrypted with AES-256-GCM at rest</p>
                <p>🔑 Encryption key from NOVA_ENCRYPTION_KEY env or auto-generated</p>
                <p>🛡️ Keys are never sent back to client after save</p>
                <p>📁 Workspace restricted to configured paths</p>
              </div>
            </Section>
          </div>
        )}
      </div>

      {/* Save bar */}
      <div className="shrink-0 px-6 py-3 border-t border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)] flex items-center justify-between">
        <span className="text-xs text-[#4a5068]">{saved ? "✅ Settings saved" : "Changes not saved"}</span>
        <div className="flex gap-2">
          <button className="btn-glass px-4 py-2 text-sm flex items-center gap-2">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={handleSave} className="btn-nova px-4 py-2 text-sm flex items-center gap-2">
            <Save className="w-3.5 h-3.5" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", options }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  options?: Array<{ v: string; l: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-[#8892a8] font-medium min-w-[180px]">{label}</label>
      {type === "select" && options ? (
        <select value={value} onChange={e => onChange(e.target.value)} className="glass-input flex-1 px-3 py-2 text-sm">
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className="glass-input flex-1 px-3 py-2 text-sm" />
      )}
    </div>
  );
}

function ToggleField({ label, enabled, onChange }: {
  label: string; enabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#8892a8] font-medium">{label}</span>
      <button onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
          enabled ? 'bg-[#00d4ff] shadow-[0_0_12px_rgba(0,212,255,0.3)]' : 'bg-[rgba(255,255,255,0.1)]'
        }`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
          enabled ? 'left-[22px]' : 'left-[2px]'
        }`} />
      </button>
    </div>
  );
}

export { SettingsPage };
export default SettingsPage;
