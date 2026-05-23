<script lang="ts">
  let { connected, version, selectedModel, models, workspaceName, onWorkspacePick }: {
    connected: boolean; version: string; selectedModel: string;
    models: Array<{ id: string }>; workspaceName: string; onWorkspacePick: () => void;
  } = $props();
</script>

<header class="h-14 border-b border-[rgba(255,255,255,0.03)] flex items-center justify-between px-6 z-10 bg-[rgba(2,4,8,0.7)] backdrop-blur-md">
  <div class="flex items-center gap-3">
    <div class="w-2 h-2 rounded-full bg-emerald-500 active-dot"></div>
    <span class="text-xs font-mono text-slate-400">
      Agent Status: <strong class="text-white">deepseek-v4-flash {connected ? '(active)' : '(offline)'}</strong>
    </span>
  </div>

  <div class="flex items-center gap-3">
    <!-- Model Select -->
    <select bind:value={selectedModel} class="bg-[#0b0f19] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00f2fe] transition-all">
      <option value="deepseek-chat">deepseek-chat (v4-flash)</option>
      <option value="deepseek-coder">deepseek-coder-v2</option>
      <option value="nova-ai-builder">Nova AI Builder</option>
    </select>

    <!-- Workspace Picker -->
    <button onclick={onWorkspacePick} class="flex items-center gap-2 bg-[#0b0f19] hover:bg-[#121926] border border-slate-800 rounded-lg px-3.5 py-1.5 text-xs text-white transition-all">
      <i data-lucide="folder" class="w-3.5 h-3.5 text-[#00f2fe]"></i>
      <span>{workspaceName || "No folder selected"}</span>
    </button>

    <button class="bg-[#0b0f19] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all">
      New Chat
    </button>
  </div>
</header>

<script lang="ts" context="module">
  // Lucide icons are initialized globally in App.svelte
</script>
