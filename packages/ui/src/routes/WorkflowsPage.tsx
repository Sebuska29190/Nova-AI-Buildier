import { useState, useEffect } from "react";

const STEP_TYPES: { type: string; fields: { key: string; label: string; type: string; required?: boolean }[] }[] = [
  { type: "agent", fields: [
    { key: "agentId", label: "Agent ID", type: "text", required: true },
    { key: "message", label: "Message", type: "text", required: true },
  ]},
  { type: "tool", fields: [
    { key: "toolName", label: "Tool Name", type: "text", required: true },
    { key: "arguments", label: "Arguments (JSON)", type: "text" },
  ]},
  { type: "condition", fields: [
    { key: "variable", label: "Variable", type: "text", required: true },
    { key: "operator", label: "Operator", type: "text" },
    { key: "value", label: "Value", type: "text" },
  ]},
  { type: "delay", fields: [{ key: "ms", label: "Milliseconds", type: "number" }]},
  { type: "notify", fields: [{ key: "message", label: "Message", type: "text", required: true }]},
];

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [steps, setSteps] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/workflows").then(r => r.ok && r.json()).then(d => d && setWorkflows(d.workflows)).catch(() => {});
    fetch("/api/agents").then(r => r.ok && r.json()).then(d => d && setAgents(d.agents)).catch(() => {});
  }, []);

  async function create() {
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: desc.trim(), steps }),
    });
    if (res.ok) { setShowCreate(false); setName(""); setDesc(""); setSteps([]); fetch("/api/workflows").then(r => r.json()).then(d => setWorkflows(d.workflows)); }
  }

  async function run(id: string) {
    await fetch(`/api/workflows/${id}/run`, { method: "POST" });
    fetch("/api/workflows").then(r => r.json()).then(d => setWorkflows(d.workflows));
  }

  function addStep() {
    setSteps([...steps, { id: crypto.randomUUID().slice(0, 8), type: "agent", label: "", config: {}, nextOnSuccess: "", nextOnFailure: "" }]);
  }

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-white">Workflow Builder</h2>
          <p className="text-[10px] text-slate-500">Chain agents, tools, and conditions</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-premium px-3 py-1.5 rounded-lg text-[11px]">+ New Workflow</button>
      </div>

      {workflows.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 border border-slate-800/40 text-center">
          <p className="text-xs text-slate-500 mb-3">No workflows yet</p>
          <button onClick={() => setShowCreate(true)} className="btn-premium px-3 py-1.5 rounded-lg text-[11px]">Create your first workflow</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {workflows.map((w) => (
            <div key={w.id} className="glass-panel rounded-xl p-3 border border-slate-800/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white font-medium">{w.name}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${w.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700/40 text-slate-400"}`}>{w.status}</span>
              </div>
              <p className="text-[9px] text-slate-500 mb-2">{w.description || `${w.steps.length} steps`}</p>
              <div className="flex items-center gap-1 mb-2">
                {w.steps.map((s: any) => <span key={s.id} className="text-[8px] bg-slate-800/60 px-1.5 py-0.5 rounded text-slate-400">{s.type}</span>)}
              </div>
              <div className="flex gap-2">
                <button onClick={() => run(w.id)} className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-500/30">▶ Run</button>
                <button onClick={async () => { await fetch(`/api/workflows/${w.id}`, { method: "DELETE" }); fetch("/api/workflows").then(r => r.json()).then(d => setWorkflows(d.workflows)); }}
                  className="text-[9px] bg-red-950/20 text-red-400 px-2 py-1 rounded-lg hover:bg-red-950/40">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-[540px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-4">New Workflow</h3>
            <div className="space-y-3">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Workflow name" className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
              <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[9px] text-slate-400 uppercase">Steps</label>
                  <button onClick={addStep} className="text-[9px] text-[#00f2fe] hover:underline">+ Add Step</button>
                </div>
                {steps.map((step, i) => {
                  const typeDef = STEP_TYPES.find((st) => st.type === step.type);
                  return (
                    <div key={i} className="bg-slate-800/40 rounded-xl p-3 mb-2 border border-slate-700/40">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] text-slate-400">Step {i + 1}</span>
                        <select value={step.type} onChange={(e) => { const s = [...steps]; s[i].type = e.target.value; s[i].config = {}; setSteps(s); }}
                          className="bg-slate-700/60 border border-slate-600 rounded px-2 py-0.5 text-[9px] text-white">
                          {STEP_TYPES.map((st) => <option key={st.type} value={st.type}>{st.type}</option>)}
                        </select>
                        <input type="text" value={step.label} onChange={(e) => { const s = [...steps]; s[i].label = e.target.value; setSteps(s); }}
                          placeholder="Label" className="flex-1 bg-slate-700/60 border border-slate-600 rounded px-2 py-0.5 text-[9px] text-white" />
                        <button onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="text-[9px] text-red-400">✕</button>
                      </div>
                      {typeDef?.fields.map((f) => (
                        f.type === "text" ? (
                          f.key === "arguments" ? (
                            <textarea key={f.key} value={step.config[f.key] || ""} onChange={(e) => { const s = [...steps]; s[i].config = { ...s[i].config, [f.key]: e.target.value }; setSteps(s); }}
                              placeholder={f.label} rows={2} className="w-full bg-slate-700/60 border border-slate-600 rounded px-2 py-1 text-[9px] text-white mt-1 resize-none" />
                          ) : (
                            <input key={f.key} type="text" value={step.config[f.key] || ""} onChange={(e) => { const s = [...steps]; s[i].config = { ...s[i].config, [f.key]: e.target.value }; setSteps(s); }}
                              placeholder={f.label} className="w-full bg-slate-700/60 border border-slate-600 rounded px-2 py-1 text-[9px] text-white mt-1" />
                          )
                        ) : (
                          <input key={f.key} type={f.type} value={step.config[f.key] || ""} onChange={(e) => { const s = [...steps]; s[i].config = { ...s[i].config, [f.key]: f.type === "number" ? parseInt(e.target.value) || 0 : e.target.value }; setSteps(s); }}
                            placeholder={f.label} className="w-full bg-slate-700/60 border border-slate-600 rounded px-2 py-1 text-[9px] text-white mt-1" />
                        )
                      ))}
                      {step.type === "agent" && (
                        <select value={step.config.agentId || ""} onChange={(e) => { const s = [...steps]; s[i].config.agentId = e.target.value; setSteps(s); }}
                          className="w-full bg-slate-700/60 border border-slate-600 rounded px-2 py-1 text-[9px] text-white mt-1">
                          <option value="">Select agent...</option>
                          {agents.map((a) => <option key={a.id} value={a.id}>{a.emoji || "🤖"} {a.name}</option>)}
                        </select>
                      )}
                      <div className="flex gap-2 mt-2">
                        <input type="text" value={step.nextOnSuccess || ""} onChange={(e) => { const s = [...steps]; s[i].nextOnSuccess = e.target.value; setSteps(s); }}
                          placeholder="→ on success (step id)" className="flex-1 bg-slate-700/60 border border-slate-600 rounded px-2 py-0.5 text-[8px] text-white" />
                        <input type="text" value={step.nextOnFailure || ""} onChange={(e) => { const s = [...steps]; s[i].nextOnFailure = e.target.value; setSteps(s); }}
                          placeholder="→ on failure (step id)" className="flex-1 bg-slate-700/60 border border-slate-600 rounded px-2 py-0.5 text-[8px] text-white" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 rounded-lg text-[11px] text-slate-400 border border-slate-800">Cancel</button>
              <button onClick={create} disabled={!name.trim() || steps.length === 0} className="btn-premium px-4 py-1.5 rounded-lg text-[11px] disabled:opacity-40">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
