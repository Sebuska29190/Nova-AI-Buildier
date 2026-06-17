import { useState, useEffect } from "react";
import { api } from "../lib/api";

const SENSITIVE_KEYS = /token|api[_-]?key|secret|password|pass|auth/i;
function maskValue(key: string, value: unknown): string {
  const s = String(value);
  if (SENSITIVE_KEYS.test(key) && s.length > 0) {
    return s.length <= 8 ? "********" : s.slice(0, 3) + "****" + s.slice(-3);
  }
  return s.length > 25 ? s.slice(0, 25) + "..." : s;
}

interface ChannelDef {
  type: string;
  icon: string;
  color: string;
  title: string;
  desc: string;
  configFields: { key: string; label: string; type: string; prefix?: string }[];
}

interface ConfigEntry {
  key: string;
  label: string;
  type: string;
  prefix?: string;
}

const channelDefs: ChannelDef[] = [
  { type: "telegram", icon: "send", color: "#6366f1", title: "Telegram Gateway",
    desc: "Empower your agent to monitor targeted groups, push urgent alerts, and execute queries from secure chats.",
    configFields: [{ key: "token", label: "Bot Token", type: "password" }, { key: "chatId", label: "Chat ID", type: "text" }] },
  { type: "discord", icon: "message-square", color: "indigo-400", title: "Discord Bridge",
    desc: "Deploy automated companion bots to channels, bridging centralized user interactions with system servers.",
    configFields: [{ key: "token", label: "Bot Secret Token", type: "password" }, { key: "channelId", label: "Channel ID", type: "text" }] },
  { type: "ntfy", icon: "bell-ring", color: "rose-500", title: "Ntfy Push Alerts",
    desc: "Ultra-clean, free, zero-config push notifications. Instantly receive system build statuses directly on your desktop or mobile.",
    configFields: [{ key: "topic", label: "Topic", type: "text", prefix: "ntfy.sh/" }] },
  { type: "slack", icon: "message-circle", color: "emerald-400", title: "Slack Integration",
    desc: "Route agent broadcasts, error reports, and scheduled summaries directly into your Slack workspaces.",
    configFields: [{ key: "token", label: "Bot Token", type: "password" }, { key: "channel", label: "Channel Name", type: "text" }] },
  { type: "whatsapp", icon: "phone", color: "green-400", title: "WhatsApp Business",
    desc: "Enable two-way communication with clients and stakeholders via WhatsApp message relays.",
    configFields: [{ key: "phoneNumberId", label: "Phone Number ID", type: "text" }, { key: "accessToken", label: "Access Token", type: "password" }] },
  { type: "websocket", icon: "radio", color: "cyan-400", title: "WebSocket Relay",
    desc: "Real-time bidirectional event streaming for live agent state, logs, and command execution.",
    configFields: [{ key: "url", label: "WebSocket URL", type: "text" }] },
  { type: "email", icon: "mail", color: "yellow-400", title: "Email Gateway",
    desc: "Send formatted reports, alerts, and digests via SMTP. Supports HTML templates and attachments.",
    configFields: [
      { key: "host", label: "SMTP Host", type: "text" }, { key: "port", label: "Port", type: "text" },
      { key: "user", label: "Username", type: "text" }, { key: "pass", label: "Password", type: "password" },
    ] },
  { type: "signal", icon: "phone", color: "blue-400", title: "Signal Messenger",
    desc: "End-to-end encrypted messaging via Signal CLI. Requires signal-cli and a registered phone number.",
    configFields: [{ key: "phoneNumber", label: "Phone Number (+1234567890)", type: "text" }, { key: "signalCliPath", label: "signal-cli path (optional)", type: "text" }] },
  { type: "matrix", icon: "message-square", color: "green-400", title: "Matrix (Element)",
    desc: "Decentralized, open-source messaging protocol. Connect to any Matrix homeserver.",
    configFields: [{ key: "homeserver", label: "Homeserver URL", type: "text" }, { key: "userId", label: "User ID", type: "text" }, { key: "accessToken", label: "Access Token", type: "password" }, { key: "roomId", label: "Room ID", type: "text" }] },
  { type: "googlechat", icon: "message-circle", color: "blue-300", title: "Google Chat",
    desc: "Receive and send messages in Google Chat spaces via incoming webhooks.",
    configFields: [{ key: "webhookUrl", label: "Webhook URL", type: "password" }, { key: "spaceId", label: "Space ID", type: "text" }] },
];

