<script lang="ts">
  import { api } from "../lib/api.ts";
  import { onMount } from "svelte";

  let channels = $state<any[]>([]);
  let loading = $state(true);
  let configs: Record<string, any> = $state({});
  let testing: Record<string, boolean> = $state({});
  let testResults: Record<string, string> = $state({});

  onMount(() => {
    loadChannels();
  });

  async function loadChannels() {
    loading = true;
    try {
      channels = await api.channels();
    } catch (e) {
      console.error("Failed to load channels", e);
    } finally {
      loading = false;
    }
  }

  async function connectChannel(type: string, config: object) {
    try {
      await fetch("/api/channels/" + type + "/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      await loadChannels();
    } catch (e) {
      console.error("Failed to connect channel", e);
    }
  }

  async function disconnectChannel(id: string) {
    try {
      await fetch("/api/channels/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await loadChannels();
    } catch (e) {
      console.error("Failed to disconnect channel", e);
    }
  }

  async function testChannel(id: string) {
    testing[id] = true;
    testResults[id] = "";
    try {
      const res = await fetch("/api/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      testResults[id] = data.ok ? "✓ Connected successfully" : `✗ ${data.error || "Test failed"}`;
    } catch (e: any) {
      testResults[id] = `✗ ${e.message || "Connection error"}`;
    } finally {
      testing[id] = false;
    }
  }

  function getStatus(ch: any): { label: string; cls: string } {
    if (ch?.connected) return { label: "Connected", cls: "bg-emerald-950 text-emerald-400 font-bold" };
    if (ch?.error) return { label: "Error", cls: "bg-red-950 text-red-400" };
    return { label: "Offline", cls: "bg-slate-900 text-slate-500" };
  }

  const channelDefs = [
    { type: "telegram", icon: "send", color: "#00f2fe", title: "Telegram Gateway", desc: "Empower your agent to monitor targeted groups, push urgent alerts, and execute queries from secure chats.",
      configFields: [{ key: "botToken", label: "Bot Token", type: "password" }, { key: "chatId", label: "Chat ID", type: "text" }] },
    { type: "discord", icon: "message-square", color: "indigo-400", title: "Discord Bridge", desc: "Deploy automated companion bots to channels, bridging centralized user interactions with system servers.",
      configFields: [{ key: "botToken", label: "Bot Secret Token", type: "password" }] },
    { type: "ntfy", icon: "bell-ring", color: "rose-500", title: "Ntfy Push Alerts", desc: "Ultra-clean, free, zero-config push notifications. Instantly receive system build statuses directly on your desktop or mobile.",
      configFields: [{ key: "topic", label: "Topic", type: "text", prefix: "ntfy.sh/" }] },
    { type: "slack", icon: "message-circle", color: "emerald-400", title: "Slack Integration", desc: "Route agent broadcasts, error reports, and scheduled summaries directly into your Slack workspaces.",
      configFields: [{ key: "webhookUrl", label: "Webhook URL", type: "password" }] },
    { type: "whatsapp", icon: "phone", color: "green-400", title: "WhatsApp Business", desc: "Enable two-way communication with clients and stakeholders via WhatsApp message relays.",
      configFields: [{ key: "apiKey", label: "API Key", type: "password" }, { key: "phoneNumber", label: "Phone Number", type: "text" }] },
    { type: "websocket", icon: "radio", color: "cyan-400", title: "WebSocket Relay", desc: "Real-time bidirectional event streaming for live agent state, logs, and command execution.",
      configFields: [{ key: "url", label: "WebSocket URL", type: "text" }] },
    { type: "email", icon: "mail", color: "yellow-400", title: "Email Gateway", desc: "Send formatted reports, alerts, and digests via SMTP. Supports HTML templates and attachments.",
      configFields: [{ key: "smtpHost", label: "SMTP Host", type: "text" }, { key: "smtpPort", label: "Port", type: "text" }, { key: "username", label: "Username", type: "text" }, { key: "password", label: "Password", type: "password" }] },
  ];
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">External Communication Pipelines</h2>
      <p class="text-xs text-slate-400">Establish pathways between Nova Agent actions and third-party networks.</p>
    </div>
    <span class="text-xs font-mono bg-[#00f2fe]/10 text-[#00f2fe] border border-[#00f2fe]/20 px-3 py-1 rounded-full flex items-center gap-1.5">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 active-dot"></span>
      {channels.filter((c) => c.connected).length} / {channels.length} active
    </span>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-20">
      <span class="text-xs text-slate-500 font-mono">Loading channels...</span>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each channelDefs as def}
        {@const ch = channels.find((c: any) => c.type === def.type) || { type: def.type, connected: false }}
        {@const status = getStatus(ch)}
        <div class="glass-panel rounded-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <i data-lucide={def.icon} class="w-4.5 h-4.5 text-[{def.color}]"></i>
              <h3 class="font-bold text-sm text-white">{def.title}</h3>
            </div>
            <span class="text-[9px] {status.cls} px-2 py-0.5 rounded font-mono">{status.label}</span>
          </div>
          <p class="text-xs text-slate-400 mb-4">{def.desc}</p>

          {#if ch.connected}
            <div class="space-y-2 mb-4">
              {#if ch.config}
                {#each Object.entries(ch.config) as [k, v]}
                  <div class="text-xs text-slate-500 font-mono truncate">
                    <span class="text-slate-400">{k}:</span> {typeof v === "string" && v.length > 20 ? v.slice(0, 20) + "..." : v}
                  </div>
                {/each}
              {/if}
            </div>
            <div class="flex justify-end gap-2">
              {#if testResults[ch.id]}
                <span class="text-xs font-mono {testResults[ch.id].startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}">{testResults[ch.id]}</span>
              {/if}
              <button onclick={() => testChannel(ch.id)} disabled={testing[ch.id]} class="bg-[#0a0e17] hover:bg-slate-850 text-slate-300 border border-slate-800 px-3 py-1 rounded text-xs transition-all">
                {testing[ch.id] ? "Testing..." : "Test"}
              </button>
              <button onclick={() => disconnectChannel(ch.id)} class="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1 rounded text-xs transition-all">Disconnect</button>
            </div>
          {:else}
            <div class="space-y-2 mb-4">
              {#each def.configFields as field}
                {#if field.prefix}
                  <div class="flex">
                    <span class="bg-[#020408]/60 border border-slate-800 rounded-l px-2.5 py-1.5 text-xs text-slate-500 font-mono">{field.prefix}</span>
                    <input
                      type={field.type || "text"}
                      placeholder={field.label}
                      bind:value={configs[def.type + "_" + field.key]}
                      class="flex-1 bg-[#020408]/60 border border-l-0 border-slate-800 rounded-r px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe]"
                    />
                  </div>
                {:else}
                  <input
                    type={field.type || "text"}
                    placeholder={field.label}
                    bind:value={configs[def.type + "_" + field.key]}
                    class="w-full bg-[#020408]/60 border border-slate-800 rounded px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe]"
                  />
                {/if}
              {/each}
            </div>
            <div class="flex justify-end">
              <button
                onclick={() => {
                  const cfg: Record<string, string> = {};
                  for (const f of def.configFields) {
                    const v = configs[def.type + "_" + f.key];
                    if (v) cfg[f.key] = v;
                  }
                  connectChannel(def.type, cfg);
                }}
                class="btn-premium px-3 py-1 rounded text-xs"
              >Connect</button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
