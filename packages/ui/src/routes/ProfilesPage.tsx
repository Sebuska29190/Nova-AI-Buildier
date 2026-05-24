import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function ProfilesPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.agents()
      .then((a: any[]) => setAgents(a))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function statusBadge(status: string) {
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
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Agent Profiles</h2>
        <p className="text-xs text-slate-400 mt-0.5">Configure base personalities, memory settings, and agent-specific model routing.</p>
      </div>

      {loading ? (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <p className="text-sm text-slate-400">Loading agent profiles...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-slate-400">No agent profiles yet</p>
          <p className="text-xs text-slate-500">Create agents in the Agents page to see their profiles here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="glass-panel rounded-xl p-5 flex flex-col transition-all hover:border-indigo-500/30">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center text-lg">
                    {agent.emoji || "🤖"}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                    {agent.model && (
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{agent.model}</p>
                    )}
                  </div>
                </div>
                {agent.status && (
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${statusBadge(agent.status)}`}>
                    {agent.status}
                  </span>
                )}
              </div>

              {agent.description && (
                <p className="text-xs text-slate-400 leading-relaxed mb-3">{agent.description}</p>
              )}

              {agent.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-auto pt-3 border-t border-slate-800">
                  {agent.skills.map((skill: string, i: number) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{skill?.name ?? skill}</span>
                  ))}
                </div>
              )}

              {agent.systemPrompt && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">System Prompt</p>
                  <p className="text-[10px] text-slate-500 font-mono line-clamp-3">{agent.systemPrompt}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
