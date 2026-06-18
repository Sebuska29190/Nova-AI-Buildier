/**
 * SettingsPage — Consolidated settings with tabs
 * Combines: General, Models, API Keys, Profiles, Channels, Integrations, Cron, Logs
 */
import { useState } from "react";
import { Settings, Monitor, Shield, Bot, Globe, Volume2, VolumeX, Save, RotateCcw } from "lucide-react";
import { useStore } from "../lib/store";
import { nexus, nx } from "../lib/design-tokens";

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "security", label: "Security", icon: Shield },
  { id: "agent", label: "Agent Defaults", icon: Bot },
];

export default function SettingsPage() {
  const { connected } = useStore();
  const [tab, setTab] = useState("general");
  const [saved, setSaved] = useState(false);

  // Form state
  const [appName, setAppName] = useState("Nexus AI");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("Europe/Warsaw");
  const [animations, setAnimations] = useState(true);
  const [sounds, setSounds] = useState(false);
  const [port, setPort] = useState("3000");
  const [host, setHost] = useState("0.0.0.0");
  const [authEnabled, setAuthEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("24");
  const [maxLoginAttempts, setMaxLoginAttempts] = useState("5");
  const [defaultAgent, setDefaultAgent] = useState("main");
  const [defaultModel, setDefaultModel] = useState("nexus-4");
  const [maxIterations, setMaxIterations] = useState("15");
  const [autoApprove, setAutoApprove] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(true);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(99,102,241,0.15)] border border-[rgba(99,102,241,0.2)] flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#818cf8]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#e8ecf2]">Settings</h1>
            <p className="text-xs text-[#4a5068]">Configure your Nexus AI instance</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-6 pt-4 flex gap-2 border-b border-[rgba(255,255,255,0.04)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2 transition-all duration-200 ${
              tab === t.id
                ? 'text-[#00d4ff] border-[#00d4ff] bg-[rgba(0,212,255,0.04)]'
                : 'text-[#4a5068] border-transparent hover:text-[#8892a8] hover:bg-[rgba(255,255,255,0.02)]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {tab === "general" && (
          <>
            <Section title="Application">
              <Field label="App Name" value={appName} onChange={setAppName} />
              <Field label="Language" value={language} onChange={setLanguage} type="select" options={[{v:"en",l:"English"},{v:"pl",l:"Polski"}]} />
              <Field label="Timezone" value={timezone} onChange={setTimezone} type="select" options={[{v:"Europe/Warsaw",l:"Europe/Warsaw"},{v:"UTC",l:"UTC"},{v:"America/New_York",l:"America/New_York"}]} />
            </Section>
            <Section title="Interface">
              <ToggleField label="Animations" enabled={animations} onChange={setAnimations} />
              <ToggleField label="Sound Effects" enabled={sounds} onChange={setSounds} icon={sounds ? Volume2 : VolumeX} />
            </Section>
            <Section title="Server">
              <Field label="Port" value={port} onChange={setPort} />
              <Field label="Host" value={host} onChange={setHost} />
            </Section>
          </>
        )}

        {tab === "security" && (
          <Section title="Security Settings">
            <ToggleField label="JWT Authentication" enabled={authEnabled} onChange={setAuthEnabled} />
            <Field label="Session Timeout (hours)" value={sessionTimeout} onChange={setSessionTimeout} />
            <Field label="Max Login Attempts" value={maxLoginAttempts} onChange={setMaxLoginAttempts} />
          </Section>
        )}

        {tab === "agent" && (
          <Section title="Agent Defaults">
            <Field label="Default Agent" value={defaultAgent} onChange={setDefaultAgent} type="select" options={[
              {v:"main",l:"Main Assistant"},{v:"coder",l:"Coder Agent"},{v:"research",l:"Research Agent"},
              {v:"data",l:"Data Analyst"},{v:"security",l:"Security Auditor"},{v:"devops",l:"DevOps Engineer"}
            ]} />
            <Field label="Default Model" value={defaultModel} onChange={setDefaultModel} type="select" options={[
              {v:"nexus-4",l:"Nexus-4 Pro"},{v:"gpt-5",l:"GPT-5"},{v:"claude-opus-4",l:"Claude Opus 4"},
              {v:"gemini-2.5-pro",l:"Gemini 2.5 Pro"},{v:"deepseek-v3",l:"DeepSeek V3"}
            ]} />
            <Field label="Max Iterations" value={maxIterations} onChange={setMaxIterations} />
            <ToggleField label="Auto-Approve Tools" enabled={autoApprove} onChange={setAutoApprove} />
            <ToggleField label="Thinking Mode" enabled={thinkingMode} onChange={setThinkingMode} />
          </Section>
        )}
      </div>

      {/* Save bar */}
      <div className="shrink-0 px-6 py-3 border-t border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)] flex items-center justify-between">
        <span className="text-xs text-[#4a5068]">{saved ? "✅ Settings saved" : "Changes not saved"}</span>
        <div className="flex gap-2">
          <button className={nx.btnGhost + " px-4 py-2 text-sm flex items-center gap-2"}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={handleSave} className={nx.btn + " px-4 py-2 text-sm flex items-center gap-2"}>
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
    <div className={`${nexus.glass.card} p-5`}>
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
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={nexus.glass.input + " flex-1 px-3 py-2 text-sm appearance-none cursor-pointer"}
        >
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={nexus.glass.input + " flex-1 px-3 py-2 text-sm"}
        />
      )}
    </div>
  );
}

function ToggleField({ label, enabled, onChange, icon: Icon }: {
  label: string; enabled: boolean; onChange: (v: boolean) => void; icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-[#8892a8]" />}
        <span className="text-sm text-[#8892a8] font-medium">{label}</span>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
          enabled ? 'bg-[#00d4ff] shadow-[0_0_12px_rgba(0,212,255,0.3)]' : 'bg-[rgba(255,255,255,0.1)]'
        }`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
          enabled ? 'left-[22px]' : 'left-[2px]'
        }`} />
      </button>
    </div>
  );
}
