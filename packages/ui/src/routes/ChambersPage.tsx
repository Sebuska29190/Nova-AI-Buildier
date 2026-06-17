/**
 * ChambersPage — Multi-Agent Collaboration with real-time updates
 * Delete, Stop, Live polling, Templates, Error handling
 */
import { useState, useEffect, useRef } from "react";
import { Building2, Play, Square, Trash2, Plus, X, Loader2, AlertTriangle, Users, MessageSquare, RefreshCw } from "lucide-react";

interface Chamber { id: string; name: string; task: string; agents: any[]; max_rounds: number; status: string; executionMode: string; created_at: string; completed_at?: string; }
interface ChamberMessage { id: string; agent_id: string; agent_name: string; role: string; round: number; content: string; type: string; created_at: string; }
interface ChamberAnalytics { totalMessages: number; messagesPerAgent: Record<string, number>; roundsUsed: number; delegations: number; decisions: number; }

const TEMPLATES = [
  { name: "Code Review Team", task: "Review the code changes for bugs, security issues, and improvements", agents: ["code-reviewer", "security-auditor"], maxRounds: 2, description: "3 agents review code from different angles" },
  { name: "Research Panel", task: "Research this topic thoroughly and provide a comprehensive analysis", agents: ["research-assistant", "data-analyst", "documentation-writer"], maxRounds: 3, description: "Multi-perspective research team" },
  { name: "Debug Squad", task: "Investigate and fix the reported bug", agents: ["auto-bug-fixer", "code-reviewer", "tester"], maxRounds: 2, description: "Debug team with fix, review, test" },
  { name: "Project Planning", task: "Break down this project into actionable tasks with estimates", agents: ["project-manager", "code-reviewer"], maxRounds: 2, description: "Planning and task decomposition" },
  { name: "Documentation Team", task: "Write comprehensive documentation for this feature", agents: ["documentation-writer", "code-reviewer"], maxRounds: 2, description: "Documentation from code analysis" },
];