export function ChannelsPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [savedConfigs, setSavedConfigs] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  useEffect(() => { loadChannels(); }, []);

  async function loadChannels() {
    setLoading(true);
    try {
      setChannels(await api.channels());
      const res = await fetch("/api/channels/configs");
      if (res.ok) {
        const data = await res.json();
        setSavedConfigs(data.configs || {});
      }
    } catch (e) {
      console.error("Failed to load channels", e);
    } finally {
      setLoading(false);
    }
  }

  async function connectChannel(type: string, config: Record<string, string>) {
    try {
      const res = await fetch("/api/channels/" + type + "/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to connect");
      }
      await loadChannels();
    } catch (e: any) {
      setTestResults((prev) => ({ ...prev, [type]: "✗ " + (e.message || "Connection error") }));
    }
  }

  async function disconnectChannel(id: string) {
    try {
      await fetch("/api/channels/" + id + "/stop", { method: "POST" });
      await loadChannels();
    } catch (e) {
      console.error("Failed to disconnect channel", e);
    }
  }

  async function testChannel(id: string) {
    setTesting((prev) => ({ ...prev, [id]: true }));
    setTestResults((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch("/api/channels/" + id + "/test", { method: "POST" });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [id]: data.ok ? "✓ Connected OK" : "✗ " + (data.error || data.message || "Test failed") }));
    } catch (e: any) {
      setTestResults((prev) => ({ ...prev, [id]: "✗ " + (e.message || "Connection error") }));
    } finally {
      setTesting((prev) => ({ ...prev, [id]: false }));
    }
  }

  function getStatus(ch: any, defType: string): { label: string; cls: string } {
    if (ch?.connected) return { label: "Connected", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    if (savedConfigs[defType]) return { label: "Configured", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
    return { label: "Not configured", cls: "bg-slate-800 text-slate-500 border-slate-700/30" };
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">External Communication Pipelines</h2>
          <p className="text-xs text-slate-400">Establish pathways between Nova Agent actions and third-party networks.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500">
            {channels.filter((c) => c.connected).length} connected · {Object.keys(savedConfigs).length} configured
          </span>
          <button onClick={loadChannels} className="bg-[#0e1117] hover:bg-slate-800 text-slate-400 border border-slate-800 px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="text-xs text-slate-500 font-mono">Loading channels...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channelDefs.map((def) => {
            const ch = channels.find((c: any) => c.id === def.type);
            const status = getStatus(ch, def.type);
            const savedCfg = savedConfigs[def.type] || {};

            return (
              <div key={def.type} className="glass-panel rounded-xl p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke={def.color} strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                    <h3 className="font-bold text-sm text-white">{def.title}</h3>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${status.cls}`}>{status.label}</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">{def.desc}</p>

                {/* Saved config indicator */}
                {Object.keys(savedCfg).length > 0 && (
                  <div className="mb-3 p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <p className="text-[10px] text-blue-400 mb-1 font-semibold uppercase tracking-wider">Saved config</p>
                    {Object.entries(savedCfg).map(([k, v]) => (
                      <div key={k} className="text-[10px] text-slate-400 font-mono">
                        <span className="text-slate-500">{k}:</span> {maskValue(k, v)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Connected state */}
                {ch?.connected ? (
                  <>
                    {ch.config && Object.keys(ch.config).length > 0 && (
                      <div className="space-y-1 mb-4 p-2 bg-[#020408]/40 rounded-lg">
                        {Object.entries(ch.config).map(([k, v]) => (
                          <div key={k} className="text-[10px] text-slate-400 font-mono truncate">
                            <span className="text-slate-500">{k}:</span> {maskValue(k, v)}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      {testResults[ch.id] && (
                        <span className={`text-[10px] font-mono ${testResults[ch.id].startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                          {testResults[ch.id]}
                        </span>
                      )}
                      <button onClick={() => testChannel(ch.id)} disabled={testing[ch.id]}
                        className="bg-[#0a0e17] hover:bg-slate-850 text-slate-300 border border-slate-800 px-3 py-1 rounded text-[10px] transition-all">
                        {testing[ch.id] ? "Testing..." : "Test"}
                      </button>
                      <button onClick={() => disconnectChannel(ch.id)}
                        className="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1 rounded text-[10px] transition-all">Disconnect</button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Config form — pre-fill with saved values */}
                    <div className="space-y-2 mb-4">
                      {def.configFields.map((field: ConfigEntry) => {
                        const savedVal = savedCfg[field.key] || "";
                        const configKey = def.type + "_" + field.key;
                        const val = configs[configKey] !== undefined ? configs[configKey] : savedVal;
                        return field.prefix ? (
                          <div key={field.key} className="flex">
                            <span className="bg-[#020408]/60 border border-slate-800 rounded-l px-2.5 py-1.5 text-xs text-slate-500 font-mono">{field.prefix}</span>
                            <input type={field.type || "text"} placeholder={field.label}
                              value={val} onChange={(e) => setConfigs((prev) => ({ ...prev, [configKey]: e.target.value }))}
                              className="flex-1 bg-[#020408]/60 border border-l-0 border-slate-800 rounded-r px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#6366f1]" />
                          </div>
                        ) : (
                          <input key={field.key} type={field.type || "text"} placeholder={field.label}
                            value={val} onChange={(e) => setConfigs((prev) => ({ ...prev, [configKey]: e.target.value }))}
                            className="w-full bg-[#020408]/60 border border-slate-800 rounded px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#6366f1]" />
                        );
                      })}
                    </div>
                    {testResults[def.type] && (
                      <div className={`text-[10px] font-mono mb-2 ${testResults[def.type].startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                        {testResults[def.type]}
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button onClick={() => {
                        const cfg: Record<string, string> = {};
                        for (const f of def.configFields) {
                          const v = configs[def.type + "_" + f.key] || savedCfg[f.key] || "";
                          if (v) cfg[f.key] = v;
                        }
                        connectChannel(def.type, cfg);
                      }} className="btn-premium px-3 py-1 rounded text-xs">
                        {Object.keys(savedCfg).length > 0 ? "Reconnect" : "Connect"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
