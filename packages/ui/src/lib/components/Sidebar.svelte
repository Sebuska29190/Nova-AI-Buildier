<script lang="ts">
  let { route, onRoute, version }: {
    route: string; onRoute: (r: string) => void; version: string;
  } = $props();

  const navGroups = [
    { label: "Main", items: [
      { id: "chat", icon: "message-square", label: "Chat Assistant", active: true },
      { id: "agents", icon: "users-2", label: "Agents", badge: "16" },
      { id: "skills", icon: "zap", label: "Skills", badge: "46" },
      { id: "plugins", icon: "plus-circle", label: "Add Tools / Plugins" },
    ]},
    { label: "Data", items: [
      { id: "sessions", icon: "history", label: "Sessions" },
      { id: "channels", icon: "radio", label: "Channels", dot: "emerald" },
      { id: "memory", icon: "brain", label: "Memory DB" },
    ]},
    { label: "Tools", items: [
      { id: "workspace", icon: "folder-git2", label: "Workspace" },
      { id: "video", icon: "video", label: "Video Gen" },
      { id: "editor", icon: "file-code", label: "AI Editor" },
      { id: "worker", icon: "cpu", label: "Worker Nodes" },
      { id: "crypto", icon: "coins", label: "Crypto Hub" },
      { id: "trading", icon: "trending-up", label: "Trading Hub" },
      { id: "shopping", icon: "shopping-bag", label: "Smart Shopping" },
      { id: "terminal", icon: "terminal", label: "Terminal" },
    ]},
    { label: "Configuration", items: [
      { id: "settings", icon: "settings", label: "Settings" },
      { id: "apikeys", icon: "key-round", label: "API Keys" },
      { id: "logs", icon: "scroll-text", label: "System Logs" },
      { id: "profiles", icon: "user-cog", label: "User Profiles" },
      { id: "aimodels", icon: "toy-brick", label: "AI Models" },
      { id: "schedule", icon: "calendar", label: "Cron Schedule" },
      { id: "analytics", icon: "bar-chart-3", label: "Analytics" },
      { id: "docs", icon: "book-open", label: "Documentation" },
    ]},
  ];
</script>

<aside class="w-64 bg-[#05080f]/90 border-r border-[rgba(255,255,255,0.03)] flex flex-col justify-between z-20 backdrop-blur-md">
  <div class="overflow-y-auto flex-1">
    <!-- Branding -->
    <div class="p-5 border-b border-[rgba(255,255,255,0.03)] flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#00f2fe] to-[#6366f1] flex items-center justify-center shadow-[0_0_15px_rgba(0,242,254,0.35)]">
        <i data-lucide="orbit" class="w-4.5 h-4.5 text-black font-extrabold"></i>
      </div>
      <div>
        <h1 class="font-extrabold text-sm tracking-wide text-white font-mono">NOVA AI BUILDER</h1>
        <span class="text-[9px] text-[#00f2fe] tracking-widest uppercase font-mono font-semibold">BUILDER SUITE</span>
      </div>
    </div>

    <!-- Search -->
    <div class="px-4 py-3">
      <div class="relative">
        <i data-lucide="search" class="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500"></i>
        <input type="text" placeholder="Quick Search..." class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-[11px] focus:outline-none focus:border-[#00f2fe] transition-all text-slate-300">
      </div>
    </div>

    <!-- Navigation -->
    <nav class="px-3 space-y-4 pb-6">
      {#each navGroups as group}
        <div>
          <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-1">{group.label}</div>
          <div class="space-y-0.5">
            {#each group.items as item}
              <a
                href="#"
                onclick={() => onRoute(item.id)}
                class="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all
                  {route === item.id
                    ? 'bg-[rgba(0,242,254,0.06)] border-l-2 border-[#00f2fe] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-[rgba(255,255,255,0.02)]'}"
              >
                <div class="flex items-center gap-2.5">
                  {#if item.dot}
                    <span class="w-4 h-4 relative">
                      <i data-lucide={item.icon} class="w-4 h-4"></i>
                      <span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 active-dot"></span>
                    </span>
                  {:else}
                    <i data-lucide={item.icon} class="w-4 h-4 {route === item.id ? 'text-[#00f2fe]' : ''}"></i>
                  {/if}
                  <span>{item.label}</span>
                </div>
                {#if item.badge}
                  <span class="text-[10px] bg-indigo-950/50 text-indigo-300 px-1.5 py-0.2 rounded font-mono font-bold">{item.badge}</span>
                {/if}
              </a>
            {/each}
          </div>
        </div>
      {/each}

      <!-- Recent Sessions -->
      <div>
        <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-1">Recent Sessions</div>
        <div class="space-y-0.5 text-[11px] px-3 font-mono text-slate-400 space-y-1">
          <div class="flex items-center gap-2 hover:text-white cursor-pointer py-0.5 transition-all">
            <span class="w-1.5 h-1.5 rounded-full bg-[#00f2fe]/40"></span>
            <span class="truncate">deepseek/deepseek-chat</span>
          </div>
          <div class="flex items-center gap-2 hover:text-white cursor-pointer py-0.5 transition-all">
            <span class="w-1.5 h-1.5 rounded-full bg-[#00f2fe]/40"></span>
            <span class="truncate">deepseek/deepseek-chat</span>
          </div>
          <div class="flex items-center gap-2 hover:text-white cursor-pointer py-0.5 transition-all">
            <span class="w-1.5 h-1.5 rounded-full bg-[#00f2fe]/40"></span>
            <span class="truncate">deepseek/deepseek-chat</span>
          </div>
        </div>
      </div>
    </nav>
  </div>

  <!-- Bottom: Profile -->
  <div class="p-3 border-t border-[rgba(255,255,255,0.03)] bg-[#030509]/90">
    <div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900/60 transition-all cursor-pointer">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white">OP</div>
        <div>
          <div class="text-[11px] font-semibold text-white">System Operator</div>
          <div class="text-[9px] text-slate-500">core@nova-ai-builder</div>
        </div>
      </div>
      <i data-lucide="sliders" class="w-3.5 h-3.5 text-slate-400 hover:text-[#00f2fe] transition-colors"></i>
    </div>
  </div>
</aside>
