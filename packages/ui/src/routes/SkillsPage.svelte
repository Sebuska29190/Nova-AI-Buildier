<script lang="ts">
  import { onMount } from "svelte";

  let { skills = [], onRefresh = () => {} }: { skills: any[]; onRefresh: () => void } = $props();

  let filter = $state("all");
  let searchQuery = $state("");

  // Skill Hub
  let hubQuery = $state("");
  let hubResults = $state<any[]>([]);
  let hubLoading = $state(false);
  let hubMsg = $state("");

  function filteredSkills() {
    let list = skills;
    if (filter === "auto-generated") {
      list = list.filter(s => s.source === "auto-generated");
    } else if (filter !== "all") {
      list = list.filter(s => s.type === filter || s.category === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.tags?.some((t: string) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }

  function uniqueTypes() {
    const types: Set<string> = new Set();
    for (const s of skills) {
      if (s.type) types.add(s.type);
      if (s.category) types.add(s.category);
    }
    return ["all", "auto-generated", ...types];
  }

  async function searchHub() {
    if (!hubQuery.trim()) return;
    hubLoading = true;
    hubMsg = "";
    try {
      const res = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `skill_hub_search query="${hubQuery}"` }],
          model: "deepseek/deepseek-chat",
          tools: ["skill_hub_search"],
        }),
      });
      const data = await res.json();
      hubResults = data.results || [];
      hubMsg = hubResults.length === 0 ? `No skills found for "${hubQuery}"` : "";
    } catch (e: any) {
      hubMsg = e.message || "Failed to search hub";
    } finally {
      hubLoading = false;
    }
  }

  async function downloadSkill(name: string) {
    hubMsg = "";
    try {
      const res = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `skill_hub_download name="${name}"` }],
          model: "deepseek/deepseek-chat",
          tools: ["skill_hub_download"],
        }),
      });
      hubMsg = `Downloaded "${name}" — refresh to see it.`;
      onRefresh();
    } catch (e: any) {
      hubMsg = "Download failed: " + (e.message || e);
    }
  }

  function paramBadgeColor(kind: string) {
    switch (kind) {
      case "required": return "bg-red-950/40 text-red-400 border-red-900/30";
      case "optional": return "bg-slate-800 text-slate-400 border-slate-700";
      default: return "bg-slate-800 text-slate-400 border-slate-700";
    }
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">Agent Skills Library ({skills.length})</h2>
      <p class="text-xs text-slate-400 mt-0.5">Manage functional blocks, tool schemas, and executable script capabilities.</p>
    </div>
    <button class="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onclick={onRefresh}>
      <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
      Refresh
    </button>
  </div>

  <!-- Skill Hub Search -->
  <div class="glass-panel rounded-xl p-4 mb-6 border border-purple-500/10">
    <div class="flex items-center gap-2 mb-3">
      <i data-lucide="globe" class="w-4 h-4 text-purple-400"></i>
      <span class="text-xs text-purple-400 font-medium">agentskills.io Hub</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <input
          type="text"
          placeholder="Search global skill registry..."
          class="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
          bind:value={hubQuery}
          onkeydown={(e) => { if (e.key === "Enter") searchHub(); }}
        />
      </div>
      <button class="px-3 py-1.5 rounded-lg text-xs bg-purple-950/40 text-purple-400 border border-purple-500/30 hover:bg-purple-900/40 transition-all" onclick={searchHub} disabled={hubLoading}>
        {hubLoading ? "Searching..." : "Search Hub"}
      </button>
    </div>
    {#if hubMsg}
      <p class="text-[10px] text-slate-500 mt-2">{hubMsg}</p>
    {/if}
    {#if hubResults.length > 0}
      <div class="mt-3 space-y-2 max-h-48 overflow-y-auto">
        {#each hubResults as skill}
          <div class="bg-slate-950/40 rounded-lg px-3 py-2 border border-slate-800/40 flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <span class="text-xs text-white">{skill.name}</span>
              <span class="text-[10px] text-slate-500 ml-2">{skill.description}</span>
            </div>
            <button class="px-2 py-1 rounded text-[10px] bg-purple-950/40 text-purple-400 border border-purple-500/30 hover:bg-purple-900/40 transition-all ml-2 shrink-0"
                    onclick={() => downloadSkill(skill.name)}>
              Download
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Search & Filter Bar -->
  <div class="flex items-center gap-3 mb-5">
    <div class="relative flex-1">
      <input class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500"
             placeholder="Search local skills..." bind:value={searchQuery} />
    </div>
    {#if uniqueTypes().length > 1}
      <select class="px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white"
              bind:value={filter}>
        {#each uniqueTypes() as type}
          <option value={type}>
            {type === "all" ? "All" : type === "auto-generated" ? "🤖 Auto-created" : type}
          </option>
        {/each}
      </select>
    {/if}
  </div>

  {#if filteredSkills().length === 0}
    <div class="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
      <p class="text-sm text-slate-400">No skills found</p>
      {#if searchQuery || filter !== "all"}
        <p class="text-xs text-slate-500">Try adjusting your search or filters</p>
      {/if}
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each filteredSkills() as skill (skill.name)}
        <div class="glass-panel rounded-xl p-5 flex flex-col transition-all hover:border-indigo-500/30">
          <div class="flex items-start justify-between mb-2">
            <h3 class="font-bold text-sm text-white">{skill.name}</h3>
            <div class="flex gap-1">
              {#if skill.source === "auto-generated"}
                <span class="text-[9px] font-bold px-2 py-0.5 rounded border bg-green-950/50 text-green-400 border-green-500/30">🤖 AI</span>
              {/if}
              {#if skill.type || skill.category}
                <span class="text-[9px] font-bold px-2 py-0.5 rounded border bg-indigo-950/50 text-indigo-400 border-indigo-500/30">
                  {skill.type || skill.category}
                </span>
              {/if}
            </div>
          </div>
          {#if skill.description}
            <p class="text-xs text-slate-400 mb-3 leading-relaxed">{skill.description}</p>
          {/if}

          {#if skill.parameters?.length}
            <div class="mb-3">
              <p class="text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Parameters</p>
              <div class="space-y-1">
                {#each skill.parameters as param}
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] font-mono text-slate-300">{param.name}</span>
                    {#if param.required}
                      <span class="text-[9px] px-1.5 py-0.5 rounded border {paramBadgeColor('required')}">required</span>
                    {/if}
                    {#if param.type}
                      <span class="text-[9px] text-slate-500">{param.type}</span>
                    {/if}
                  </div>
                  {#if param.description}
                    <p class="text-[10px] text-slate-500 ml-1">{param.description}</p>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          {#if skill.tags?.length}
            <div class="flex flex-wrap gap-1 mt-auto pt-2 border-t border-slate-800">
              {#each skill.tags as tag}
                <span class="custom-badge text-[9px]">{tag}</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
