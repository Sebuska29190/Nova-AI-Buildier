<script lang="ts">
  import { api } from "../lib/api.ts";
  import { onMount } from "svelte";

  let sessions = $state<any[]>([]);
  let selectedSession = $state<any>(null);
  let loading = $state(false);
  let errorMsg = $state("");

  // FTS5 search
  let searchQuery = $state("");
  let searchResults = $state<any[]>([]);
  let searching = $state(false);

  onMount(() => { loadSessions(); });

  async function loadSessions() {
    loading = true;
    errorMsg = "";
    try {
      sessions = await api.sessions();
    } catch (e: any) {
      errorMsg = e?.message || "Failed to load sessions";
      sessions = [];
    } finally {
      loading = false;
    }
  }

  async function doSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }
    searching = true;
    try {
      const res = await fetch(`/api/sessions/search?q=${encodeURIComponent(searchQuery)}&limit=15`);
      const data = await res.json();
      searchResults = data.results || [];
    } catch {
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") doSearch();
  }

  async function deleteSession(id: string) {
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      sessions = sessions.filter((s) => s.id !== id);
    } catch (e: any) {
      errorMsg = e?.message || "Failed to delete session";
    }
  }

  async function resumeSession(id: string) {
    try {
      const data = await api.sessionDetail(id);
      selectedSession = data;
    } catch (e: any) {
      errorMsg = e?.message || "Failed to load session details";
    }
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">Core Sessions</h2>
      <p class="text-xs text-slate-400 mt-1">Track long-term session IDs, multi-agent orchestrations, and conversation histories.</p>
    </div>
    <button class="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onclick={loadSessions}>
      <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
      Refresh
    </button>
  </div>

  <!-- FTS5 Transcript Search -->
  <div class="glass-panel rounded-xl p-4 mb-6 border border-[#00f2fe]/10">
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <i data-lucide="search" class="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500"></i>
        <input
          type="text"
          placeholder="Search all transcripts (FTS5) — e.g. 'video bug', 'trading setup'..."
          class="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00f2fe] transition-all"
          bind:value={searchQuery}
          onkeydown={handleSearchKeydown}
        />
      </div>
      <button class="btn-premium px-4 py-2 rounded-lg text-xs" onclick={doSearch} disabled={searching}>
        {searching ? "Searching..." : "Search"}
      </button>
    </div>

    {#if searchResults.length > 0}
      <div class="mt-3 space-y-2 max-h-64 overflow-y-auto">
        {#each searchResults as result}
          <div class="bg-slate-950/40 rounded-lg px-3 py-2 border border-slate-800/40 hover:border-slate-700/60 cursor-pointer transition-all"
               onclick={() => resumeSession(result.sessionId)}>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[10px] text-[#00f2fe] font-mono">{result.sessionId.slice(0, 8)}...</span>
              <span class="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{result.role}</span>
              <span class="text-[9px] text-slate-600">rank: {Math.round(result.rank * 100) / 100}</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              {@html result.snippet}
            </p>
          </div>
        {/each}
      </div>
    {:else if searchQuery && !searching}
      <p class="text-[10px] text-slate-600 mt-3">No matches found for "{searchQuery}".</p>
    {/if}
  </div>

  {#if errorMsg}
    <div class="glass-panel rounded-xl p-4 mb-6 border border-red-500/30">
      <p class="text-xs text-red-400">{errorMsg}</p>
    </div>
  {/if}

  {#if loading}
    <div class="glass-panel rounded-xl p-8 flex items-center justify-center">
      <div class="flex items-center gap-3">
        <span class="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin"></span>
        <span class="text-xs text-slate-400">Loading sessions...</span>
      </div>
    </div>
  {:else if sessions.length === 0}
    <div class="glass-panel rounded-xl p-8 text-center">
      <p class="text-xs text-slate-500">No sessions found.</p>
      <p class="text-[10px] text-slate-600 mt-1">Start a conversation in the chat to create a session.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each sessions as session}
        <div class="glass-panel rounded-xl p-5 transition-all">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2 min-w-0">
              <i data-lucide="message-circle" class="w-4 h-4 text-[#00f2fe] shrink-0"></i>
              <h3 class="font-bold text-sm text-white truncate">{session.model || "Unknown Model"}</h3>
            </div>
            <span class="text-[9px] bg-slate-900 text-slate-500 px-2 py-0.5 rounded font-mono shrink-0">
              {session.messages?.length || 0} msgs
            </span>
          </div>

          <div class="mb-3">
            <span class="text-[10px] text-slate-500 font-mono">{session.id}</span>
          </div>

          {#if session.created_at}
            <p class="text-[10px] text-slate-600 mb-4">
              {new Date(session.created_at).toLocaleString()}
            </p>
          {/if}

          <div class="flex items-center gap-2">
            <button class="btn-premium px-3 py-1 rounded text-[10px]" onclick={() => resumeSession(session.id)}>
              Resume
            </button>
            <button class="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1 rounded text-[10px] transition-all" onclick={() => deleteSession(session.id)}>
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if selectedSession}
    <div class="glass-panel rounded-xl p-5 mt-6 border border-[#00f2fe]/20">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-sm text-white">Session Details</h3>
        <button class="text-xs text-slate-500 hover:text-slate-300 transition-colors" onclick={() => selectedSession = null}>Close</button>
      </div>
      <pre class="text-[10px] text-slate-400 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">{JSON.stringify(selectedSession, null, 2)}</pre>
    </div>
  {/if}
</div>
