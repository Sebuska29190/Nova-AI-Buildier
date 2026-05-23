<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  let logs = $state<any[]>([]);
  let filterLevel = $state("all");
  let filterComponent = $state("");
  let autoScroll = $state(true);
  let connected = $state(false);
  let sse: EventSource | null = null;

  let filteredLogs = $derived.by(() => {
    let result = logs;
    if (filterLevel !== "all") {
      result = result.filter((l) => l.level === filterLevel);
    }
    if (filterComponent) {
      result = result.filter((l) =>
        (l.component || l.source || "").toLowerCase().includes(filterComponent.toLowerCase())
      );
    }
    return result;
  });

  onMount(() => {
    loadInitialLogs();
    connectSSE();
  });

  onDestroy(() => {
    sse?.close();
    sse = null;
  });

  async function loadInitialLogs() {
    try {
      const res = await fetch("/api/logs?limit=500");
      const data = await res.json();
      logs = data.logs || data || [];
    } catch {
      // silent — SSE will populate
    }
  }

  function connectSSE() {
    sse = new EventSource("/api/logs/stream");
    sse.onopen = () => { connected = true; };
    sse.onmessage = (ev) => {
      try {
        const entry = JSON.parse(ev.data);
        logs = [...logs, entry];
        if (logs.length > 2000) {
          logs = logs.slice(-1000);
        }
      } catch {
        // ignore malformed entries
      }
    };
    sse.onerror = () => {
      connected = false;
      setTimeout(() => {
        sse?.close();
        connectSSE();
      }, 3000);
    };
  }

  function levelColor(level: string): string {
    switch (level?.toLowerCase()) {
      case "error": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "warn":
      case "warning": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "info": return "bg-sky-500/20 text-sky-400 border-sky-500/30";
      case "debug": return "bg-slate-500/20 text-slate-400 border-slate-500/30";
      case "trace": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  }

  function clearLogs() {
    logs = [];
  }

  function formatTime(ts: string | number): string {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">Comprehensive Logs</h2>
      <p class="text-xs text-slate-400 mt-1">Filter system logs, search by keyword, and stream trace-level debugging messages directly.</p>
    </div>
    <div class="flex items-center gap-2">
      <span class="text-[10px] flex items-center gap-1 {connected ? 'text-emerald-400' : 'text-slate-500'}">
        <span class="w-1.5 h-1.5 rounded-full {connected ? 'bg-emerald-400' : 'bg-slate-500'}"></span>
        {connected ? "Live" : "Disconnected"}
      </span>
      <button class="btn-premium px-3 py-1.5 rounded text-xs" onclick={clearLogs}>Clear</button>
    </div>
  </div>

  <!-- Filters -->
  <div class="glass-panel rounded-xl p-4 mb-4">
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-slate-500 font-medium">Level:</span>
        <select
          class="bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-[#00f2fe]"
          bind:value={filterLevel}
        >
          <option value="all">All</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
          <option value="trace">Trace</option>
        </select>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-slate-500 font-medium">Component:</span>
        <input
          class="bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 w-40 placeholder-slate-600 focus:outline-none focus:border-[#00f2fe]"
          placeholder="Filter component..." bind:value={filterComponent}
        />
      </div>
      <label class="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer ml-auto">
        <input type="checkbox" bind:checked={autoScroll} class="accent-[#00f2fe]" />
        Auto-scroll
      </label>
    </div>
    <div class="mt-2 text-[10px] text-slate-500">
      {filteredLogs.length} / {logs.length} entries
    </div>
  </div>

  <!-- Log Entries -->
  <div
    class="glass-panel rounded-xl p-4"
    class:overflow-y-auto={true}
    style="max-height: 65vh;"
    bind:this={undefined}
  >
    {#if filteredLogs.length === 0}
      <div class="flex flex-col items-center justify-center py-12">
        <p class="text-sm text-slate-400">No log entries</p>
        <p class="text-xs text-slate-500 mt-1">Waiting for incoming log data...</p>
      </div>
    {:else}
      <div class="space-y-1 font-mono">
        {#each filteredLogs as log}
          <div class="flex items-start gap-2 text-[11px] py-1 border-b border-slate-800/30 last:border-0">
            <span class="text-slate-600 w-20 shrink-0">{formatTime(log.timestamp || log.time)}</span>
            <span class="px-1.5 py-0.5 rounded border text-[10px] uppercase shrink-0 {levelColor(log.level)}">
              {log.level || "info"}
            </span>
            <span class="text-slate-500 w-28 shrink-0 truncate" title={log.component || log.source}>
              {log.component || log.source || "system"}
            </span>
            <span class="text-slate-300 break-words min-w-0">{log.message}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
