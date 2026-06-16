import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

export function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");

  useEffect(() => { loadStats(); }, []);

  useEffect(() => { loadStats(); }, [timeRange]);

  async function loadStats() {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/stats?range=${timeRange}`);
      const data = await res.json();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  function statColor(value: number, threshold: number) {
    if (value >= threshold) return "text-emerald-400";
    if (value >= threshold * 0.8) return "text-amber-400";
    return "text-red-400";
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Performance Analytics</h2>
          <p className="text-xs text-[#94a3b8] mt-1">Observe model token expenditures, query latencies, and execution success rates.</p>
        </div>
        <select
          className="bg-slate-900/50 border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#6366f1]"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
        >
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </div>

      {loading ? (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <p className="text-sm text-[#94a3b8]">Loading analytics...</p>
        </div>
      ) : !stats ? (
        <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-[#94a3b8]">No analytics data available</p>
          <p className="text-xs text-[#475569]">Start using agents to see performance metrics.</p>
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="glass-panel p-5 rounded-xl">
              <span className="text-xs text-[#475569]">Total Sessions</span>
              <div className="text-2xl font-bold text-white mt-1">{stats.totalSessions ?? 0}</div>
              <span className="text-[10px] text-[#475569]">All time</span>
            </div>
            <div className="glass-panel p-5 rounded-xl">
              <span className="text-xs text-[#475569]">Total Agents</span>
              <div className="text-2xl font-bold text-white mt-1">{stats.totalAgents ?? 0}</div>
              <span className="text-[10px] text-[#475569]">{stats.activeAgents ?? 0} active now</span>
            </div>
            <div className="glass-panel p-5 rounded-xl">
              <span className="text-xs text-[#475569]">Skills Used</span>
              <div className="text-2xl font-bold text-white mt-1">{stats.totalSkills ?? 0}</div>
              <span className="text-[10px] text-[#475569]">Across all agents</span>
            </div>
            <div className="glass-panel p-5 rounded-xl">
              <span className="text-xs text-[#475569]">Active Agents</span>
              <div className="text-2xl font-bold text-white mt-1">{stats.activeAgents ?? 0}</div>
              <span className="text-[10px] text-[#475569]">Currently running</span>
            </div>
          </div>

          {/* Success Rate & Latency */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="glass-panel p-5 rounded-xl">
              <span className="text-xs text-[#475569]">Success Run Rate</span>
              <div className={`text-2xl font-bold ${statColor(stats.successRate ?? 0, 98.5)} mt-1`}>
                {(stats.successRate ?? 0).toFixed(2)}%
              </div>
              <span className="text-[10px] text-[#475569]">Target: &gt; 98.5%</span>
            </div>
            <div className="glass-panel p-5 rounded-xl">
              <span className="text-xs text-[#475569]">Avg Response Latency</span>
              <div className="text-2xl font-bold text-white mt-1">
                {stats.avgLatency ?? 0} ms
              </div>
              <span className="text-[10px] text-[#475569] font-mono">Across all models</span>
            </div>
            <div className="glass-panel p-5 rounded-xl">
              <span className="text-xs text-[#475569]">Total Spend</span>
              <div className="text-2xl font-bold text-white mt-1">
                ${(stats.totalSpend ?? 0).toFixed(2)}
              </div>
              <span className="text-[10px] text-[#475569]">Estimated this period</span>
            </div>
          </div>

          {/* Sessions by Model */}
          {stats.sessionsByModel && stats.sessionsByModel.length > 0 && (
            <div className="glass-panel rounded-xl p-5 mb-6">
              <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
                Sessions by Model
              </h3>
              <div className="space-y-2">
                {stats.sessionsByModel.map((item: any, i: number) => {
                  const maxCount = Math.max(...stats.sessionsByModel.map((m: any) => m.count));
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-slate-300 font-mono w-48 truncate">{item.model}</span>
                      <div className="flex-1 bg-slate-800/50 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-[#6366f1] to-[#4facfe]"
                          style={{ width: `${Math.min(100, (item.count / maxCount) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-[#94a3b8] font-mono w-16 text-right">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="glass-panel rounded-xl p-5">
              <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#22c55e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Requests Over Time
              </h3>
              <div className="h-48">
                {stats?.dailyActivity?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.dailyActivity}>
                      <defs>
                        <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} stroke="rgba(255,255,255,0.06)" />
                      <YAxis tick={{ fontSize: 10, fill: '#475569' }} stroke="rgba(255,255,255,0.06)" />
                      <Tooltip contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', fontSize: 11 }} />
                      <Area type="monotone" dataKey="count" stroke="#6366f1" fillOpacity={1} fill="url(#colorRequests)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center border border-dashed border-[rgba(255,255,255,0.06)] rounded-lg">
                    <span className="text-xs text-[#475569]">No data yet — start using agents to see charts</span>
                  </div>
                )}
              </div>
            </div>
            <div className="glass-panel rounded-xl p-5">
              <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#f59e0b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Requests by Model
              </h3>
              <div className="h-48">
                {stats?.modelUsage?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.modelUsage.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="model" tick={{ fontSize: 9, fill: '#475569' }} stroke="rgba(255,255,255,0.06)" />
                      <YAxis tick={{ fontSize: 10, fill: '#475569' }} stroke="rgba(255,255,255,0.06)" />
                      <Tooltip contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', fontSize: 11 }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center border border-dashed border-[rgba(255,255,255,0.06)] rounded-lg">
                    <span className="text-xs text-[#475569]">No data yet</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          {stats.recentActivity && stats.recentActivity.length > 0 && (
            <div className="glass-panel rounded-xl p-5 mb-6">
              <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                Recent Activity
              </h3>
              <div className="space-y-2">
                {stats.recentActivity.map((activity: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-[rgba(255,255,255,0.06)]/50 last:border-0">
                    <span className="text-xs text-slate-300">{activity.action}</span>
                    <span className="text-[10px] text-[#475569] font-mono">{activity.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
