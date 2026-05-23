<script lang="ts">
  import { onMount } from "svelte";

  let kimuStatus = $state<string>("unknown");
  let loading = $state(false);
  let cmdText = $state("");
  let cmdResult = $state("");
  let showIframe = $state(false);

  onMount(() => {
    checkStatus();
  });

  async function checkStatus() {
    try {
      const res = await fetch("/api/kimu/status");
      if (res.ok) {
        const data = await res.json();
        kimuStatus = data.status || "unknown";
        showIframe = data.ready === true || data.status === "running";
      } else {
        kimuStatus = "unavailable";
      }
    } catch {
      kimuStatus = "unavailable";
    }
  }

  async function startKimu() {
    loading = true;
    try {
      const res = await fetch("/api/kimu/start", { method: "POST" });
      if (res.ok) {
        kimuStatus = "running";
        showIframe = true;
      } else {
        const data = await res.json();
        cmdResult = data.error || "Failed to start";
      }
    } catch (e: any) {
      cmdResult = e.message;
    }
    loading = false;
  }

  async function sendCommand() {
    if (!cmdText.trim()) return;
    cmdResult = "";
    try {
      const res = await fetch("/api/kimu/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmdText.trim() }),
      });
      const data = await res.json();
      cmdResult = JSON.stringify(data, null, 2);
    } catch (e: any) {
      cmdResult = e.message;
    }
  }

  function handleCmdKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendCommand();
    }
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="mb-6">
    <h2 class="text-lg font-bold text-white">Kimu Video Editor</h2>
    <p class="text-xs text-slate-400 mt-1">Visual timeline-based video composer with drag-drop assets, transitions, and effects.</p>
  </div>

  <!-- Status Bar -->
  <div class="glass-panel rounded-xl p-4 mb-6 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <span
          class="w-2.5 h-2.5 rounded-full {kimuStatus === 'running' ? 'bg-emerald-500' : kimuStatus === 'starting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}"
        ></span>
        <span class="text-xs font-mono text-slate-300">{kimuStatus === "running" ? "Kimu Editor Active" : kimuStatus === "starting" ? "Starting..." : "Kimu Editor Offline"}</span>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick={checkStatus}
        class="text-[10px] px-3 py-1.5 rounded-lg border border-slate-800 bg-[#020408]/60 text-slate-400 hover:border-slate-600 transition-all"
      >Refresh Status</button>
      {#if kimuStatus !== "running"}
        <button
          onclick={startKimu}
          disabled={loading}
          class="btn-premium px-4 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-40"
        >{loading ? "Starting..." : "Launch Editor"}</button>
      {/if}
    </div>
  </div>

  {#if showIframe}
    <!-- Editor Frame -->
    <div class="glass-panel rounded-xl overflow-hidden border border-slate-800 mb-6">
      <div class="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-rose-500/80"></span>
          <span class="w-3 h-3 rounded-full bg-amber-500/80"></span>
          <span class="w-3 h-3 rounded-full bg-emerald-500/80"></span>
          <span class="text-[11px] font-mono text-slate-500 ml-2">kimu-editor — localhost:3100</span>
        </div>
        <i data-lucide="film" class="w-4 h-4 text-slate-600"></i>
      </div>
      <div class="bg-[#020408] w-full" style="height: 520px;">
        <iframe
          src="/api/kimu/editor"
          class="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Kimu Video Editor"
        ></iframe>
      </div>
    </div>
  {:else}
    <!-- Offline Placeholder -->
    <div class="glass-panel rounded-xl p-12 mb-6 flex flex-col items-center justify-center text-center">
      <div class="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
        <i data-lucide="film" class="w-6 h-6 text-slate-600"></i>
      </div>
      <p class="text-sm text-slate-400 mb-1">Editor is not running</p>
      <p class="text-xs text-slate-600 mb-4">Launch the Kimu editor daemon to start editing videos</p>
      <button
        onclick={startKimu}
        disabled={loading}
        class="btn-premium px-6 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
      >{loading ? "Starting..." : "Launch Editor"}</button>
    </div>
  {/if}

  <!-- Command Console -->
  <div class="glass-panel rounded-xl p-4">
    <h3 class="text-xs font-bold text-white mb-3">Command Console</h3>
    <div class="flex gap-2 mb-3">
      <input
        type="text"
        bind:value={cmdText}
        onkeydown={handleCmdKeydown}
        placeholder="Type a command (e.g. /help, /open project, /render timeline)"
        class="flex-1 bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe]"
      />
      <button
        onclick={sendCommand}
        disabled={!cmdText.trim()}
        class="btn-premium px-4 py-2 rounded-lg text-[10px] font-semibold disabled:opacity-40"
      >Send</button>
    </div>
    {#if cmdResult}
      <pre class="bg-[#020408]/60 border border-slate-800 rounded-lg p-3 text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-48 overflow-y-auto"><code>{cmdResult}</code></pre>
    {/if}
  </div>
</div>
