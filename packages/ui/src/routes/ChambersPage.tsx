import { useState, useEffect } from "react";

interface ChamberAgent {
  agentId: string; role: string; order: number;
}

interface Chamber {
  id: string; name: string; description?: string;
  agents: ChamberAgent[]; maxRounds: number; task: string;
  status: string; createdAt: string; completedAt?: string;
}

interface ChamberMessage {
  id: string; chamberId: string; agentId: string;
  agentName: string; role: string; round: number;
  content: string; type: string; createdAt: string;
}

export function ChambersPage() {
  const [chambers, setChambers] = useState<Chamber[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ chamber: Chamber; messages: ChamberMessage[] } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [maxRounds, setMaxRounds] = useState(3);
  const [selectedAgents, setSelectedAgents] = useState<{ agentId: string; role: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [cRes, aRes] = await Promise.all([fetch("/api/chambers"), fetch("/api/agents")]);
      if (cRes.ok) setChambers((await cRes.json()).chambers || []);
      if (aRes.ok) setAgents((await aRes.json()).agents || []);
    } catch {}
    setLoading(false);
  }

  async function create() {
    if (!name.trim() || !task.trim() || selectedAgents.length === 0) return;
    setError("");
    try {
      const res = await fetch("/api/chambers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), task: task.trim(), maxRounds,
          agents: selectedAgents.map((a, i) => ({ ...a, order: i })),
        }),
      });
      if (!res.ok) { setError(await res.text()); return; }
      setShowCreate(false); setName(""); setTask(""); setSelectedAgents([]);
      await load();
    } catch (e: any) { setError(e.message); }
  }

  async function run(id: string) {
    try {
      await fetch(`/api/chambers/${id}/run`, { method: "POST" });
      await load();
      if (selected?.chamber.id === id) viewDetails(id);
    } catch {}
  }

  async function viewDetails(id: string) {
    try {
      const res = await fetch(`/api/chambers/${id}`);
      if (res.ok) setSelected(await res.json());
    } catch {}
  }

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00f2fe]/20 to-[#4facfe]/20 border border-[#00f2fe]/30 flex items-center justify-center">
            <span className="text-sm">🏛️</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Agent Chambers</h2>
            <p className="text-[10px] text-slate-500">Multi-agent teams that collaborate on tasks</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-premium px-3 py-1.5 rounded-lg text-[11px]">+ New Chamber</button>
      </div>

      {error && <div className="glass-panel rounded-xl p-3 mb-4 border border-red-500/30 bg-red-950/20"><p className="text-[11px] text-red-400">{error}</p></div>}

      {loading ? <p className="text-xs text-slate-500">Loading...</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-2">
            {chambers.length === 0 && <p className="text-xs text-slate-500">No chambers yet. Create one to start.</p>}
            {chambers.map((c) => (
              <div key={c.id} onClick={() => viewDetails(c.id)}
                className={`glass-panel rounded-xl p-3 border cursor-pointer transition-all ${selected?.chamber.id === c.id ? "border-[#00f2fe]/40" : "border-slate-800/40 hover:border-slate-700"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white font-medium">{c.name}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${c.status === "running" ? "bg-emerald-500/20 text-emerald-400" : c.status === "completed" ? "bg-blue-500/20 text-blue-400" : "bg-slate-700/40 text-slate-400"}`}>{c.status}</span>
                </div>
                <p className="text-[9px] text-slate-500 mt-1 line-clamp-2">{c.task}</p>
                <div className="flex items-center gap-1 mt-2">
                  {c.agents.map((a, i) => <span key={i} className="text-[8px] bg-slate-800/60 px-1.5 py-0.5 rounded text-slate-400">{a.role}</span>)}
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2">
            {selected ? (
              <div className="glass-panel rounded-xl p-4 border border-slate-800/40">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">{selected.chamber.name}</h3>
                    <p className="text-[10px] text-slate-400">{selected.chamber.task}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[9px] text-slate-500">Round {selected.messages.reduce((m, msg) => Math.max(m, msg.round), 0)}/{selected.chamber.maxRounds}</span>
                    {selected.chamber.status !== "running" && selected.chamber.status !== "completed" && (
                      <button onClick={() => run(selected.chamber.id)} className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-500/30">▶ Run</button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                  {selected.messages.length === 0 && <p className="text-xs text-slate-500 text-center py-8">No messages yet. Start the chamber to begin.</p>}
                  {selected.messages.map((m) => (
                    <div key={m.id} className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/40">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-medium ${m.type === "delegation" ? "text-amber-400" : m.type === "decision" ? "text-emerald-400" : "text-[#00f2fe]"}`}>
                          [{m.role}] {m.agentName}
                        </span>
                        <span className="text-[8px] text-slate-600">R{m.round}</span>
                        {m.type !== "message" && <span className="text-[8px] text-slate-500">{m.type}</span>}
                      </div>
                      <div className="text-[10px] text-slate-300 whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass-panel rounded-xl p-8 border border-slate-800/40 flex items-center justify-center">
                <p className="text-xs text-slate-600">Select a chamber to view its discussion</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-[480px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-4">Create Chamber</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-slate-400 uppercase block mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Research Team" className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase block mb-1">Task</label>
                <textarea value={task} onChange={(e) => setTask(e.target.value)} placeholder="Research latest AI trends and write a report" rows={3} className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white resize-none" />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase block mb-1">Max Rounds</label>
                <input type="number" min={1} max={10} value={maxRounds} onChange={(e) => setMaxRounds(parseInt(e.target.value) || 3)} className="w-20 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase block mb-1">Agents (select & assign roles)</label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {agents.map((a) => {
                    const isSelected = selectedAgents.some((sa) => sa.agentId === a.id);
                    const role = selectedAgents.find((sa) => sa.agentId === a.id)?.role || "";
                    return (
                      <div key={a.id} className="flex items-center gap-2 bg-slate-800/40 rounded-lg px-2 py-1.5">
                        <input type="checkbox" checked={isSelected} onChange={(e) => {
                          if (e.target.checked) setSelectedAgents([...selectedAgents, { agentId: a.id, role: "" }]);
                          else setSelectedAgents(selectedAgents.filter((sa) => sa.agentId !== a.id));
                        }} className="accent-[#00f2fe]" />
                        <span className="text-[10px] text-white flex-1">{a.emoji || "🤖"} {a.name}</span>
                        {isSelected && (
                          <input type="text" value={role} onChange={(e) => setSelectedAgents(selectedAgents.map((sa) => sa.agentId === a.id ? { ...sa, role: e.target.value } : sa))}
                            placeholder="role (e.g. researcher)" className="w-24 bg-slate-700/60 border border-slate-600 rounded px-2 py-0.5 text-[9px] text-white" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 rounded-lg text-[11px] text-slate-400 border border-slate-800 hover:bg-slate-900">Cancel</button>
              <button onClick={create} disabled={!name.trim() || !task.trim() || selectedAgents.length === 0}
                className="btn-premium px-4 py-1.5 rounded-lg text-[11px] disabled:opacity-40">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
