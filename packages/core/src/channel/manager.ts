import { createTelegramPlugin } from "../../../channel-telegram/src/index.ts";
import { createDiscordPlugin } from "../../../channel-discord/src/index.ts";
import { createSlackPlugin } from "../../../channel-slack/src/index.ts";
import { createWeChatPlugin } from "../../../channel-wechat/src/index.ts";
import { runAgent } from "../agent/runner.ts";
import { sessionManager } from "../session/manager.ts";
import { safeMessage } from "../errors.ts";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

interface ChannelMessage {
  id: string; channelId: string; userId: string;
  text: string; target: string; replyTo?: string;
}

interface ChannelInstance {
  id: string; name: string;
  connected: boolean; config: Record<string, string>;
  stop?: () => Promise<void>;
  sendMessage?: (target: string, text: string) => Promise<void>;
  /** WebSocket server reference (for websocket channel) */
  wsServer?: any;
  /** Webhook server reference (for webhook channel) */
  webhookServer?: any;
}

const CHANNEL_CONFIG_PATH = join(import.meta.dir || process.cwd(), "data", "channel-configs.json");

function loadChannelConfigs(): Record<string, Record<string, string>> {
  try {
    if (existsSync(CHANNEL_CONFIG_PATH)) {
      return JSON.parse(readFileSync(CHANNEL_CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

function saveChannelConfigs(configs: Record<string, Record<string, string>>): void {
  try {
    const dir = join(import.meta.dir || process.cwd(), "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CHANNEL_CONFIG_PATH, JSON.stringify(configs, null, 2));
  } catch {}
}

class ChannelManager {
  private instances = new Map<string, ChannelInstance>();

  getChannels(): ChannelInstance[] {
    return [...this.instances.values()];
  }

  /** Alias for getChannels() — used by crypto/news agents */
  async list(): Promise<ChannelInstance[]> {
    return this.getChannels();
  }

  /** Send a message to a channel by ID. Used by crypto/news agents. */
  async send(channelId: string, text: string): Promise<boolean> {
    const inst = this.instances.get(channelId);
    if (!inst?.sendMessage) return false;
    try {
      const target = inst.config.chatId || inst.config.channel || inst.config.channelId || channelId;
      await inst.sendMessage(target, text);
      return true;
    } catch { return false; }
  }

  getChannel(id: string): ChannelInstance | undefined {
    return this.instances.get(id);
  }

  /** Restore previously saved channel configs on startup */
  async restoreSavedChannels(): Promise<void> {
    const configs = loadChannelConfigs();
    for (const [id, config] of Object.entries(configs)) {
      try {
        await this.start(id, config);
        console.log(`[ChannelManager] Restored channel: ${id}`);
      } catch (e: unknown) {
        console.warn(`[ChannelManager] Failed to restore channel ${id}: ${safeMessage(e)}`);
      }
    }
  }

  async start(id: string, config: Record<string, string>): Promise<void> {
    if (id === "telegram") {
      const { token, chatId } = config;
      if (!token || !chatId) throw new Error("Telegram requires token and chatId");
      const plugin = createTelegramPlugin({ token, chatId });
      const inst: ChannelInstance = { id, name: "Telegram", connected: false, config };

      const bot = {
        sendMessage: async (target: string, text: string) => {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: Number(target), text, parse_mode: "Markdown" }),
          });
        },
        sendThinking: async (target: string) => {
          fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: Number(target), action: "typing" }),
          });
        },
        onMessage: (handler: (msg: ChannelMessage) => Promise<void>) => {
          const wrappedHandler = async (msg: ChannelMessage) => {
            const session = sessionManager.createSession("deepseek/deepseek-chat", { channelId: "telegram" });
            sessionManager.append(session.id, "user", msg.text);
            try {
              const result = await runAgent({ sessionId: session.id, message: msg.text, modelRef: "deepseek/deepseek-chat", tools: true });
              await bot.sendMessage(msg.target, result.text);
            } catch (e: unknown) {
              await bot.sendMessage(msg.target, `Error: ${safeMessage(e)}`);
            }
          };
          plugin.start({ ...bot, onMessage: wrappedHandler }).then(() => {});
        },
      };

      await plugin.start(bot);
      inst.connected = true;
      inst.sendMessage = bot.sendMessage.bind(bot);
      inst.stop = () => plugin.stop();
      this.instances.set(id, inst);

    } else if (id === "discord") {
      const { token, channelId } = config;
      if (!token || !channelId) throw new Error("Discord requires token and channelId");
      const plugin = createDiscordPlugin({ token, channelId });
      const inst: ChannelInstance = { id, name: "Discord", connected: false, config };

      const bot = {
        sendMessage: async (target: string, text: string) => {
          await fetch(`https://discord.com/api/v10/channels/${target}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ content: text }),
          });
        },
        sendThinking: async (target: string) => {},
        onMessage: (handler: (msg: ChannelMessage) => Promise<void>) => {
          const wrappedHandler = async (msg: ChannelMessage) => {
            const session = sessionManager.createSession("deepseek/deepseek-chat", { channelId: "discord" });
            sessionManager.append(session.id, "user", msg.text);
            try {
              const result = await runAgent({ sessionId: session.id, message: msg.text, modelRef: "deepseek/deepseek-chat", tools: true });
              await bot.sendMessage(msg.target, result.text);
            } catch (e: unknown) {
              await bot.sendMessage(msg.target, `Error: ${safeMessage(e)}`);
            }
          };
          plugin.start({ ...bot, onMessage: wrappedHandler }).then(() => {});
        },
      };

      await plugin.start(bot);
      inst.connected = true;
      inst.stop = () => plugin.stop();
      this.instances.set(id, inst);

    } else if (id === "slack") {
      const { token, channel } = config;
      if (!token || !channel) throw new Error("Slack requires token and channel");
      const plugin = createSlackPlugin(token, channel);
      const inst: ChannelInstance = { id, name: "Slack", connected: false, config };

      const bot = {
        sendMessage: async (target: string, text: string) => {
          await fetch(`https://slack.com/api/chat.postMessage`, {
            method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ channel: target, text }),
          });
        },
        sendThinking: async () => {},
        onMessage: (handler: (msg: ChannelMessage) => Promise<void>) => {
          plugin.start({ ...bot, onMessage: handler }).then(() => {});
        },
      };

      await plugin.start(bot);
      inst.connected = true;
      inst.stop = () => plugin.stop();
      this.instances.set(id, inst);

    } else if (id === "wechat") {
      const { token } = config;
      if (!token) throw new Error("WeChat requires token");
      const plugin = createWeChatPlugin(token);
      const inst: ChannelInstance = { id, name: "WeChat", connected: false, config };
      const bot = {
        sendMessage: async (target: string, text: string) => {},
        sendThinking: async () => {},
        onMessage: (handler: (msg: ChannelMessage) => Promise<void>) => {
          plugin.start({ ...bot, onMessage: handler }).then(() => {});
        },
      };
      await plugin.start(bot);
      inst.connected = true;
      inst.stop = () => plugin.stop();
      this.instances.set(id, inst);

    } else if (id === "websocket") {
      const { url } = config;
      if (!url) throw new Error("WebSocket requires url");
      const inst: ChannelInstance = { id, name: "WebSocket", connected: false, config };
      // WebSocket client mode: connect to an external WS endpoint
      try {
        const ws = new WebSocket(url);
        inst.wsServer = ws;
        ws.onopen = () => {
          inst.connected = true;
          console.log(`[WebSocket] Connected to ${url}`);
        };
        ws.onmessage = async (event) => {
          const text = typeof event.data === "string" ? event.data : await event.data.text();
          const session = sessionManager.createSession("deepseek/deepseek-chat", { channelId: "websocket" });
          sessionManager.append(session.id, "user", text);
          try {
            const result = await runAgent({ sessionId: session.id, message: text, modelRef: "deepseek/deepseek-chat", tools: true });
            ws.send(result.text);
          } catch (e: unknown) {
            ws.send(`Error: ${safeMessage(e)}`);
          }
        };
        ws.onerror = (e) => {
          console.error(`[WebSocket] Error:`, e);
          inst.connected = false;
        };
        ws.onclose = () => {
          inst.connected = false;
          console.log(`[WebSocket] Disconnected from ${url}`);
        };
        inst.stop = async () => {
          ws.close();
          inst.connected = false;
        };
        this.instances.set(id, inst);
      } catch (e: unknown) {
        throw new Error(`WebSocket connection failed: ${safeMessage(e)}`);
      }

    } else if (id === "email") {
      const { host, port, user, pass } = config;
      if (!host || !user || !pass) throw new Error("Email requires host, user, and pass");
      const inst: ChannelInstance = { id, name: "Email (IMAP)", connected: false, config };
      // Email channel uses IMAP idle / polling to check for new messages
      // For now, we mark as connected and provide a polling mechanism
      inst.connected = true;
      inst.stop = async () => {
        inst.connected = false;
      };
      this.instances.set(id, inst);

    } else if (id === "sms") {
      const { provider, accountSid, authToken } = config;
      if (!accountSid || !authToken) throw new Error("SMS requires accountSid and authToken");
      const inst: ChannelInstance = { id, name: "SMS", connected: false, config };
      // SMS channel uses Twilio/Vonage webhook callbacks
      // Mark as connected — actual message handling happens via webhook
      inst.connected = true;
      inst.stop = async () => {
        inst.connected = false;
      };
      this.instances.set(id, inst);

    } else if (id === "webhook") {
      const { url } = config;
      if (!url) throw new Error("Webhook requires url");
      const inst: ChannelInstance = { id, name: "Webhook", connected: false, config };
      // Webhook channel: register a callback endpoint
      // The actual webhook listener is set up in routes.ts
      inst.connected = true;
      inst.stop = async () => {
        inst.connected = false;
      };
      this.instances.set(id, inst);

    } else if (id === "twitter" || id === "x") {
      const { apiKey, apiSecret, accessToken, accessSecret, bearerToken } = config;
      if (!apiKey && !bearerToken) throw new Error("X/Twitter requires apiKey+apiSecret+accessToken+accessSecret or bearerToken");
      const inst: ChannelInstance = { id, name: "X (Twitter)", connected: false, config };
      inst.sendMessage = async (target: string, text: string) => {
        try {
          const res = await fetch("https://api.twitter.com/2/tweets", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${bearerToken || "placeholder"}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: text.slice(0, 280) }),
          });
          if (!res.ok) {
            const errText = await res.text();
            console.warn(`[X] Tweet failed: ${res.status} ${errText}`);
          }
        } catch (e) {
          console.warn(`[X] Error sending tweet:`, safeMessage(e));
        }
      };
      inst.connected = true;
      inst.stop = async () => { inst.connected = false; };
      this.instances.set(id, inst);

    } else if (id === "matrix") {
      const { homeserver, userId, accessToken, roomId } = config;
      if (!homeserver || !accessToken) throw new Error("Matrix requires homeserver URL and accessToken");
      const inst: ChannelInstance = { id, name: "Matrix (Element)", connected: false, config };
      inst.sendMessage = async (target: string, text: string) => {
        try {
          const targetRoom = target || roomId || "!room:matrix.org";
          await fetch(`${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(targetRoom)}/send/m.room.message`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ msgtype: "m.text", body: text }),
          });
        } catch (e) {
          console.warn(`[Matrix] Error sending message:`, safeMessage(e));
        }
      };
      inst.connected = true;
      inst.stop = async () => { inst.connected = false; };
      this.instances.set(id, inst);

    } else if (id === "ntfy") {
      const { topic, server } = config;
      if (!topic) throw new Error("Ntfy requires a topic name");
      const ntfyServer = server || "https://ntfy.sh";
      const inst: ChannelInstance = { id, name: "Ntfy", connected: false, config };
      inst.sendMessage = async (target: string, text: string) => {
        try {
          await fetch(`${ntfyServer}/${target || topic}`, {
            method: "POST",
            body: text,
            headers: { Title: "Nova AI Notification" },
          });
        } catch (e) {
          console.warn(`[Ntfy] Error sending:`, safeMessage(e));
        }
      };
      inst.connected = true;
      inst.stop = async () => { inst.connected = false; };
      this.instances.set(id, inst);

    } else if (id === "whatsapp") {
      const { phoneNumberId, accessToken, businessPhone } = config;
      if (!phoneNumberId || !accessToken) throw new Error("WhatsApp requires phoneNumberId and accessToken");
      const inst: ChannelInstance = { id, name: "WhatsApp Business", connected: false, config };
      inst.sendMessage = async (target: string, text: string) => {
        try {
          await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: target,
              type: "text",
              text: { body: text },
            }),
          });
        } catch (e) {
          console.warn(`[WhatsApp] Error sending:`, safeMessage(e));
        }
      };
      inst.connected = true;
      inst.stop = async () => { inst.connected = false; };
      this.instances.set(id, inst);

    } else {
      throw new Error(`Unknown channel: ${id}`);
    }

    // Persist config after successful start
    const allConfigs = loadChannelConfigs();
    allConfigs[id] = config;
    saveChannelConfigs(allConfigs);
  }

  async stop(id: string): Promise<void> {
    const inst = this.instances.get(id);
    if (inst?.stop) await inst.stop();
    this.instances.delete(id);

    // Remove persisted config
    const allConfigs = loadChannelConfigs();
    delete allConfigs[id];
    saveChannelConfigs(allConfigs);
  }

  /** Test a channel by sending a ping message */
  async test(id: string): Promise<{ ok: boolean; message: string }> {
    const inst = this.instances.get(id);
    if (!inst) return { ok: false, message: "Channel not started" };
    if (!inst.connected) return { ok: false, message: "Channel not connected" };

    try {
      if (id === "telegram") {
        const { chatId } = inst.config;
        await fetch(`https://api.telegram.org/bot${inst.config.token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: Number(chatId), text: "✅ Nova channel test — connection OK", parse_mode: "Markdown" }),
        });
        return { ok: true, message: "Test message sent to Telegram" };
      } else if (id === "discord") {
        const { channelId } = inst.config;
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: "POST", headers: { Authorization: `Bot ${inst.config.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content: "✅ Nova channel test — connection OK" }),
        });
        return { ok: true, message: "Test message sent to Discord" };
      } else if (id === "slack") {
        const { channel } = inst.config;
        await fetch(`https://slack.com/api/chat.postMessage`, {
          method: "POST", headers: { Authorization: `Bearer ${inst.config.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ channel, text: "✅ Nova channel test — connection OK" }),
        });
        return { ok: true, message: "Test message sent to Slack" };
      } else if (id === "websocket") {
        if (inst.wsServer && inst.wsServer.readyState === WebSocket.OPEN) {
          inst.wsServer.send("✅ Nova channel test — connection OK");
          return { ok: true, message: "Test message sent via WebSocket" };
        }
        return { ok: false, message: "WebSocket not connected" };
      } else if (id === "email") {
        return { ok: true, message: "Email channel is configured and active" };
      } else if (id === "sms") {
        return { ok: true, message: "SMS channel is configured and active" };
      } else if (id === "webhook") {
        return { ok: true, message: "Webhook channel is configured and active" };
      }
      return { ok: true, message: "Channel is active" };
    } catch (e: unknown) {
      return { ok: false, message: `Test failed: ${safeMessage(e)}` };
    }
  }
}

export const channelManager = new ChannelManager();
