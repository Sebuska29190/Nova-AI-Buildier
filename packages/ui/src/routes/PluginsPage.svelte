<script lang="ts">
  import { onMount } from "svelte";

  let plugins = $state<any[]>([]);
  let loading = $state(false);
  let installing = $state<string | null>(null);
  let errorMsg = $state("");
  let searchQuery = $state("");
  let filterType = $state("all");

  onMount(() => {
    loadPlugins();
  });

  async function loadPlugins() {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch("http://localhost:4123/api/plugins");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      plugins = data.plugins || data || [];
    } catch (e: any) {
      errorMsg = "Failed to load plugins: " + (e.message || e);
    } finally {
      loading = false;
    }
  }

  async function installPlugin(id: string) {
    installing = id;
    errorMsg = "";
    try {
      const res = await fetch("http://localhost:4123/api/plugins/" + id + "/install", {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      await loadPlugins();
    } catch (e: any) {
      errorMsg = "Failed to install plugin: " + (e.message || e);
    } finally {
      installing = null;
    }
  }

  async function uninstallPlugin(id: string) {
    installing = id;
    errorMsg = "";
    try {
      const res = await fetch("http://localhost:4123/api/plugins/" + id + "/uninstall", {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      await loadPlugins();
    } catch (e: any) {
      errorMsg = "Failed to uninstall plugin: " + (e.message || e);
    } finally {
      installing = null;
    }
  }

  async function configurePlugin(id: string, config: object) {
    errorMsg = "";
    try {
      const res = await fetch("http://localhost:4123/api/plugins/" + id + "/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadPlugins();
    } catch (e: any) {
      errorMsg = "Failed to configure plugin: " + (e.message || e);
    }
  }

  $effect(() => {
    // re-filter search on query/filter change
    searchQuery;
    filterType;
  });

  function filteredPlugins() {
    let list = plugins;
    if (filterType !== "all") {
      list = list.filter(p => p.type === filterType || p.category === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.author?.toLowerCase().includes(q)
      );
    }
    return list;
  }

  function typeBadgeColor(type: string) {
    switch (type?.toLowerCase()) {
      case "mcp": case "mcp-server": return "bg-indigo-950/50 text-indigo-400 border-indigo-500/30";
      case "tool": case "developer tool": return "bg-slate-900 text-slate-400 border-slate-800";
      case "skill": return "bg-emerald-950 text-emerald-400 border-emerald-500/20";
      case "bridge": return "bg-amber-950 text-amber-400 border-amber-500/20";
      default: return "bg-slate-900 text-slate-500 border-slate-800";
    }
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="mb-6">
    <h2 class="text-lg font-bold text-white">Plugin Integration Hub</h2>
    <p class="text-xs text-slate-400 mt-0.5">Extend and customize AI abilities with community and corporate modules.</p>
  </div>

  {#if errorMsg}
    <div class="glass-panel rounded-xl p-3 mb-4 border border-red-500/30">
      <p class="text-xs text-red-400">{errorMsg}</p>
    </div>
  {/if}

  <!-- Search & Filter Bar -->
  <div class="flex items-center gap-3 mb-5">
    <div class="relative flex-1">
      <input class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500"
             placeholder="Search plugins..." bind:value={searchQuery} />
    </div>
    <select class="px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white"
            bind:value={filterType}>
      <option value="all">All Types</option>
      <option value="mcp">MCP</option>
      <option value="tool">Tool</option>
      <option value="skill">Skill</option>
      <option value="bridge">Bridge</option>
    </select>
    <button class="btn-premium px-3 py-1.5 rounded-lg text-xs" onclick={loadPlugins} disabled={loading}>
      {loading ? "Loading..." : "Refresh"}
    </button>
  </div>

  {#if loading && plugins.length === 0}
    <div class="glass-panel rounded-xl p-8 flex items-center justify-center">
      <p class="text-sm text-slate-400">Loading plugins...</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each filteredPlugins() as plugin (plugin.id || plugin.name)}
        <div class="glass-panel rounded-xl p-5 flex flex-col justify-between transition-all hover:border-indigo-500/30">
          <div>
            <div class="flex items-start justify-between mb-3">
              <div class="w-9 h-9 rounded-lg bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center">
                {#if plugin.icon}
                  <span class="text-base">{plugin.icon}</span>
                {:else}
                  <i data-lucide={plugin.type === "mcp" ? "layers" : "terminal"} class="w-4.5 h-4.5 text-[#00f2fe]"></i>
                {/if}
              </div>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded border {plugin.installed ? 'bg-emerald-950 text-emerald-400 border-emerald-500/20' : 'bg-slate-900 text-slate-500 border-slate-800'}">
                {plugin.installed ? "Installed" : "Available"}
              </span>
            </div>
            <h3 class="font-bold text-sm text-white mb-1">{plugin.name}</h3>
            <p class="text-xs text-slate-400 mb-3 leading-relaxed line-clamp-2">{plugin.description || "No description"}</p>
            {#if plugin.type || plugin.category}
              <span class="text-[9px] font-bold px-2 py-0.5 rounded border {typeBadgeColor(plugin.type || plugin.category)}">
                {plugin.type || plugin.category}
              </span>
            {/if}
            {#if plugin.tags?.length}
              <div class="flex flex-wrap gap-1 mt-2">
                {#each plugin.tags as tag}
                  <span class="custom-badge text-[9px]">{tag}</span>
                {/each}
              </div>
            {/if}
          </div>
          <div class="flex items-center justify-between border-t border-slate-800 pt-3 mt-3">
            <span class="text-[10px] font-mono text-slate-500">by {plugin.author || "unknown"}</span>
            <div class="flex gap-1.5">
              {#if plugin.installed}
                <button class="text-[11px] px-2.5 py-1 rounded bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-400 border border-indigo-900/30 transition-all"
                        onclick={() => configurePlugin(plugin.id || plugin.name, {})}>
                  Configure
                </button>
                <button class="text-[11px] px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 transition-all"
                        onclick={() => uninstallPlugin(plugin.id || plugin.name)}
                        disabled={installing === (plugin.id || plugin.name)}>
                  {installing === (plugin.id || plugin.name) ? "..." : "Remove"}
                </button>
              {:else}
                <button class="btn-premium px-3 py-1 rounded text-xs"
                        onclick={() => installPlugin(plugin.id || plugin.name)}
                        disabled={installing === (plugin.id || plugin.name)}>
                  {installing === (plugin.id || plugin.name) ? "Installing..." : "Install"}
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>

    {#if filteredPlugins().length === 0 && !loading}
      <div class="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2 mt-4">
        <p class="text-sm text-slate-400">No plugins found</p>
        {#if searchQuery || filterType !== "all"}
          <p class="text-xs text-slate-500">Try adjusting your search or filters</p>
        {:else}
          <p class="text-xs text-slate-500">The plugin registry is empty</p>
        {/if}
      </div>
    {/if}
  {/if}
</div>
