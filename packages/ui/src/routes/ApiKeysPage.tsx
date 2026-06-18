/**
 * ApiKeysPage — Encrypted API key management with audit log
 */
import { useState } from "react";
import { KeyRound, Eye, EyeOff, Copy, RotateCw, Trash2, Plus, Shield, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { nexus, nx } from "../lib/design-tokens";

interface KeyEntry {
  provider: string; masked: string; status: 'valid' | 'error' | 'untested';
  lastTested?: string; errorMsg?: string;
}

const MOCK_KEYS: KeyEntry[] = [
  { provider: "OpenAI", masked: "sk-pr****b2c3", status: "valid", lastTested: "2 hours ago" },
  { provider: "Anthropic", masked: "sk-an****d4e5", status: "valid", lastTested: "2 hours ago" },
  { provider: "DeepSeek", masked: "sk-de****f6g7", status: "error", lastTested: "1 hour ago", errorMsg: "Invalid API key (401)" },
  { provider: "Google Gemini", masked: "AIza****h8i9", status: "valid", lastTested: "3 hours ago" },
  { provider: "Groq", masked: "gsk_****j0k1", status: "untested" },
];

const STATUS_ICON = {
  valid: CheckCircle, error: XCircle, untested: AlertTriangle,
};
const STATUS_COLOR = {
  valid: "text-[#10b981]", error: "text-[#ef4444]", untested: "text-[#f59e0b]",
};
const STATUS_BG = {
  valid: "bg-[rgba(16,185,129,0.1)] border-[rgba(16,185,129,0.2)]",
  error: "bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)]",
  untested: "bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.2)]",
};

const AUDIT_LOG = [
  { time: "2026-06-18 01:23", action: "OpenAI key tested", result: "success" },
  { time: "2026-06-17 22:15", action: "Anthropic key added", result: "by Admin" },
  { time: "2026-06-17 18:40", action: "DeepSeek key failed", result: "401" },
];

export default function ApiKeysPage() {
  const [keys] = useState<KeyEntry[]>(MOCK_KEYS);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newProvider, setNewProvider] = useState("OpenAI");
  const [newKey, setNewKey] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const toggleVisibility = (provider: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      next.has(provider) ? next.delete(provider) : next.add(provider);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-[#fca5a5]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#e8ecf2]">API Keys</h1>
              <p className="text-xs text-[#4a5068]">Encrypted at rest · Never shared</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className={nx.btn + " px-4 py-2 text-sm flex items-center gap-2"}>
            <Plus className="w-4 h-4" /> Add Key
          </button>
        </div>
      </div>

      {/* Add Key Form */}
      {showAdd && (
        <div className="shrink-0 mx-6 mt-4 p-4 rounded-xl bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)]">
          <div className="flex items-center gap-4">
            <select value={newProvider} onChange={e => setNewProvider(e.target.value)} className={nexus.glass.input + " px-3 py-2 text-sm"}>
              {["OpenAI","Anthropic","DeepSeek","Google Gemini","Groq","Qwen","Kimi","MiniMax","LM Studio","Zhipu","Ollama"].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input type="password" value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="sk-..." className={nexus.glass.input + " flex-1 px-3 py-2 text-sm"} />
            <button className={nx.btn + " px-4 py-2 text-sm flex items-center gap-2 shrink-0"}>
              <Shield className="w-3.5 h-3.5" /> Add & Encrypt
            </button>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-[#4a5068]" />
          <span className="text-xs font-medium text-[#4a5068] uppercase tracking-wider">LLM Providers</span>
        </div>
        {keys.map(k => {
          const SI = STATUS_ICON[k.status];
          return (
            <div key={k.provider} className={`${nexus.glass.card} p-4 flex items-center gap-4 ${k.status === 'error' ? 'border-[rgba(239,68,68,0.15)]' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.15)] flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-[#818cf8]">{k.provider[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#e8ecf2]">{k.provider}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium border ${STATUS_BG[k.status]} ${STATUS_COLOR[k.status]}`}>
                    <SI className="w-3 h-3" />
                    {k.status === 'valid' ? 'Valid' : k.status === 'error' ? 'Error' : 'Untested'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs text-[#4a5068] font-mono">{visibleKeys.has(k.provider) ? 'sk-••••••••••••••••' : k.masked}</code>
                  {k.lastTested && <span className="text-[10px] text-[#4a5068]">Last tested: {k.lastTested}</span>}
                </div>
                {k.errorMsg && <p className="text-xs text-[#ef4444] mt-1">{k.errorMsg}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleVisibility(k.provider)} className={nx.button.icon} title="Show/Hide">
                  {visibleKeys.has(k.provider) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button className={nx.button.icon} title="Copy"><Copy className="w-3.5 h-3.5" /></button>
                <button className={nx.button.icon} title="Test"><RotateCw className="w-3.5 h-3.5" /></button>
                <button className="p-2 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#fca5a5] hover:bg-[rgba(239,68,68,0.2)] transition-all" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit Log */}
      <div className="shrink-0 border-t border-[rgba(255,255,255,0.06)] px-6 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068]">Key Audit Log</span>
        </div>
        <div className="space-y-1">
          {AUDIT_LOG.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 text-xs">
              <span className="text-[#4a5068] font-mono">{entry.time}</span>
              <span className="text-[#8892a8]">{entry.action}</span>
              <span className={entry.result === 'success' ? 'text-[#10b981]' : 'text-[#ef4444]'}>· {entry.result}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
