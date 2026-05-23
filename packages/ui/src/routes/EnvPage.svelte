<script lang="ts">
  import { onMount } from "svelte";

  let providers = $state<any[]>([]);
  let loading = $state(true);
  let editingKey = $state<Record<string, string>>({});
  let showKey = $state<Record<string, boolean>>({});
  let saving = $state<Record<string, boolean>>({});
  let errorMsg = $state("");

  onMount(() => {
    loadProviders();
  });

  async function loadProviders() {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch("/api/config/providers");
      const data = await res.json();
      providers = data.providers || data || [];
      for (const p of providers) {
        editingKey[p.id] = "";
        showKey[p.id] = false;
        saving[p.id] = false;
      }
    } catch (e: any) {
      errorMsg = "Failed to load providers: " + (e.message || e);
    } finally {
      loading = false;
    }
  }

  async function saveApiKey(providerId: string) {
    const key = editingKey[providerId];
    if (!key) return;
    saving[providerId] = true;
    errorMsg = "";
    try {
      const res = await fetch(`/api/config/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      if (!res.ok) throw new Error(await res.text());
      editingKey[providerId] = "";
      await loadProviders();
    } catch (e: any) {
      errorMsg = "Failed to save API key: " + (e.message || e);
    } finally {
      saving[providerId] = false;
    }
  }

  async function toggleProvider(providerId: string) {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;
    const enabled = !provider.enabled;
    errorMsg = "";
    try {
      const res = await fetch(`/api/config/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      provider.enabled = enabled;
    } catch (e: any) {
      errorMsg = "Failed to toggle provider: " + (e.message || e);
    }
  }

  function maskKey(key: string): string {
    if (!key || key.length < 8) return key || "";
    return key.slice(0, 4) + "****" + key.slice(-4);
  }

  function keyLabel(providerId: string): string {
    const p = providers.find((x) => x.id === providerId);
    if (p?.apiKey) return "Update";
    return "Save";
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">API Keys Management</h2>
      <p class="text-xs text-slate-400 mt-1">Control secure keys, tokens, and verification secrets used by the orchestrator.</p>
    </div>
    <button class="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onclick={loadProviders}>
      <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
      Refresh
    </button>
  </div>

  {#if errorMsg}
    <div class="glass-panel rounded-xl p-3 mb-4 border border-red-500/30">
      <p class="text-xs text-red-400">{errorMsg}</p>
    </div>
  {/if}

  {#if loading}
    <div class="glass-panel rounded-xl p-8 flex items-center justify-center">
      <p class="text-sm text-slate-400">Loading providers...</p>
    </div>
  {:else if providers.length === 0}
    <div class="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
      <p class="text-sm text-slate-400">No providers configured</p>
      <p class="text-xs text-slate-500">Add API keys to enable AI model providers.</p>
    </div>
  {:else}
    <div class="glass-panel rounded-xl p-5 space-y-4">
      {#each providers as provider}
        <div class="flex items-center justify-between border-b border-slate-800/50 last:border-0 pb-4 last:pb-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-white">{provider.name || provider.id}</h3>
              <button
                class="text-[10px] px-2 py-0.5 rounded-full border transition-all {provider.enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}"
                onclick={() => toggleProvider(provider.id)}
              >
                {provider.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
            {#if provider.description}
              <p class="text-[11px] text-slate-500 mt-0.5">{provider.description}</p>
            {/if}
          </div>
          <div class="flex items-center gap-2 ml-4">
            {#if editingKey[provider.id]}
              <input
                type={showKey[provider.id] ? "text" : "password"}
                class="bg-[#020408]/60 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300 font-mono w-56 focus:outline-none focus:border-[#00f2fe]"
                placeholder="Enter API key..."
                bind:value={editingKey[provider.id]}
              />
            {:else}
              <div class="flex items-center gap-2">
                {#if provider.apiKey || provider.apiKeyConfigured}
                  <span class="text-xs text-slate-400 font-mono bg-[#020408]/60 px-2 py-1 rounded">
                    {showKey[provider.id] && provider.apiKey
                      ? provider.apiKey
                      : maskKey(provider.apiKey || "")}
                  </span>
                {:else}
                  <span class="text-xs text-slate-500 italic">No key set</span>
                {/if}
              </div>
            {/if}
            <div class="flex items-center gap-1">
              {#if provider.apiKey}
                <button
                  class="text-[10px] px-2 py-1 rounded text-slate-400 hover:text-white transition-all"
                  onclick={() => showKey[provider.id] = !showKey[provider.id]}
                  title={showKey[provider.id] ? "Hide" : "Show"}
                >
                  {showKey[provider.id] ? "Hide" : "Show"}
                </button>
              {/if}
              {#if editingKey[provider.id]}
                <button
                  class="btn-premium px-2.5 py-1.5 rounded text-[10px] disabled:opacity-40"
                  onclick={() => saveApiKey(provider.id)}
                  disabled={saving[provider.id] || !editingKey[provider.id].trim()}
                >
                  {saving[provider.id] ? "Saving..." : keyLabel(provider.id)}
                </button>
                <button
                  class="text-[10px] px-2 py-1 rounded text-slate-400 hover:text-white transition-all"
                  onclick={() => editingKey[provider.id] = ""}
                >Cancel</button>
              {:else}
                <button
                  class="text-[10px] px-2 py-1 rounded border border-slate-800 text-slate-400 hover:text-white transition-all"
                  onclick={() => editingKey[provider.id] = provider.apiKey || ""}
                >{provider.apiKey ? "Change" : "Add"}</button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