export function ChambersPage() {
  const [chambers, setChambers] = useState<Chamber[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selected, setSelected] = useState<{ chamber: Chamber; messages: ChamberMessage[] } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [maxRounds, setMaxRounds] = useState(3);
  const [executionMode, setExecutionMode] = useState("sequential");
  const [workspace, setWorkspace] = useState("D:\\nova");
  const [selectedAgents, setSelectedAgents] = useState<{ id: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<ChamberAnalytics | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => { load(); loadAgents(); }, []);

  async function load() {
    setLoading(true);
    try { const res = await fetch("/api/chambers"); if (res.ok) setChambers((await res.json()).chambers || []); } catch {}
    setLoading(false);
  }

  async function loadAgents() {
    try { const res = await fetch("/api/agents"); if (res.ok) { const data = await res.json(); setAgents(data.agents || data || []); } } catch {}
  }

  // Live polling when chamber is running
  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/chambers/${running}`);
          if (res.ok) {
            const data = await res.json();
            setSelected(data);
            if (data.chamber?.status !== "running") {
              setRunning(null);
              load(); // Refresh list
            }
          }
        } catch {}
      }, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [running]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages?.length]);

  async function createChamber() {
    if (!name.trim() || !task.trim() || selectedAgents.length === 0) { setError("Name, task, and at least one agent required"); return; }
    setError("");
    try {
      const res = await fetch("/api/chambers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), task: task.trim(), max_rounds: maxRounds, executionMode, workspace: workspace.trim(), agents: selectedAgents.map((a, i) => ({ agentId: a.id, role: a.role, order: i })) }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      setShowCreate(false); setName(""); setTask(""); setMaxRounds(3); setExecutionMode("sequential"); setSelectedAgents([]);
      await load();
    } catch (e: any) { setError(e.message); }
  }

  async function runChamber(id: string) {
    setError(""); setRunning(id);
    try {
      const res = await fetch(`/api/chambers/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to start");
      // Load the updated chamber
      const detail = await fetch(`/api/chambers/${id}`);
      if (detail.ok) setSelected(await detail.json());
      setRunning(null);
      await load();
    } catch (e: any) { setError(`Run failed: ${e.message}`); setRunning(null); }
  }

  async function stopChamber(id: string) {
    try {
      await fetch(`/api/chambers/${id}/stop`, { method: "POST" });
      setRunning(null);
      // Reload to get updated status
      const detail = await fetch(`/api/chambers/${id}`);
      if (detail.ok) setSelected(await detail.json());
      await load();
    } catch {}
  }

  async function deleteChamber(id: string) {
    if (!confirm("Delete this chamber and all its messages?")) return;
    try {
      await fetch(`/api/chambers/${id}`, { method: "DELETE" });
      if (selected?.chamber.id === id) setSelected(null);
      await load();
    } catch {}
  }

  async function selectChamber(id: string) {
    try {
      const res = await fetch(`/api/chambers/${id}`);
      if (res.ok) setSelected(await res.json());
      // Load analytics
      try {
        const aRes = await fetch(`/api/chambers/${id}/analytics`);
        if (aRes.ok) setAnalytics(await aRes.json());
      } catch {}
    } catch {}
  }

  async function restartChamber(id: string) {
    if (!confirm("Restart this chamber? All messages will be cleared.")) return;
    try {
      await fetch(`/api/chambers/${id}/restart`, { method: "POST" });
      setSelected(null);
      setAnalytics(null);
      await load();
    } catch {}
  }

  function applyTemplate(template: typeof TEMPLATES[0]) {
    setTask(template.task);
    setSelectedAgents(template.agents.map(a => ({ id: a, role: a.replace(/-/g, " ") })));
    setMaxRounds(template.maxRounds);
    setExecutionMode("sequential");
  }

  const typeColors: Record<string, string> = {
    message: "bg-[rgba(99,102,241,0.1)] text-[#818cf8] border-[rgba(99,102,241,0.2)]",
    delegation: "bg-[rgba(245,158,11,0.1)] text-[#f59e0b] border-[rgba(245,158,11,0.2)]",
    decision: "bg-[rgba(34,197,94,0.1)] text-[#22c55e] border-[rgba(34,197,94,0.2)]",
    result: "bg-[rgba(34,197,94,0.1)] text-[#22c55e] border-[rgba(34,197,94,0.2)]",
  };

  const statusColors: Record<string, string> = {
    running: "bg-[rgba(34,197,94,0.1)] text-[#22c55e] border-[rgba(34,197,94,0.2)]",
    completed: "bg-[rgba(99,102,241,0.1)] text-[#818cf8] border-[rgba(99,102,241,0.2)]",
    idle: "bg-[rgba(255,255,255,0.04)] text-[#475569] border-[rgba(255,255,255,0.06)]",
    error: "bg-[rgba(239,68,68,0.1)] text-[#ef4444] border-[rgba(239,68,68,0.2)]",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Agent Chambers</h1>
            <p className="text-xs text-[#475569]">Multi-agent teams that collaborate on tasks</p>
          </div>
        </div>
        <div className="flex gap-2">
          <GlassButton variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={load}>Refresh</GlassButton>
          <GlassButton variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>New Chamber</GlassButton>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-panel rounded-xl p-3 border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.05)] flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#ef4444] shrink-0" />
          <p className="text-xs text-[#ef4444] flex-1">{error}</p>
          <button onClick={() => setError("")} className="text-[#ef4444] hover:text-white"><X size={12} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
        {/* Left: Chamber List */}
        <div className="glass-panel rounded-xl p-4 border border-[rgba(255,255,255,0.06)]">
          <h3 className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-medium mb-3">Chambers ({chambers.length})</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={16} className="text-[#6366f1] animate-spin" /></div>
          ) : chambers.length === 0 ? (
            <div className="text-center py-8">
              <Building2 size={32} className="mx-auto mb-2 text-[#475569]" />
              <p className="text-[11px] text-[#475569]">No chambers yet</p>
              <p className="text-[9px] text-[#475569] mt-1">Create one to start multi-agent collaboration</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {chambers.map(ch => (
                <div key={ch.id} onClick={() => selectChamber(ch.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selected?.chamber.id === ch.id
                      ? "bg-[rgba(99,102,241,0.1)] border-[rgba(99,102,241,0.3)]"
                      : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]"
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-white font-medium truncate">{ch.name}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-lg font-mono ${statusColors[ch.status] || statusColors.idle}`}>{ch.status}</span>
                  </div>
                  <p className="text-[10px] text-[#475569] line-clamp-2">{ch.task}</p>
                  <div className="flex gap-1 mt-2">
                    {(ch.agents || []).slice(0, 3).map((a: any, i: number) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(99,102,241,0.06)] text-[#475569]">{a.agentId}</span>
                    ))}
                    {(ch.agents || []).length > 3 && <span className="text-[9px] text-[#475569]">+{(ch.agents || []).length - 3}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Chamber Detail */}
        <div className="glass-panel rounded-xl p-4 border border-[rgba(255,255,255,0.06)] flex flex-col">
          {selected ? (
            <>
              {/* Chamber Header */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-[rgba(255,255,255,0.06)]">
                <div>
                  <h3 className="text-sm font-bold text-white">{selected.chamber.name}</h3>
                  <p className="text-[10px] text-[#475569] mt-0.5">{selected.chamber.task}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[9px] text-[#475569]">Round {selected.messages?.filter((m: any) => m.type === "message").length > 0 ? Math.max(...selected.messages.filter((m: any) => m.type === "message").map((m: any) => m.round)) : 0}/{selected.chamber.max_rounds}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-lg ${statusColors[selected.chamber.status] || statusColors.idle}`}>{selected.chamber.status}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-[rgba(255,255,255,0.04)] text-[#475569] border border-[rgba(255,255,255,0.06)]">{selected.chamber.executionMode || "sequential"}</span>
                    {selected.chamber.workspace && <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-[rgba(34,197,94,0.06)] text-[#22c55e] border border-[rgba(34,197,94,0.15)] font-mono">{selected.chamber.workspace}</span>}
                    {running === selected.chamber.id && <span className="text-[9px] text-[#22c55e] flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Running...</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {selected.chamber.status !== "running" && selected.chamber.status !== "completed" && (
                    <GlassButton variant="primary" size="sm" icon={<Play size={12} />} onClick={() => runChamber(selected.chamber.id)} loading={running === selected.chamber.id}>
                      Run
                    </GlassButton>
                  )}
                  {selected.chamber.status === "running" && (
                    <GlassButton variant="ghost" size="sm" icon={<Square size={12} />} onClick={() => stopChamber(selected.chamber.id)}>
                      Stop
                    </GlassButton>
                  )}
                  {selected.chamber.status === "completed" && (
                    <GlassButton variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={() => restartChamber(selected.chamber.id)}>
                      Restart
                    </GlassButton>
                  )}
                  <GlassButton variant="ghost" size="sm" icon={<Trash2 size={12} />} onClick={() => deleteChamber(selected.chamber.id)}>
                    Delete
                  </GlassButton>
                </div>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto space-y-3 max-h-[60vh]">
                {!selected.messages || selected.messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare size={32} className="mx-auto mb-2 text-[#475569]" />
                    <p className="text-[11px] text-[#475569]">No messages yet</p>
                    <p className="text-[9px] text-[#475569] mt-1">Run the chamber to start collaboration</p>
                  </div>
                ) : (
                  selected.messages.map((msg: any) => (
                    <div key={msg.id} className="glass-panel rounded-xl p-3 border border-[rgba(255,255,255,0.06)]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-[rgba(99,102,241,0.15)] flex items-center justify-center">
                          <Users size={10} className="text-[#818cf8]" />
                        </div>
                        <span className="text-xs text-white font-medium">{msg.agent_name}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded border ${typeColors[msg.type] || typeColors.message}`}>{msg.type}</span>
                        <span className="text-[8px] text-[#475569] ml-auto">R{msg.round}</span>
                      </div>
                      <p className="text-xs text-[#94a3b8] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Analytics Panel */}
              {analytics && selected.chamber.status === "completed" && (
                <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                  <h4 className="text-[10px] text-[#475569] uppercase tracking-wider mb-2">Analytics</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
                      <p className="text-lg font-bold text-white font-mono">{analytics.totalMessages}</p>
                      <p className="text-[9px] text-[#475569]">Messages</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
                      <p className="text-lg font-bold text-white font-mono">{analytics.roundsUsed}</p>
                      <p className="text-[9px] text-[#475569]">Rounds</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
                      <p className="text-lg font-bold text-white font-mono">{analytics.delegations}</p>
                      <p className="text-[9px] text-[#475569]">Delegations</p>
                    </div>
                  </div>
                  {/* Messages per agent */}
                  {Object.keys(analytics.messagesPerAgent).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(analytics.messagesPerAgent).sort((a, b) => b[1] - a[1]).map(([agent, count]) => (
                        <div key={agent} className="flex items-center gap-2 text-[9px]">
                          <span className="text-[#94a3b8] truncate flex-1">{agent}</span>
                          <div className="w-24 h-1.5 rounded-full bg-[rgba(255,255,255,0.04)]">
                            <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${(count / analytics.totalMessages) * 100}%` }} />
                          </div>
                          <span className="text-[#475569] w-6 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Building2 size={48} className="mx-auto mb-3 text-[#475569]" />
                <h3 className="text-lg font-bold text-white mb-1">Agent Chambers</h3>
                <p className="text-xs text-[#475569] max-w-sm">Select a chamber to view details, or create a new one to start multi-agent collaboration.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="glass-panel rounded-2xl p-6 w-full max-w-lg border border-[rgba(255,255,255,0.08)] shadow-2xl animate-dialog-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Create Chamber</h2>
              <button onClick={() => setShowCreate(false)} className="text-[#475569] hover:text-white"><X size={18} /></button>
            </div>

            {/* Templates */}
            <div className="mb-4">
              <p className="text-[10px] text-[#475569] uppercase tracking-wider mb-2">Quick Templates</p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map(t => (
                  <button key={t.name} onClick={() => applyTemplate(t)}
                    className="text-[9px] px-2 py-1 rounded-lg bg-[rgba(99,102,241,0.06)] text-[#818cf8] border border-[rgba(99,102,241,0.15)] hover:bg-[rgba(99,102,241,0.12)] transition-all">
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Chamber name..."
                  className="glass-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">Task</label>
                <textarea value={task} onChange={e => setTask(e.target.value)} placeholder="What should the agents collaborate on?" rows={3}
                  className="glass-input w-full px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">Workspace Path</label>
                <input type="text" value={workspace} onChange={e => setWorkspace(e.target.value)} placeholder="D:\nova"
                  className="glass-input w-full px-3 py-2 text-sm font-mono" />
                <p className="text-[9px] text-[#475569] mt-1">Working directory for agents (files, code, etc.)</p>
              </div>
              <div>
                <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">Execution Mode</label>
                <div className="flex gap-2">
                  {[
                    { id: "sequential", label: "Sequential", desc: "Agents take turns" },
                    { id: "parallel", label: "Parallel", desc: "All agents at once" },
                    { id: "debate", label: "Debate", desc: "Agents argue then vote" },
                  ].map(mode => (
                    <button key={mode.id} onClick={() => setExecutionMode(mode.id)}
                      className={`flex-1 p-2 rounded-lg border text-center transition-all ${
                        executionMode === mode.id
                          ? "bg-[rgba(99,102,241,0.1)] border-[rgba(99,102,241,0.3)] text-[#818cf8]"
                          : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] text-[#475569] hover:border-[rgba(255,255,255,0.12)]"
                      }`}>
                      <p className="text-[10px] font-medium">{mode.label}</p>
                      <p className="text-[8px] mt-0.5">{mode.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">Max Rounds (1-10)</label>
                <input type="number" min={1} max={10} value={maxRounds} onChange={e => setMaxRounds(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  className="glass-input w-24 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-2 block">Agents</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {agents.map(agent => {
                    const isSelected = selectedAgents.some(a => a.id === agent.id);
                    return (
                      <div key={agent.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                        isSelected ? "bg-[rgba(99,102,241,0.1)] border-[rgba(99,102,241,0.2)]" : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]"
                      }`} onClick={() => {
                        if (isSelected) setSelectedAgents(prev => prev.filter(a => a.id !== agent.id));
                        else setSelectedAgents(prev => [...prev, { id: agent.id, role: agent.id.replace(/-/g, " ") }]);
                      }}>
                        <span className="text-sm">{isSelected ? "☑" : "☐"}</span>
                        <span className="text-xs text-white">{agent.name || agent.id}</span>
                        {isSelected && (
                          <input type="text" value={selectedAgents.find(a => a.id === agent.id)?.role || ""}
                            onChange={e => setSelectedAgents(prev => prev.map(a => a.id === agent.id ? { ...a, role: e.target.value } : a))}
                            onClick={e => e.stopPropagation()}
                            placeholder="Role..."
                            className="ml-auto glass-input px-2 py-1 text-[10px] w-32" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[rgba(255,255,255,0.06)]">
              <GlassButton variant="ghost" onClick={() => setShowCreate(false)}>Cancel</GlassButton>
              <GlassButton variant="primary" onClick={createChamber} disabled={!name.trim() || !task.trim() || selectedAgents.length === 0}>Create</GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GlassButton({ children, variant = "primary", size = "md", icon, onClick, disabled, loading, className = "" }: {
  children: React.ReactNode; variant?: string; size?: string; icon?: React.ReactNode;
  onClick?: () => void; disabled?: boolean; loading?: boolean; className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-semibold",
    ghost: "bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] text-[#94a3b8] hover:bg-[rgba(255,255,255,0.08)] hover:text-white",
  };
  const sizes: Record<string, string> = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl transition-all ${styles[variant] || styles.primary} ${sizes[size] || sizes.md} disabled:opacity-40 ${className}`}>
      {loading ? <Loader2 size={12} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
