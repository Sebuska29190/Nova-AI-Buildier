import { useState, useEffect } from "react";

interface TopTool {
  name: string;
  count: number;
  successRate: number;
}

interface TopAgent {
  agentId: string;
  cost: number;
  calls: number;
}

interface RecentCall {
  toolName: string;
  agentId: string;
  durationMs: number;
  success: boolean;
  timestamp: string;
}

interface DashboardData {
  topTools: TopTool[];
  topAgents: TopAgent[];
  recentCalls: RecentCall[];
  successRate: number;
  totalToolCalls: number;
  uniqueTools: number;
}

export function ToolsAnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analytics/dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white">Tool Analytics Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">Usage metrics, cost tracking, and tool call audit</p>
        </div>
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <p className="text-sm text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white">Tool Analytics Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">Usage metrics, cost tracking, and tool call audit</p>
        </div>
        <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-red-400">Failed to load data</p>
          <p className="text-xs text-slate-500">{error}</p>
          <button onClick={load} className="btn-premium text-xs px-4 py-1.5 rounded-lg mt-2">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxToolCount = data.topTools.length > 0 ? Math.max(...data.topTools.map(t => t.count)) : 1;

  return (
    <div className="max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Tool Analytics Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">Usage metrics, cost tracking, and tool call audit</p>
        </div>
        <button onClick={load} className="btn-premium text-xs px-3 py-1.5 rounded-lg">
          Refresh
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="glass-panel p-5 rounded-xl">
          <span className="text-xs text-slate-500">Total Tool Calls</span>
          <div className="text-2xl font-bold text-white mt-1">
            {(data.totalToolCalls ?? 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500">All time</span>
        </div>
        <div className="glass-panel p-5 rounded-xl">
          <span className="text-xs text-slate-500">Unique Tools</span>
          <div className="text-2xl font-bold text-white mt-1">{data.uniqueTools ?? 0}</div>
          <span className="text-[10px] text-slate-500">Registered in audit</span>
        </div>
        <div className="glass-panel p-5 rounded-xl">
          <span className="text-xs text-slate-500">Overall Success</span>
          <div className={`text-2xl font-bold mt-1 ${(data.successRate ?? 0) >= 90 ? "text-emerald-400" : (data.successRate ?? 0) >= 70 ? "text-amber-400" : "text-red-400"}`}>
            {data.successRate}%
          </div>
          <span className="text-[10px] text-slate-500">Last 20 calls</span>
        </div>
        <div className="glass-panel p-5 rounded-xl">
          <span className="text-xs text-slate-500">Top Agent</span>
          <div className="text-2xl font-bold text-white mt-1 truncate">
            {data.topAgents.length > 0 ? data.topAgents[0].agentId : "—"}
          </div>
          <span className="text-[10px] text-slate-500">
            {data.topAgents.length > 0 ? `${data.topAgents[0].calls} calls` : "No data"}
          </span>
        </div>
      </div>

      {/* Top Tools + Top Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Top Tools (Bar Chart) */}
        <div className="glass-panel rounded-xl p-5">
          <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
            </svg>
            Top 10 Most Used Tools
          </h3>
          {data.topTools.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No tool usage data yet</p>
          ) : (
            <div className="space-y-2">
              {data.topTools.map((tool, i) => (
                <div key={tool.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 font-mono w-5">{i + 1}.</span>
                      <span className="text-xs text-slate-300 font-mono truncate max-w-[200px]">{tool.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-mono ${tool.successRate >= 90 ? "text-emerald-400" : tool.successRate >= 70 ? "text-amber-400" : "text-red-400"}`}>
                        {tool.successRate}%
                      </span>
                      <span className="text-xs text-slate-400 font-mono w-12 text-right">{tool.count}</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-slate-800/50 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-[#6366f1] to-[#4facfe]"
                      style={{ width: `${Math.min(100, (tool.count / maxToolCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Agents (Cost Leaderboard) */}
        <div className="glass-panel rounded-xl p-5">
          <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
            </svg>
            Top 5 Agents by Activity
          </h3>
          {data.topAgents.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No agent activity yet</p>
          ) : (
            <div className="space-y-1">
              {data.topAgents.map((agent, i) => (
                <div key={agent.agentId} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-800/30 transition-all">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i === 0 ? "bg-amber-500/20 text-amber-400" :
                      i === 1 ? "bg-slate-400/20 text-slate-300" :
                      i === 2 ? "bg-orange-500/20 text-orange-400" :
                      "bg-slate-700/30 text-slate-400"
                    }`}>{i + 1}</div>
                    <div>
                      <span className="text-xs font-medium text-slate-200">{agent.agentId}</span>
                      <div className="text-[9px] text-slate-500">{agent.calls} calls</div>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    ${(agent.cost ?? 0).toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Tool Calls Feed */}
      <div className="glass-panel rounded-xl p-5 mb-6">
        <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          Recent Tool Calls
        </h3>
        {data.recentCalls.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">No recent tool calls</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800">
                  <th className="pb-2 font-medium">Tool</th>
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium">Duration</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCalls.slice().reverse().map((call, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-all">
                    <td className="py-2 pr-4">
                      <span className="font-mono text-slate-300">{call.toolName}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-slate-400">{call.agentId || "—"}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="font-mono text-slate-400">
                        {call.durationMs ? `${call.durationMs}ms` : "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {call.success ? (
                        <span className="text-emerald-400 text-[10px] font-medium">✓ Success</span>
                      ) : (
                        <span className="text-red-400 text-[10px] font-medium">✗ Failed</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <span className="text-[10px] text-slate-600">{new Date(call.timestamp).toLocaleTimeString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
