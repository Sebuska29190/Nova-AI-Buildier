// Discord Channel Plugin — polling-based via Discord REST API
// Zero external dependencies, uses only fetch()

export interface ChannelMessage {
  id: string; channelId: string; userId: string;
  text: string; target: string; replyTo?: string;
}

export interface ChannelBot {
  sendMessage(target: string, text: string): Promise<void>;
  sendThinking(target: string): Promise<void>;
  onMessage(handler: (msg: ChannelMessage) => Promise<void>): void;
}

export interface ChannelPlugin {
  id: string; name: string;
  start(bot: ChannelBot): Promise<void>;
  stop(): Promise<void>;
}

interface DiscordCfg { token: string; channelId: string; }

const API_BASE = "https://discord.com/api/v10";

function api(token: string, method: string, path: string, body?: unknown) {
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  }).then((r) => r.json()).catch(() => null);
}

export function createDiscordPlugin(cfg: DiscordCfg): ChannelPlugin {
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastMessageId = "";
  let msgHandler: ((msg: ChannelMessage) => Promise<void>) | null = null;

  return {
    id: "discord",
    name: "Discord",

    async start(bot: ChannelBot) {
      msgHandler = bot.onMessage.bind(bot);

      // Fetch last message to start from
      const msgs: any = await api(cfg.token, "GET", `/channels/${cfg.channelId}/messages?limit=1`);
      if (Array.isArray(msgs) && msgs.length > 0) lastMessageId = msgs[0].id;

      await bot.sendMessage(cfg.channelId, "🟢 Nova is online!");

      // Poll for new messages every 3 seconds
      pollTimer = setInterval(async () => {
        try {
          const messages: any = await api(cfg.token, "GET", `/channels/${cfg.channelId}/messages?limit=5&after=${lastMessageId}`);
          if (!Array.isArray(messages)) return;
          // Messages come newest-first, reverse to process oldest first
          for (const msg of messages.reverse()) {
            if (!msg.content || msg.author?.bot) continue;
            lastMessageId = msg.id;
            if (msgHandler) {
              await msgHandler({
                id: msg.id,
                channelId: "discord",
                userId: msg.author?.id || "",
                text: msg.content,
                target: cfg.channelId,
              });
            }
          }
        } catch { /* poll error */ }
      }, 3000);
    },

    async stop() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    },
  };
}

export default createDiscordPlugin;
