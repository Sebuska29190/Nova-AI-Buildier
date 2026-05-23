<script lang="ts">
  import { onMount } from "svelte";

  let stats = $state<any>(null);
  let loading = $state(true);
  let timeRange = $state("7d");

  onMount(() => {
    loadStats();
  });

  async function loadStats() {
    loading = true;
    try {
      const res = await fetch(`/api/analytics/stats?range=${timeRange}`);
      const data = await res.json();
      stats = data;
    } catch {
      stats = null;
    } finally {
      loading = false;
    }
  }

  function statColor(value: number, threshold: number) {
    if (value >= threshold) return "text-emerald-400";
    if (value >= threshold * 0.8) return "text-amber-400";
    return "text-red-400";
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">Performance Analytics</h2>
      <p class="text-xs text-slate-400 mt-1">Observe model token expenditures, query latencies, and execution success rates.</p>
    </div>
    <select
      class="bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#00f2fe]"
      bind:value={timeRange}
      onchange={loadStats}
    >
      <option value="24h">Last 24h</option>
      <option value="7d">Last 7 days</option>
      <option value="30d">Last 30 days</option>
    </select>
  </div>

  {#if loading}
    <div class="glass-panel rounded-xl p-8 flex items-center justify-center">
      <p class="text-sm text-slate-400">Loading analytics...</p>
    </div>
  {:else if !stats}
    <div class="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
      <p class="text-sm text-slate-400">No analytics data available</p>
      <p class="text-xs text-slate-500">Start using agents to see performance metrics.</p>
    </div>
  {:else}
    <!-- Overview Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="glass-panel p-5 rounded-xl">
        <span class="text-xs text-slate-500">Total Sessions</span>
        <div class="text-2xl font-bold text-white mt-1">{stats.totalSessions ?? 0}</div>
        <span class="text-[10px] text-slate-500">All time</span>
      </div>
      <div class="glass-panel p-5 rounded-xl">
        <span class="text-xs text-slate-500">Total Agents</span>
        <div class="text-2xl font-bold text-white mt-1">{stats.totalAgents ?? 0}</div>
        <span class="text-[10px] text-slate-500">{stats.activeAgents ?? 0} active now</span>
      </div>
      <div class="glass-panel p-5 rounded-xl">
        <span class="text-xs text-slate-500">Skills Used</span>
        <div class="text-2xl font-bold text-white mt-1">{stats.totalSkills ?? 0}</div>
        <span class="text-[10px] text-slate-500">Across all agents</span>
      </div>
      <div class="glass-panel p-5 rounded-xl">
        <span class="text-xs text-slate-500">Active Agents</span>
        <div class="text-2xl font-bold text-white mt-1">{stats.activeAgents ?? 0}</div>
        <span class="text-[10px] text-slate-500">Currently running</span>
      </div>
    </div>

    <!-- Success Rate & Latency -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="glass-panel p-5 rounded-xl">
        <span class="text-xs text-slate-500">Success Run Rate</span>
        <div class="text-2xl font-bold {statColor(stats.successRate ?? 0, 98.5)} mt-1">
          {(stats.successRate ?? 0).toFixed(2)}%
        </div>
        <span class="text-[10px] text-slate-500">Target: > 98.5%</span>
      </div>
      <div class="glass-panel p-5 rounded-xl">
        <span class="text-xs text-slate-500">Avg Response Latency</span>
        <div class="text-2xl font-bold text-white mt-1">
          {stats.avgLatency ?? 0} ms
        </div>
        <span class="text-[10px] text-slate-500 font-mono">Across all models</span>
      </div>
      <div class="glass-panel p-5 rounded-xl">
        <span class="text-xs text-slate-500">Total Spend</span>
        <div class="text-2xl font-bold text-white mt-1">
          ${(stats.totalSpend ?? 0).toFixed(2)}
        </div>
        <span class="text-[10px] text-slate-500">Estimated this period</span>
      </div>
    </div>

    <!-- Sessions by Model -->
    {#if stats.sessionsByModel && stats.sessionsByModel.length > 0}
      <div class="glass-panel rounded-xl p-5 mb-6">
        <h3 class="font-bold text-sm text-white mb-4 flex items-center gap-2">
          <i data-lucide="bar-chart-3" class="w-4 h-4 text-indigo-400"></i>
          Sessions by Model
        </h3>
        <div class="space-y-2">
          {#each stats.sessionsByModel as item}
            <div class="flex items-center gap-3">
              <span class="text-xs text-slate-300 font-mono w-48 truncate">{item.model}</span>
              <div class="flex-1 bg-slate-800/50 rounded-full h-2">
                <div
                  class="h-2 rounded-full bg-gradient-to-r from-[#00f2fe] to-[#4facfe]"
                  style="width: {Math.min(100, (item.count / Math.max(...stats.sessionsByModel.map((m: any) => m.count))) * 100)}%"
                ></div>
              </div>
              <span class="text-xs text-slate-400 font-mono w-16 text-right">{item.count}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Charts Placeholder -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div class="glass-panel rounded-xl p-5">
        <h3 class="font-bold text-sm text-white mb-4 flex items-center gap-2">
          <i data-lucide="activity" class="w-4 h-4 text-emerald-400"></i>
          Requests Over Time
        </h3>
        <div class="h-48 flex items-center justify-center border border-dashed border-slate-800 rounded-lg">
          <span class="text-xs text-slate-500">Chart coming soon</span>
        </div>
      </div>
      <div class="glass-panel rounded-xl p-5">
        <h3 class="font-bold text-sm text-white mb-4 flex items-center gap-2">
          <i data-lucide="clock" class="w-4 h-4 text-amber-400"></i>
          Latency Trend
        </h3>
        <div class="h-48 flex items-center justify-center border border-dashed border-slate-800 rounded-lg">
          <span class="text-xs text-slate-500">Chart coming soon</span>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    {#if stats.recentActivity && stats.recentActivity.length > 0}
      <div class="glass-panel rounded-xl p-5 mb-6">
        <h3 class="font-bold text-sm text-white mb-4 flex items-center gap-2">
          <i data-lucide="list" class="w-4 h-4 text-sky-400"></i>
          Recent Activity
        </h3>
        <div class="space-y-2">
          {#each stats.recentActivity as activity}
            <div class="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0">
              <span class="text-xs text-slate-300">{activity.action}</span>
              <span class="text-[10px] text-slate-500 font-mono">{activity.timestamp}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
