/**
 * ApiKeysPage — Real API key management with live testing
 * Uses backend /api/config/providers for real data
 */
import { useState, useEffect } from "react";
import { KeyRound, Eye, EyeOff, Copy, RotateCw, Trash2, Plus, Shield, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { api } from "../lib/api";

interface ProviderEntry {
  id: string; name: string; hasKey: boolean; enabled: boolean;
  models: number; lastTested?: string; status?: 'valid' | 'error' | 'untested';
}

function ApiKeysPage() {
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [newProvider, setNewProvider] = useState("openai");
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [message, setMessage] = useState("");

  useEffect(() => { loadProviders(); }, []);

  async function loadProviders() {
    setLoading(true);
    try {
      const res = await fetch("/api/config/providers");
      const data = await res.json();
      const list: ProviderEntry[] = (data.providers || []).map((p: any) => ({
        id: p.id || p.providerId,
        name: p.name || p.id || p.providerId,
        hasKey: p.hasKey || p.hasApiKey || false,
        enabled: p.enabled !== false,
        models: p.models?.length || p.modelCount || 0,
        status: p.status || (p.hasKey ? 'untested' : 'untested'),
      }));
      setProviders(list);
    } catch (e) {
      setMessage("Failed to load providers");
    } finally {
      setLoading(false);
    }
  }

  async function testProvider(providerId: string) {
    setTesting(prev => new Set(prev).add(providerId));
    try {
      const res = await fetch(`/api/config/providers/${providerId}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await res.json();
      setTestResults(prev => ({ ...prev, [providerId]: result }));
      setProviders(prev => prev.map(p => p.id === providerId ? { ...p, status: result.ok ? 'valid' : 'error', lastTested: 'Just now' } : p));
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [providerId]: { ok: false, error: e.message } }));
    } finally {
      setTesting(prev => { const s = new Set(prev); s.delete(providerId); return s; });
    }
  }

  async function saveKey() {
    if (!newKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/config/providers/${newProvider}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: newKey.trim(), enabled: true }),
      });
      const data = await res.json();
      if (data.status === "saved") {
        setMessage(`✅ Key saved for ${newProvider}`);
        setNewKey(""); setShowAdd(false);
        loadProviders();
      } else {
        setMessage(`❌ ${data.error || "Failed"}`);
      }
    } catch (e: any) {
      setMessage(`❌ ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(providerId: string) {
    if (!confirm(`Remove API key for ${providerId}?`)) return;
    try {
      await fetch(`/api/config/providers/${providerId}`, { method: "DELETE" });
      loadProviders();
      setMessage(`Key removed for ${providerId}`);
    } catch {}
  }

  function toggleVisibility(id: string) {
    setVisibleKeys(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.15)] flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-[#818cf8]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">API Keys</h1>
              <p className="text-xs text-[#4a5068]">
                {providers.filter(p => p.hasKey).length}/{providers.length} providers configured
              </p>
            </div>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-nova px-4 py-2 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Key
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-xs ${message.startsWith("✅") ? "bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] text-[#10b981]" : "bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[#ef4444]"}`}>
          {message}
        </div>
      )}

      {/* Add Key Form */}
      {showAdd && (
        <div className="shrink-0 mb-4 p-4 rounded-xl bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)]">
          <div className="flex items-center gap-3">
            <select value={newProvider} onChange={e => setNewProvider(e.target.value)} className="glass-input px-3 py-2 text-sm">
              {providers.filter(p => !p.hasKey).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {providers.filter(p => !p.hasKey).length === 0 && (
                <option value="">All providers configured</option>
              )}
            </select>
            <input type="password" value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="sk-..." className="glass-input flex-1 px-3 py-2 text-sm" />
            <button onClick={saveKey} disabled={saving || !newKey.trim()} className="btn-nova px-4 py-2 text-sm flex items-center gap-2 shrink-0 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
              {saving ? "Saving..." : "Add & Encrypt"}
            </button>
          </div>
        </div>
      )}

      {/* Providers List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[#4a5068]" />
          <span className="text-xs font-medium text-[#4a5068] uppercase tracking-wider">LLM Providers</span>
        </div>

        {loading ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Loader2 className="w-5 h-5 text-[#818cf8] animate-spin mx-auto mb-2" />
            <p className="text-xs text-[#4a5068]">Loading providers...</p>
          </div>
        ) : providers.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="text-sm text-[#4a5068]">No providers found. Start the server to detect providers.</p>
          </div>
        ) : (
          providers.map(p => {
            const testResult = testResults[p.id];
            const isTesting = testing.has(p.id);
            return (
              <div key={p.id} className={`glass-card rounded-2xl p-4 flex items-center gap-4 ${p.status === 'error' ? 'border-[rgba(239,68,68,0.15)]' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.hasKey ? "bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.15)]" : "bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]"}`}>
                  <span className={`text-sm font-bold ${p.hasKey ? "text-[#818cf8]" : "text-[#4a5068]"}`}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#e8ecf2]">{p.name}</span>
                    {p.hasKey ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium border ${
                        p.status === 'valid' ? "bg-[rgba(16,185,129,0.08)] border-[rgba(16,185,129,0.2)] text-[#10b981]"
                        : p.status === 'error' ? "bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.2)] text-[#ef4444]"
                        : "bg-[rgba(245,158,11,0.08)] border-[rgba(245,158,11,0.15)] text-[#f59e0b]"
                      }`}>
                        {p.status === 'valid' ? '✓ Valid' : p.status === 'error' ? '✗ Error' : 'Untested'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[#4a5068]">
                        No key
                      </span>
                    )}
                    <span className="text-[10px] text-[#4a5068]">{p.models} models</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-[#4a5068] font-mono">
                      {p.hasKey ? (visibleKeys.has(p.id) ? '••••••••••••' : 'sk-••••••••') : 'Not configured'}
                    </code>
                    {p.lastTested && <span className="text-[10px] text-[#4a5068]">Tested: {p.lastTested}</span>}
                    {testResult && !testResult.ok && (
                      <span className="text-[10px] text-[#ef4444]">{testResult.error}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.hasKey && (
                    <>
                      <button onClick={() => toggleVisibility(p.id)} className="p-2 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#8892a8] hover:text-[#e8ecf2] hover:bg-[rgba(255,255,255,0.08)] transition-all" title="Show/Hide">
                        {visibleKeys.has(p.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => testProvider(p.id)} disabled={isTesting} className="p-2 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#8892a8] hover:text-[#e8ecf2] hover:bg-[rgba(255,255,255,0.08)] transition-all disabled:opacity-50" title="Test connection">
                        {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => navigator.clipboard.writeText(p.id)} className="p-2 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#8892a8] hover:text-[#e8ecf2] hover:bg-[rgba(255,255,255,0.08)] transition-all" title="Copy name"><Copy className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteKey(p.id)} className="p-2 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#fca5a5] hover:bg-[rgba(239,68,68,0.2)] transition-all" title="Delete key">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export { ApiKeysPage };
export default ApiKeysPage;
