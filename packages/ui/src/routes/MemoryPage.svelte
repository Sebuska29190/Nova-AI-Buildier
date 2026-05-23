<script lang="ts">
  import { onMount } from "svelte";

  let memories = $state<any[]>([]);
  let loading = $state(false);
  let errorMsg = $state("");
  let searchQuery = $state("");
  let selectedMemory = $state<any>(null);

  onMount(() => { loadMemories(); });

  async function loadMemories() {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch("/api/memory");
      const data = await res.json();
      memories = data.memories || [];
    } catch (e: any) {
      errorMsg = e?.message || "Failed to load memories";
      memories = [];
    } finally {
      loading = false;
    }
  }

  async function deleteMemory(id: string) {
    try {
      await fetch(`/api/memory/${id}`, { method: "DELETE" });
      memories = memories.filter((m) => m.id !== id);
    } catch (e: any) {
      errorMsg = e?.message || "Failed to delete memory";
    }
  }

  async function searchMemories(query: string) {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      memories = data.results || [];
    } catch (e: any) {
      errorMsg = e?.message || "Search failed";
    } finally {
      loading = false;
    }
  }

  function handleSearchInput() {
    if (searchQuery.trim()) {
      searchMemories(searchQuery.trim());
    } else {
      loadMemories();
    }
  }

  function truncate(text: string, max = 120) {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "..." : text;
  }

  function importanceColor(level: string) {
    switch (level?.toLowerCase()) {
      case "high":   return "bg-red-950 text-red-400 border-red-900/30";
      case "medium": return "bg-amber-950 text-amber-400 border-amber-900/30";
      case "low":    return "bg-slate-800 text-slate-400 border-slate-700/30";
      default:       return "bg-slate-800 text-slate-500 border-slate-700/30";
    }
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">Memory DB Configurations</h2>
      <p class="text-xs text-slate-400 mt-1">Observe dynamic contextual long-term memory records and graph associations.</p>
    </div>
    <button class="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onclick={loadMemories}>
      <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
      Refresh
    </button>
  </div>

  {#if errorMsg}
    <div class="glass-panel rounded-xl p-4 mb-6 border border-red-500/30">
      <p class="text-xs text-red-400">{errorMsg}</p>
    </div>
  {/if}

  <!-- Search -->
  <div class="glass-panel rounded-xl p-4 mb-6">
    <div class="flex items-center gap-3">
      <i data-lucide="search" class="w-4 h-4 text-slate-500 shrink-0"></i>
      <input
        type="text"
        placeholder="Search memories..."
        class="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-slate-600"
        bind:value={searchQuery}
        oninput={handleSearchInput}
      />
      {#if searchQuery}
        <button class="text-[10px] text-slate-500 hover:text-slate-300 transition-colors shrink-0" onclick={() => { searchQuery = ""; loadMemories(); }}>
          Clear
        </button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="glass-panel rounded-xl p-8 flex items-center justify-center">
      <div class="flex items-center gap-3">
        <span class="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin"></span>
        <span class="text-xs text-slate-400">Loading memories...</span>
      </div>
    </div>
  {:else if memories.length === 0}
    <div class="glass-panel rounded-xl p-8 text-center">
      <p class="text-xs text-slate-500">No memories found.</p>
      <p class="text-[10px] text-slate-600 mt-1">{searchQuery ? "Try a different search term." : "Memories will appear here once the system stores them."}</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each memories as memory}
        <div class="glass-panel rounded-xl p-5 transition-all">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2 min-w-0">
              <i data-lucide="database" class="w-4 h-4 text-indigo-400 shrink-0"></i>
              <h3 class="font-bold text-sm text-white truncate">{memory.name || "Unnamed"}</h3>
            </div>
            {#if memory.importance || memory.importance_level}
              <span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded border {importanceColor(memory.importance || memory.importance_level)} shrink-0">
                {(memory.importance || memory.importance_level).toUpperCase()}
              </span>
            {/if}
          </div>

          <p class="text-[11px] text-slate-400 mb-3 leading-relaxed">{truncate(memory.content || memory.description || "")}</p>

          {#if memory.tags && memory.tags.length > 0}
            <div class="flex flex-wrap gap-1.5 mb-3">
              {#each memory.tags as tag}
                <span class="text-[9px] bg-[#020408]/60 text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded font-mono">{tag}</span>
              {/each}
            </div>
          {/if}

          {#if memory.created_at || memory.updated_at}
            <p class="text-[9px] text-slate-600 mb-3">{memory.updated_at ? "Updated: " + new Date(memory.updated_at).toLocaleString() : "Created: " + new Date(memory.created_at).toLocaleString()}</p>
          {/if}

          <div class="flex items-center gap-2">
            <button class="text-[10px] text-slate-400 hover:text-white transition-colors" onclick={() => selectedMemory = selectedMemory?.id === memory.id ? null : memory}>
              {selectedMemory?.id === memory.id ? "Hide Details" : "View Details"}
            </button>
            <button class="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1 rounded text-[10px] transition-all ml-auto" onclick={() => deleteMemory(memory.id)}>
              Delete
            </button>
          </div>

          {#if selectedMemory?.id === memory.id}
            <div class="mt-3 pt-3 border-t border-slate-800/50">
              <pre class="text-[10px] text-slate-500 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">{JSON.stringify(memory, null, 2)}</pre>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
