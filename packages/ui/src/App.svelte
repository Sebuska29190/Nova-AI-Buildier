<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "./lib/api.ts";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import StatusBar from "./lib/components/StatusBar.svelte";
  import Toast from "./lib/components/ui/Toast.svelte";

  // ── Pages ──
  import ChatPage from "./routes/ChatPage.svelte";
  import AgentsPage from "./routes/AgentsPage.svelte";
  import SkillsPage from "./routes/SkillsPage.svelte";
  import PluginsPage from "./routes/PluginsPage.svelte";
  import SessionsPage from "./routes/SessionsPage.svelte";
  import ChannelsPage from "./routes/ChannelsPage.svelte";
  import MemoryPage from "./routes/MemoryPage.svelte";
  import ConfigPage from "./routes/ConfigPage.svelte";
  import EnvPage from "./routes/EnvPage.svelte";
  import LogsPage from "./routes/LogsPage.svelte";
  import AnalyticsPage from "./routes/AnalyticsPage.svelte";
  import ModelsPage from "./routes/ModelsPage.svelte";
  import CronPage from "./routes/CronPage.svelte";
  import ProfilesPage from "./routes/ProfilesPage.svelte";
  import DocsPage from "./routes/DocsPage.svelte";
  import VideoPage from "./routes/VideoPage.svelte";
  import VideoEditorPage from "./routes/VideoEditorPage.svelte";
  import WorkerPage from "./routes/WorkerPage.svelte";
  import TradingPage from "./routes/TradingPage.svelte";
  import TerminalPage from "./routes/TerminalPage.svelte";
  import WorkspacePage from "./routes/WorkspacePage.svelte";
  import CryptoPage from "./routes/CryptoPage.svelte";
  import ShoppingPage from "./routes/ShoppingPage.svelte";

  // ── Extra route pages (nowe z designu) ──
  import EditorPage from "./routes/EditorPage.svelte";

  // ── Data state ──
  let health: any = null;
  let models: Array<{ id: string }> = [];
  let sessions: any[] = [];
  let skills: any[] = [];
  let agents: any[] = [];
  let channels: any[] = [];
  let memories: any[] = [];
  let version = "";
  let connected = false;
  let route = "chat";
  let toastMsg = "";
  let toastType: "success" | "error" | "info" = "info";
  let workspaceName = "";

  function showToast(msg: string, type: "success" | "error" | "info" = "info") {
    toastMsg = msg; toastType = type;
  }

  async function refresh() {
    try {
      const h = await api.health();
      health = h;
      version = h.version || "0.3.0";
      connected = true;
    } catch { connected = false; return; }
    try { models = await api.models(); } catch {}
    try { sessions = await api.sessions(); } catch {}
    try { skills = await api.skills(); } catch {}
    try { agents = await api.agents(); } catch {}
    try { channels = await api.channels(); } catch {}
    try { memories = await api.memories(); } catch {}
  }

  function onRoute(r: string) { route = r; }

  function triggerWorkspacePicker() {
    if ('showDirectoryPicker' in window) {
      (window as any).showDirectoryPicker().then((dir: any) => {
        workspaceName = dir.name;
        showToast(`Workspace mapped: ${dir.name}`, "success");
      }).catch(() => {
        showToast("Directory picker cancelled", "info");
      });
    } else {
      showToast("Directory picker not available in this browser", "info");
    }
  }

  function initLucide() {
    // Lucide icons auto-init via <script> in HTML — but in Svelte we
    // need to run lucide.createIcons() after each DOM update
    const interval = setInterval(() => {
      if ((window as any).lucide?.createIcons) {
        (window as any).lucide.createIcons();
        clearInterval(interval);
      }
    }, 100);
  }

  onMount(() => {
    initLucide();
    refresh();
    const int = setInterval(() => { try { refresh(); } catch {} }, 15000);
    return () => clearInterval(int);
  });

  // ── Page components map ──
  const pages: Record<string, any> = {
    chat: ChatPage,
    agents: AgentsPage,
    skills: SkillsPage,
    plugins: PluginsPage,
    sessions: SessionsPage,
    channels: ChannelsPage,
    memory: MemoryPage,
    config: ConfigPage,
    env: EnvPage,
    logs: LogsPage,
    analytics: AnalyticsPage,
    aimodels: ModelsPage,
    schedule: CronPage,
    profiles: ProfilesPage,
    docs: DocsPage,
    video: VideoPage,
    "video-editor": VideoEditorPage,
    worker: WorkerPage,
    trading: TradingPage,
    terminal: TerminalPage,
    workspace: WorkspacePage,
    crypto: CryptoPage,
    shopping: ShoppingPage,
    settings: ConfigPage,
    apikeys: EnvPage,
    editor: EditorPage,
    tools: WorkspacePage,
  };
</script>

<!-- Ambient background -->
<div class="ambient-glow"></div>

<div class="h-dvh max-h-dvh flex bg-[#020408] text-nova-foreground overflow-hidden relative z-10">
  <!-- Sidebar -->
  <Sidebar {route} onRoute={onRoute} {version} />

  <!-- Main content -->
  <div class="flex-1 flex flex-col min-w-0">
    <StatusBar
      {connected}
      version={version || "0.6.1"}
      selectedModel={models[0]?.id || "deepseek/deepseek-chat"}
      {models}
      {workspaceName}
      onWorkspacePick={triggerWorkspacePicker}
    />

    <main class="flex-1 overflow-y-auto relative p-6 z-10" id="main-content">
      {#if pages[route]}
        {@const Comp = pages[route]}
        <Comp
          {models}
          {skills}
          {agents}
          {sessions}
          onResolved={() => {}}
          onRefresh={() => refresh()}
          onSessionChange={() => refresh()}
        />
      {:else}
        <div class="flex flex-col items-center justify-center h-full gap-3 text-slate-400 max-w-5xl mx-auto w-full">
          <div class="w-12 h-12 rounded-xl bg-[rgba(0,242,254,0.06)] border border-[#00f2fe]/20 flex items-center justify-center">
            <i data-lucide="sparkles" class="w-5 h-5 text-[#00f2fe]"></i>
          </div>
          <h2 class="text-lg font-bold text-white">Coming Soon</h2>
          <p class="text-xs text-slate-400">This section is under development</p>
        </div>
      {/if}
    </main>
  </div>
</div>

{#if toastMsg}
  <Toast message={toastMsg} type={toastType} onclose={() => { toastMsg = ""; }} />
{/if}
