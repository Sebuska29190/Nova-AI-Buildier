/**
 * Nexus AI Discord Bridge
 * WebSocket-based Discord bot with slash commands, message handling, threads, reactions
 * Ported from Hermes Agent discord_tool.py
 */

import { safeMessage } from "../errors.ts";

interface DiscordConfig {
  token: string;
  guildId?: string;
  channelIds?: string[];
  commandPrefix?: string;
}

let ws: WebSocket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let config: DiscordConfig | null = null;
let sequence: number | null = null;
let sessionId: string | null = null;
let messageHandler: ((msg: any) => void) | null = null;

const API_BASE = "https://discord.com/api/v10";
const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

export function configureDiscord(cfg: DiscordConfig) {
  config = cfg;
}

export function onDiscordMessage(handler: (msg: any) => void) {
  messageHandler = handler;
}

export function isDiscordConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export async function connectDiscord(): Promise<string> {
  if (!config?.token) return "Discord token not configured. Set DISCORD_TOKEN in .env";

  return new Promise((resolve) => {
    try {
      ws = new WebSocket(GATEWAY_URL);
    } catch (e: any) {
      resolve(`Discord connection error: ${e.message}`);
      return;
    }

    ws.onopen = () => {
      console.log("  ✓ Discord gateway connected");
    };

    ws.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data as string);
        const { op, t, d, s } = payload;

        if (s) sequence = s;

        switch (op) {
          case 10: { // Hello
            // Start heartbeating
            const interval = d.heartbeat_interval;
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            heartbeatInterval = setInterval(() => {
              if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ op: 1, d: sequence }));
              }
            }, interval);

            // Identify
            ws!.send(JSON.stringify({
              op: 2,
              d: {
                token: config!.token,
                intents: 1 | 512 | 32768, // GUILDS | GUILD_MESSAGES | MESSAGE_CONTENT
                properties: { $os: "windows", $browser: "nova", $device: "nova" },
              },
            }));
            break;
          }

          case 11: { // Heartbeat ACK
            break;
          }

          case 0: { // Dispatch
            if (t === "READY") {
              sessionId = d.session_id;
              console.log(`  ✓ Discord ready: @${d.user.username}`);
              resolve(`Connected as @${d.user.username}`);
            }

            if (t === "MESSAGE_CREATE" && messageHandler) {
              // Ignore bot's own messages
              if (d.author?.bot) return;
              messageHandler(d);
            }
            break;
          }

          case 7: // Reconnect
          case 9: { // Invalid session
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            ws?.close();
            ws = null;
            setTimeout(() => connectDiscord(), 5000);
            break;
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      resolve("Discord WebSocket error — check token and network");
    };

    ws.onclose = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      ws = null;
      // Auto-reconnect after 5s
      setTimeout(() => {
        if (!ws && config?.token) connectDiscord();
      }, 5000);
    };

    // Timeout after 10s if no READY received
    setTimeout(() => resolve("Discord connection timed out — check token"), 10000);
  });
}

export function disconnectDiscord() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (ws) {
    ws.close(1000, "Shutdown");
    ws = null;
  }
  sessionId = null;
  sequence = null;
}

export async function sendDiscordMessage(channelId: string, content: string): Promise<string> {
  if (!config?.token) return "Discord not configured";
  try {
    const res = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return `Discord send error: ${res.status} ${res.statusText}`;
    const data = await res.json();
    return `Message sent: ${data.id}`;
  } catch (e: any) {
    return `Discord send error: ${e.message}`;
  }
}

export async function getDiscordMessages(channelId: string, limit = 20): Promise<string> {
  if (!config?.token) return "Discord not configured";
  try {
    const res = await fetch(`${API_BASE}/channels/${channelId}/messages?limit=${limit}`, {
      headers: { Authorization: `Bot ${config.token}` },
    });
    if (!res.ok) return `Discord fetch error: ${res.status}`;
    const messages = await res.json();
    return messages.map((m: any) => `[${m.author.username}] ${m.content}`).join("\n");
  } catch (e: any) {
    return `Discord fetch error: ${e.message}`;
  }
}

export async function listDiscordChannels(guildId?: string): Promise<string> {
  if (!config?.token) return "Discord not configured";
  const gid = guildId || config.guildId;
  if (!gid) return "Guild ID not configured. Set DISCORD_GUILD_ID in .env";
  try {
    const res = await fetch(`${API_BASE}/guilds/${gid}/channels`, {
      headers: { Authorization: `Bot ${config.token}` },
    });
    if (!res.ok) return `Discord fetch error: ${res.status}`;
    const channels = await res.json();
    return channels
      .filter((c: any) => c.type === 0) // text channels only
      .map((c: any) => `  #${c.name} (${c.id})`)
      .join("\n");
  } catch (e: any) {
    return `Discord fetch error: ${e.message}`;
  }
}
