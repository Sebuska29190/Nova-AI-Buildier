<script lang="ts">
  import { onMount } from "svelte";

  let providers = $state<any[]>([]);
  let models = $state<Array<{ id: string }>>([]);
  let rules = $state("");
  let loading = $state(false);
  let saving = $state(false);
  let errorMsg = $state("");
  let editingKey: Record<string, string> = $state({});
  let editingBaseUrl: Record<string, string> = $state({});
  let editingMaxTokens: Record<string, number> = $state({});
  let editingThinking: Record<string, string> = $state({});
  let editingTtsEngine = $state("auto");
  let editingVideoQuality = $state("medium");
  let editingImageEngine = $state("auto");
  let tab = $state<"providers" | "rules" | "defaults">("providers");

  let { models: _models }: { models?: Array<{ id: string }> } = $props();

  onMount(() => {
    loadConfig();
    models = _models || [];
  });

  // Known env vars for each provider (hardcoded for display)
  const ENV_VARS: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    gemini: "GEMINI_API_KEY",
    grok: "XAI_API_KEY",
    kimi: "KIMI_API_KEY",
    minimax: "MINIMAX_API_KEY",
    qwen: "DASHSCOPE_API_KEY",
    zhipu: "ZHIPU_API_KEY",
    lmstudio: "LMSTUDIO_API_KEY",
    ollama: "OLLAMA_API_KEY",
    custom: "CUSTOM_API_KEY",
  };

  // Check if a key is loaded from .env by whether it's present in process.env
  function isFromEnv(providerId: string): boolean {
    return providers.find((p: any) => p.providerId === providerId)?.keySource === "env";
  }

  async function loadConfig() {
    loading = true;
    errorMsg = "";
    try {
      const [provRes, rulesRes] = await Promise.all([
        fetch("/api/config/providers"),
        fetch("/api/config/rules"),
      ]);
      const provData = await provRes.json();
      const rulesData = await rulesRes.json();
      providers = provData.providers || [];
      rules = rulesData.rules || rulesData.content || "";
    } catch (e: any) {
      errorMsg = e?.message || "Failed to load configuration";
    } finally {
      loading = false;
    }
  }

  async function saveRules() {
    saving = true;
    errorMsg = "";
    try {
      await fetch("/api/config/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
    } catch (e: any) {
      errorMsg = e?.message || "Failed to save rules";
    } finally {
      saving = false;
    }
  }

  async function toggleProvider(id: string) {
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;
    const enabled = !provider.enabled;
    try {
      await fetch(`/api/config/providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      provider.enabled = enabled;
    } catch (e: any) {
      errorMsg = e?.message || "Failed to toggle provider";
    }
  }

  async function updateApiKey(providerId: string, key: string) {
    try {
      await fetch(`/api/config/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
    } catch (e: any) {
      errorMsg = e?.message || "Failed to update API key";
    }
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">Configuration Dashboard</h2>
      <p class="text-xs text-slate-400 mt-1">Tweak system values: provider preferences, API keys, and system rules.</p>
    </div>
    <button class="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onclick={loadConfig}>
      <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
      Refresh
    </button>
  </div>

  <!-- Tabs -->
  <div class="flex gap-1 mb-6 border-b border-slate-800 pb-0">
    <button onclick={() => tab = "providers"} class="px-4 py-2 text-xs font-semibold transition-all border-b-2 {tab === 'providers' ? 'border-[#00f2fe] text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}">Providers & Keys</button>
    <button onclick={() => tab = "rules"} class="px-4 py-2 text-xs font-semibold transition-all border-b-2 {tab === 'rules' ? 'border-[#00f2fe] text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}">System Rules</button>
    <button onclick={() => tab = "defaults"} class="px-4 py-2 text-xs font-semibold transition-all border-b-2 {tab === 'defaults' ? 'border-[#00f2fe] text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}">Defaults</button>
  </div>

  {#if errorMsg}
    <div class="glass-panel rounded-xl p-4 mb-6 border border-red-500/30">
      <p class="text-xs text-red-400">{errorMsg}</p>
    </div>
  {/if}

  {#if tab === "providers"}

  {#if loading}
    <div class="glass-panel rounded-xl p-8 flex items-center justify-center mb-6">
      <div class="flex items-center gap-3">
        <span class="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin"></span>
        <span class="text-xs text-slate-400">Loading configuration...</span>
      </div>
    </div>
  {/if}

  <!-- Providers -->
  <div class="glass-panel rounded-xl p-5 mb-6">
    <h3 class="font-bold text-sm text-white mb-4 flex items-center gap-2">
      <i data-lucide="cpu" class="w-4 h-4 text-[#00f2fe]"></i>
      LLM Providers
    </h3>

    {#if providers.length === 0 && !loading}
      <p class="text-xs text-slate-500">No providers configured.</p>
    {:else}
      <div class="space-y-3">
        {#each providers as provider}
          <div class="flex items-center justify-between p-3 bg-[#020408]/40 rounded-lg border border-slate-800/50">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <button
                class="w-7 h-4 rounded-full transition-colors relative shrink-0 {provider.enabled ? 'bg-[#00f2fe]' : 'bg-slate-700'}"
                onclick={() => toggleProvider(provider.id)}
              >
                <span class="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all {provider.enabled ? 'left-3.5' : 'left-0.5'}"></span>
              </button>
              <div class="min-w-0">
                <span class="text-sm text-white font-medium">{provider.name || provider.id}</span>
                {#if provider.model}
                  <span class="text-[10px] text-slate-500 ml-2 font-mono">{provider.model}</span>
                {/if}
                <div class="flex flex-wrap gap-1 mt-1">
                  {#if provider.keySource === "env"}
                    <span class="text-[9px] bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded border border-green-700/30 font-mono">.env</span>
                    <span class="text-[9px] bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded border border-blue-700/30 font-mono">{ENV_VARS[provider.providerId] || provider.providerId.toUpperCase() + "_API_KEY"}</span>
                  {:else if provider.keySource === "saved"}
                    <span class="text-[9px] bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded border border-amber-700/30 font-mono">saved</span>
                  {:else}
                    <span class="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700/30 font-mono">no key</span>
                  {/if}
                  <span class="text-[9px] bg-slate-800/60 text-slate-500 px-1.5 py-0.5 rounded font-mono">{provider.modelCount} models</span>
                </div>
              </div>
            </div>
          </div>

          {#if provider.id}
            <div class="pl-10 -mt-2 mb-1">
              <input
                type="password"
                placeholder="API Key..."
                class="w-full bg-[#020408]/60 border border-slate-800 rounded px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe]"
                onchange={(e) => updateApiKey(provider.id, (e.target as HTMLInputElement).value)}
              />
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  <!-- Models -->
  {#if models.length > 0}
    <div class="glass-panel rounded-xl p-5 mb-6">
      <h3 class="font-bold text-sm text-white mb-4 flex items-center gap-2">
        <i data-lucide="layers" class="w-4 h-4 text-indigo-400"></i>
        Available Models
      </h3>
      <div class="flex flex-wrap gap-2">
        {#each models as model}
          <span class="text-[10px] bg-[#020408]/60 text-slate-400 border border-slate-800 px-2 py-1 rounded font-mono">{model.id}</span>
        {/each}
      </div>
    </div>
  {/if}
{/if}

{#if tab === "rules"}
  <!-- Rules -->
  <div class="glass-panel rounded-xl p-5 mb-6">
    <h3 class="font-bold text-sm text-white mb-4 flex items-center gap-2">
      <i data-lucide="scroll-text" class="w-4 h-4 text-amber-400"></i>
      System Rules
    </h3>
    <textarea
      class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-[#00f2fe] resize-y"
      rows="8"
      placeholder="Define system behavior rules..."
      bind:value={rules}
    ></textarea>
    <div class="flex justify-end mt-3">
      <button
        class="btn-premium px-4 py-1.5 rounded text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        onclick={saveRules}
        disabled={saving}
      >
        {#if saving}
          <span class="w-3 h-3 border-2 border-[#020408] border-t-transparent rounded-full animate-spin"></span>
        {/if}
        {saving ? "Saving..." : "Save Rules"}
      </button>
    </div>
  </div>
{/if}

{#if tab === "defaults"}
  <!-- Defaults -->
  <div class="glass-panel rounded-xl p-5 mb-6">
    <h3 class="font-bold text-sm text-white mb-4 flex items-center gap-2">
      <i data-lucide="sliders" class="w-4 h-4 text-purple-400"></i>
      Generation Defaults
    </h3>
    <div class="space-y-4">
      <div>
        <label class="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">Default TTS Engine</label>
        <div class="flex gap-2">
          {#each ["auto", "edge", "gTTS", "elevenlabs", "azure"] as engine}
            <button onclick={() => editingTtsEngine = engine} class="px-3 py-1.5 text-xs rounded-lg border transition-all {editingTtsEngine === engine ? 'border-[#00f2fe] text-white bg-[#00f2fe]/10' : 'border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'}">{engine}</button>
          {/each}
        </div>
      </div>
      <div>
        <label class="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">Default Image Engine</label>
        <div class="flex gap-2">
          {#each ["auto", "dalle3", "stable-diffusion", "imagen"] as engine}
            <button onclick={() => editingImageEngine = engine} class="px-3 py-1.5 text-xs rounded-lg border transition-all {editingImageEngine === engine ? 'border-[#00f2fe] text-white bg-[#00f2fe]/10' : 'border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'}">{engine}</button>
          {/each}
        </div>
      </div>
      <div>
        <label class="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">Video Quality</label>
        <div class="flex gap-2">
          {#each ["low", "medium", "high"] as q}
            <button onclick={() => editingVideoQuality = q} class="px-3 py-1.5 text-xs rounded-lg border transition-all {editingVideoQuality === q ? 'border-[#00f2fe] text-white bg-[#00f2fe]/10' : 'border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'}">{q}</button>
          {/each}
        </div>
      </div>
      <div class="flex justify-end pt-2 border-t border-slate-800">
        <button class="btn-premium px-4 py-1.5 rounded text-xs flex items-center gap-1.5"
          onclick={async () => {
            try { await fetch("/api/config/settings", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ttsEngine:editingTtsEngine, imageEngine:editingImageEngine, videoQuality:editingVideoQuality }) }); }
            catch(e:any) { errorMsg = e?.message || "Failed to save defaults"; }
          }}>
          <i data-lucide="save" class="w-3 h-3"></i> Save Defaults
        </button>
      </div>
    </div>
  </div>
{/if}
</div>
