import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formModel, setFormModel] = useState("deepseek/deepseek-chat");
  const [formSkills, setFormSkills] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [taskResult, setTaskResult] = useState("");
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [taskModel, setTaskModel] = useState("");
  const [taskRunning, setTaskRunning] = useState(false);
  const [workspacePath, setWorkspacePath] = useState("");
  const [enabledSkills, setEnabledSkills] = useState<string[]>([]);
  const [thinkingLevel, setThinkingLevel] = useState("medium");
  const [wsConnected, setWsConnected] = useState(false);
  const [agentLog, setAgentLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [agentFiles, setAgentFiles] = useState<any[]>([]);
  const [editingFile, setEditingFile] = useState<{ name: string; content: string } | null>(null);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [agentTab, setAgentTab] = useState<"info" | "files" | "skills">("info");

  useEffect(() => {
    loadAgents();
    api.models().then((m: any[]) => setAvailableModels(m)).catch(() => {});
    fetch("/api/skills").then(r => r.json()).then(d => setAllSkills(d.skills || [])).catch(() => {});
    connectSSE();
    return () => { /* cleanup handled in connectSSE */ };
  }, []);

  async function loadAgents() {
    setLoading(true);
    try {
      setAgents(await api.agents());
    } catch (e: any) {
      setErrorMsg("Failed to load agents: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function createAgent() {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim(),
          model: formModel,
          skills: formSkills.split(",").map(s => s.trim()).filter(Boolean),
          systemPrompt: formPrompt.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAgents();
      setShowForm(false);
      setFormName(""); setFormDescription(""); setFormModel("deepseek/deepseek-chat"); setFormSkills(""); setFormPrompt("");
    } catch (e: any) {
      setErrorMsg("Failed to create agent: " + (e.message || e));
    } finally {
      setCreating(false);
    }
  }

  async function deleteAgent(id: string) {
    try {
      await fetch("/api/agents/" + id, { method: "DELETE" });
      if (selectedAgent?.id === id) setSelectedAgent(null);
      await loadAgents();
    } catch (e: any) {
      setErrorMsg("Failed to delete agent: " + (e.message || e));
    }
  }

  async function startAgent(id: string) {
    try {
      await fetch("/api/agents/" + id + "/start", { method: "POST" });
      await loadAgents();
    } catch (e: any) {
      setErrorMsg("Failed to start agent: " + (e.message || e));
    }
  }

  async function stopAgent(id: string) {
    try {
      await fetch("/api/agents/" + id + "/stop", { method: "POST" });
      await loadAgents();
    } catch (e: any) {
      setErrorMsg("Failed to stop agent: " + (e.message || e));
    }
  }

  async function runAgentTask(agentId: string, task: string) {
    setTaskRunning(true);
    setTaskResult("");
    try {
      const res = await fetch(`/api/agents/${agentId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, workspace: workspacePath || undefined }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(res.status + ": " + errText);
      }
      const data = await res.json();
      setTaskResult(`✅ Agent started in background (runId: ${data.runId || "n/a"})`);
      setTimeout(() => setShowAgentModal(false), 1500);
    } catch (e: any) {
      setTaskResult("Error: " + (e.message || e));
    } finally {
      setTaskRunning(false);
    }
  }

  async function toggleAgent(id: string) {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;
    if (agent.status === "running") await stopAgent(id);
    else await startAgent(id);
  }

  async function loadAgentFiles(agentId: string) {
    try {
      const res = await fetch(`/api/agents/${agentId}/files`);
      const data = await res.json();
      setAgentFiles(data.files?.filter((f: any) => !f.missing) || []);
    } catch { setAgentFiles([]); }
  }

  async function saveAgentFile(agentId: string, fileName: string, content: string) {
    try {
      await fetch(`/api/agents/${agentId}/files/${fileName}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setEditingFile(null);
      loadAgentFiles(agentId);
    } catch (e: any) {
      setErrorMsg("Failed to save file: " + (e.message || e));
    }
  }

  async function updateAgentSkills(agentId: string, skills: string[]) {
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills }),
      });
      loadAgents();
    } catch (e: any) {
      setErrorMsg("Failed to update skills: " + (e.message || e));
    }
  }

  function connectSSE() {
    try {
      const socket = new WebSocket(`ws://${window.location.host}/ws`);
      socket.onopen = () => setWsConnected(true);
      socket.onmessage = (ev) => {
        setAgentLog((prev) => [...prev, ev.data]);
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "job_done") {
            loadAgents();
            if (selectedAgent?.id === data.agentId) {
              setTaskResult(data.status === "completed"
                ? "✅ Agent completed the task. Check MEMORY.md for report."
                : "❌ Agent task failed" + (data.error ? ": " + data.error : ""));
            }
          }
        } catch { /* ignore */ }
      };
      socket.onclose = () => setWsConnected(false);
      socket.onerror = () => setWsConnected(false);
    } catch {
      setWsConnected(false);
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case "running": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "idle": return "bg-slate-500/20 text-slate-400 border-slate-500/30";
      case "error": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "stopped": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Agents</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {wsConnected ? (
              <span className="text-emerald-400">● Connected</span>
            ) : (
              <span className="text-slate-500">● Disconnected</span>
            )}
            &middot; {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn-premium px-4 py-1.5 rounded-lg text-sm" onClick={() => setShowForm(true)}>
          + Create Agent
        </button>
      </div>

      {errorMsg && (
        <div className="glass-panel rounded-xl p-3 mb-4 border border-red-500/30">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {loading ? (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <p className="text-sm text-slate-400">Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-slate-400">No agents yet</p>
          <p className="text-xs text-slate-500">Create your first agent to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div key={agent.id}
              className="glass-panel rounded-xl p-5 flex flex-col justify-between transition-all hover:border-indigo-500/30 cursor-pointer"
              onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}>
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center text-sm">
                      {agent.emoji || "🤖"}
                    </div>
                    <h3 className="font-bold text-sm text-white">{agent.name}</h3>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusColor(agent.status)}`}>
                    {agent.status || "unknown"}
                  </span>
                </div>
                {agent.description && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{agent.description}</p>}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-[10px] font-mono text-slate-500">{agent.model || "default"}</span>
                  {agent.skills?.length > 0 && agent.skills.map((skill: string, i: number) => (
                    <span key={i} className="custom-badge text-[10px]">{skill?.name ?? skill}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-slate-800 pt-3 mt-1">
                <button className="text-[11px] px-2.5 py-1 rounded bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-400 border border-indigo-900/30 transition-all"
                  onClick={(e) => { e.stopPropagation(); toggleAgent(agent.id); }}>
                  {agent.status === "running" ? "Stop" : "Start"}
                </button>
                <button className="text-[11px] px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 transition-all"
                  onClick={(e) => { e.stopPropagation(); setSelectedAgent(agent); setShowAgentModal(true); setTaskModel(agent.modelRef || ""); setTaskInput(""); setTaskResult(""); setWorkspacePath(agent.workspace || ""); setEnabledSkills([...(agent.skills || [])]); setThinkingLevel(agent.thinkingLevel || "medium"); }}>
                  Run Task
                </button>
                <button className="text-[11px] px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/30 transition-all"
                  onClick={(e) => { e.stopPropagation(); window.open("/agents/" + agent.id, "_blank"); }}>
                  Browser
                </button>
                <button className="text-[11px] px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 transition-all ml-auto"
                  onClick={(e) => { e.stopPropagation(); deleteAgent(agent.id); }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Agent Detail */}
      {selectedAgent && !showAgentModal && (
        <div className="glass-panel rounded-xl p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-white">{selectedAgent.emoji || "🤖"} {selectedAgent.name}</h3>
            <button className="text-xs text-slate-500 hover:text-white transition-colors" onClick={() => { setSelectedAgent(null); setAgentTab("info"); }}>✕</button>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 mb-4 border-b border-slate-800 pb-0">
            {(["info", "files", "skills"] as const).map((t) => (
              <button key={t} onClick={() => { setAgentTab(t); if (t === "files" && selectedAgent) loadAgentFiles(selectedAgent.id); }}
                className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all border-b-2 ${agentTab === t ? "border-[#00f2fe] text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
                {t === "info" ? "📋 Info" : t === "files" ? "📁 Files" : "⚡ Skills"}
              </button>
            ))}
          </div>

          {agentTab === "info" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1"><span className="text-slate-500">ID:</span> {selectedAgent.id}</p>
                <p className="text-xs text-slate-400 mb-1"><span className="text-slate-500">Model:</span> {selectedAgent.model || selectedAgent.modelRef || "default"}</p>
                <p className="text-xs text-slate-400 mb-1"><span className="text-slate-500">Status:</span> <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(selectedAgent.status)}`}>{selectedAgent.status || "unknown"}</span></p>
                {selectedAgent.description && <p className="text-xs text-slate-400 mb-1"><span className="text-slate-500">Description:</span> {selectedAgent.description}</p>}
                <p className="text-xs text-slate-400 mb-1"><span className="text-slate-500">Skills:</span> {(selectedAgent.skills || []).length > 0 ? selectedAgent.skills.join(", ") : <span className="text-slate-600 italic">none</span>}</p>
                {selectedAgent.systemPrompt && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500 mb-1">System Prompt:</p>
                    <pre className="text-[11px] text-slate-400 bg-slate-900/50 rounded-lg p-3 overflow-x-auto max-h-32 overflow-y-auto">{selectedAgent.systemPrompt}</pre>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button className="btn-premium px-3 py-1.5 rounded-lg text-xs text-center"
                  onClick={() => { setShowAgentModal(true); }}>
                  Run Task
                </button>
                <button className="text-[11px] px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/30 transition-all text-center"
                  onClick={() => window.open("/agents/" + selectedAgent.id, "_blank")}>
                  Open Browser
                </button>
              </div>
            </div>
          )}

          {agentTab === "files" && (
            <div>
              {agentFiles.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No workspace files found.</p>
              ) : editingFile ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white font-mono font-bold">{editingFile.name}</span>
                    <div className="flex gap-2">
                      <button className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white" onClick={() => setEditingFile(null)}>Cancel</button>
                      <button className="text-[10px] px-2 py-1 rounded bg-[#00f2fe]/20 text-[#00f2fe] hover:bg-[#00f2fe]/30" onClick={() => saveAgentFile(selectedAgent.id, editingFile.name, editingFile.content)}>Save</button>
                    </div>
                  </div>
                  <textarea className="w-full bg-[#020408]/80 border border-slate-800 rounded-lg p-3 text-xs text-white font-mono focus:outline-none focus:border-[#00f2fe] resize-y" rows={12}
                    value={editingFile.content}
                    onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })} />
                </div>
              ) : (
                <div className="space-y-2">
                  {agentFiles.map((file) => (
                    <div key={file.name} className="flex items-center justify-between p-2 bg-[#020408]/40 rounded-lg border border-slate-800/50">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-slate-300 font-mono truncate">{file.name}</span>
                        <span className="text-[10px] text-slate-600">{file.size ? `${(file.size / 1024).toFixed(1)} KB` : ""}</span>
                      </div>
                      <button className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                        onClick={() => setEditingFile({ name: file.name, content: file.content || "" })}>
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {agentTab === "skills" && (
            <div>
              <p className="text-xs text-slate-400 mb-3">Toggle skills for <strong className="text-white">{selectedAgent.name}</strong>:</p>
              <div className="flex flex-wrap gap-2 mb-4 max-h-48 overflow-y-auto">
                {allSkills.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No skills available.</p>
                ) : (
                  allSkills.map((skill) => {
                    const skillName = skill.name || skill.id;
                    const isEnabled = (selectedAgent.skills || []).includes(skillName);
                    return (
                      <button key={skillName} onClick={async () => {
                        const currentSkills = selectedAgent.skills || [];
                        const newSkills = isEnabled
                          ? currentSkills.filter((s: string) => s !== skillName)
                          : [...currentSkills, skillName];
                        selectedAgent.skills = newSkills;
                        await updateAgentSkills(selectedAgent.id, newSkills);
                      }}
                        className={`px-2.5 py-1 text-[10px] rounded-lg border transition-all ${isEnabled ? "border-[#00f2fe] text-white bg-[#00f2fe]/10" : "border-slate-800 text-slate-500 hover:text-white hover:border-slate-600"}`}>
                        {isEnabled ? "✓ " : "+ "}{skillName}
                      </button>
                    );
                  })
                )}
              </div>
              {selectedAgent.skills?.length > 0 && (
                <div className="border-t border-slate-800 pt-2 mt-1">
                  <p className="text-[10px] text-slate-500 mb-1">Active skills ({selectedAgent.skills.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedAgent.skills.map((s: string) => (
                      <span key={s} className="custom-badge text-[10px]">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Agent Log */}
      {agentLog.length > 0 && (
        <div className="glass-panel rounded-xl p-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-white">Agent Log</h4>
            <button className="text-[10px] text-slate-500 hover:text-white" onClick={() => setAgentLog([])}>Clear</button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {agentLog.map((entry, i) => (
              <p key={i} className="text-[11px] text-slate-400 font-mono">{String(entry)}</p>
            ))}
          </div>
        </div>
      )}

      {/* Agent Modal */}
      {showAgentModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-slate-800 max-w-2xl w-full rounded-xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-[#05080f] px-4 py-3 border-b border-slate-850 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2 text-white">
                <span className="text-lg">{selectedAgent.emoji || "🤖"}</span>
                <span className="text-xs font-bold tracking-wide uppercase font-mono">{selectedAgent.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedAgent.status === "ready" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"} border ${selectedAgent.status === "ready" ? "border-emerald-500/30" : "border-amber-500/30"}`}>{selectedAgent.status}</span>
              </div>
              <button onClick={() => setShowAgentModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div className="px-4 py-2 bg-[#020408]/40 border-b border-slate-850 flex flex-wrap gap-1.5 items-center">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider mr-1">Skills:</span>
              {(selectedAgent.skills || []).map((skill: string, i: number) => (
                <span key={i} className="custom-badge text-[10px]">{skill?.name ?? skill}</span>
              ))}
              <span className="text-[10px] text-slate-600 ml-auto font-mono">{selectedAgent.model}</span>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                  Task / Prompt
                </label>
                <textarea value={taskInput} onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="e.g. analyze project structure, fix all eslint errors, build test suite for all components..."
                  className="w-full bg-[#020408]/60 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe] min-h-[80px]" />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                  Workspace Folder
                </label>
                <div className="flex gap-2">
                  <input value={workspacePath} onChange={(e) => setWorkspacePath(e.target.value)}
                    placeholder="e.g. C:\Projects\my-app"
                    className="flex-1 bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe] font-mono" />
                  <button onClick={async () => {
                    try {
                      const res = await fetch("/api/workspace/browse", { method: "POST" });
                      if (res.ok) { const data = await res.json(); if (data?.path) setWorkspacePath(data.path); }
                    } catch { /* ignore */ }
                  }}
                    className="bg-[#020408] hover:bg-slate-900 text-slate-400 border border-slate-800 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5">
                    Browse...
                  </button>
                </div>
                {workspacePath && <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">Workspace selected</p>}
              </div>
              <div>
                <label className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                  Skills to enable for this task
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedAgent.skills || []).map((skill: string) => (
                    <button key={skill} onClick={() => {
                      setEnabledSkills((prev) => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
                    }}
                      className={`px-2.5 py-1 text-[10px] rounded-lg border transition-all ${enabledSkills.includes(skill) ? "border-[#00f2fe] text-white bg-[#00f2fe]/10" : "border-slate-800 text-slate-500 hover:text-white hover:border-slate-600"}`}>
                      {enabledSkills.includes(skill) ? "✓" : "+"} {skill}
                    </button>
                  ))}
                  {(selectedAgent.skills || []).length === 0 && (
                    <span className="text-[10px] text-slate-600 italic">No skills assigned to this agent</span>
                  )}
                </div>
              </div>
              <details className="group">
                <summary className="text-[9px] text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 flex items-center gap-1.5">
                  Advanced Settings
                </summary>
                <div className="mt-2 space-y-2 pl-2">
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] text-slate-500 w-16">Model:</label>
                    <select value={taskModel} onChange={(e) => setTaskModel(e.target.value)}
                      className="flex-1 bg-[#020408]/60 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
                      <option value="">Default ({selectedAgent.model})</option>
                      {availableModels.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] text-slate-500 w-16">Thinking:</label>
                    <select value={thinkingLevel} onChange={(e) => setThinkingLevel(e.target.value)}
                      className="flex-1 bg-[#020408]/60 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
                      <option value="none">None</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
              </details>
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <div className="flex gap-2">
                  <button onClick={() => setShowAgentModal(false)} className="bg-[#020408] hover:bg-slate-900 text-slate-400 border border-slate-850 px-4 py-2 rounded-lg text-xs font-semibold">Cancel</button>
                  {taskResult && <button onClick={() => setTaskResult("")} className="text-[10px] text-slate-500 hover:text-white underline">Clear result</button>}
                </div>
                <button onClick={() => runAgentTask(selectedAgent.id, taskInput)}
                  disabled={taskRunning || !taskInput.trim()}
                  className="btn-premium px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
                  {taskRunning ? "Running task..." : "Execute Task"}
                </button>
              </div>
              {taskResult && (
                <div className="border-t border-slate-800 pt-3 mt-1">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">Result</p>
                  <pre className="text-[11px] text-slate-300 bg-[#020408]/80 rounded-lg p-3 max-h-40 overflow-y-auto font-mono whitespace-pre-wrap">{taskResult}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Agent Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="glass-panel rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-sm text-white mb-4">Create Agent</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 font-medium">Name</label>
                <input className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1"
                  placeholder="My Agent" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium">Description</label>
                <textarea className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1 resize-none"
                  rows={2} placeholder="What does this agent do?" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium">Model</label>
                <select className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white mt-1"
                  value={formModel} onChange={(e) => setFormModel(e.target.value)}>
                  {availableModels.map((m: any) => (
                    <option key={String(m.id || m)} value={String(m.id || m)}>{String(m.id || m)}</option>
                  ))}
                  <option value="deepseek/deepseek-chat">deepseek/deepseek-chat</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium">Skills (comma separated)</label>
                <input className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1"
                  placeholder="code, research, writing" value={formSkills} onChange={(e) => setFormSkills(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium">System Prompt</label>
                <textarea className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1 resize-none font-mono"
                  rows={4} placeholder="You are an agent that..." value={formPrompt} onChange={(e) => setFormPrompt(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-800 hover:bg-slate-900 transition-all"
                onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-premium px-3 py-1.5 rounded-lg text-xs"
                onClick={createAgent} disabled={creating || !formName.trim()}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parallel Workers Panel */}
      <div className="glass-panel rounded-xl p-5 mt-6 border border-indigo-500/10">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
          </svg>
          <span className="text-sm text-white font-medium">Parallel Workers</span>
          <span className="text-[10px] text-slate-500">— spawn multiple sub-agents at once</span>
        </div>
        <p className="text-[10px] text-slate-500 mb-4">Each worker runs the same system prompt on a different subtask. Results are merged automatically.</p>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <label className="text-[10px] text-slate-500">Task {i}</label>
                <input id={`ptask${i}`}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-600 mt-1"
                  placeholder={`e.g. ${["Research React 19 features", "Research Vue 4 features", "Research Svelte 5 features", "Research Angular 18 features"][i - 1]}`} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-slate-500">Worker Group Name</label>
              <input id="pname"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-600 mt-1"
                placeholder="research-team" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">System Prompt</label>
              <textarea id="pprompt"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-600 mt-1 resize-none"
                rows={1} placeholder="You are a researcher..."></textarea>
            </div>
            <div className="flex items-end">
              <button id="parallel-submit-btn" className="btn-premium px-4 py-1.5 rounded-lg text-xs w-full"
                onClick={() => {
                  const tasks: string[] = [];
                  for (let i = 1; i <= 4; i++) {
                    const el = document.getElementById("ptask" + i) as HTMLInputElement;
                    if (el?.value?.trim()) tasks.push(el.value.trim());
                  }
                  const name = (document.getElementById("pname") as HTMLInputElement)?.value?.trim() || "parallel";
                  const prompt = (document.getElementById("pprompt") as HTMLTextAreaElement)?.value?.trim() || "You are a helpful assistant.";
                  if (tasks.length === 0) return;
                  const btn = document.getElementById("parallel-submit-btn") as HTMLButtonElement;
                  btn.disabled = true;
                  btn.textContent = "Running...";
                  fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      messages: [{ role: "user", content: `spawn_parallel name="${name}" systemPrompt="${prompt}" tasks=${JSON.stringify(tasks)} merge=true` }],
                      model: "deepseek/deepseek-chat",
                      tools: ["spawn_parallel"],
                    }),
                  }).finally(() => {
                    btn.disabled = false;
                    btn.textContent = "Run Parallel Workers";
                  });
                }}>
                Run Parallel Workers
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
