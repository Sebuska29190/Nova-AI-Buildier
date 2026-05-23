<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api.ts";

  let models = $state<any[]>([]);
  let loading = $state(true);
  let searchQuery = $state("");

  onMount(() => {
    api.models()
      .then((m: any[]) => { models = m; })
      .catch(() => {})
      .finally(() => { loading = false; });
  });

  let filteredModels = $derived.by(() => {
    let list = models;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.id?.toLowerCase().includes(q) ||
          m.name?.toLowerCase().includes(q) ||
          m.provider?.toLowerCase().includes(q) ||
          m.owned_by?.toLowerCase().includes(q)
      );
    }
    return list;
  });

  let groupedByProvider = $derived.by(() => {
    const groups: Record<string, any[]> = {};
    for (const m of filteredModels) {
      const provider = m.provider || m.owned_by || "unknown";
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(m);
    }
    return groups;
  });

  let providerOrder = $derived(Object.keys(groupedByProvider).sort());
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">Available Models</h2>
      <p class="text-xs text-slate-400 mt-0.5">
        <span class="text-slate-500">{models.length} model{models.length !== 1 ? "s" : ""}</span>
      </p>
    </div>
    <div class="relative w-64">
      <input class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500"
             placeholder="Search models..." bind:value={searchQuery} />
      {#if searchQuery}
        <button class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                onclick={() => searchQuery = ""}>&times;</button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="glass-panel rounded-xl p-8 flex items-center justify-center">
      <p class="text-sm text-slate-400">Loading models...</p>
    </div>
  {:else if filteredModels.length === 0}
    <div class="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
      <p class="text-sm text-slate-400">No models found</p>
      {#if searchQuery}
        <p class="text-xs text-slate-500">Try a different search term</p>
      {:else}
        <p class="text-xs text-slate-500">No models available</p>
      {/if}
    </div>
  {:else}
    <div class="space-y-6">
      {#each providerOrder as provider}
        {@const providerModels = groupedByProvider[provider]}
        <div class="glass-panel rounded-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-white capitalize">{provider}</span>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border bg-indigo-950/50 text-indigo-400 border-indigo-500/30">
              {providerModels.length} model{providerModels.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {#each providerModels as model (model.id || model.name)}
              <div class="bg-slate-900/30 rounded-lg p-3 border border-slate-800/50 hover:border-indigo-500/30 transition-all">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-semibold text-white truncate">{model.id || model.name}</p>
                    {#if model.description}
                      <p class="text-[10px] text-slate-500 mt-0.5 truncate">{model.description}</p>
                    {/if}
                  </div>
                </div>
                <div class="flex flex-wrap gap-1.5 mt-2">
                  {#if model.type}
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{model.type}</span>
                  {/if}
                  {#if model.object}
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{model.object}</span>
                  {/if}
                  {#if model.created}
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{new Date(model.created * 1000).toLocaleDateString()}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
