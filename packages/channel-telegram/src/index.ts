// Telegram Channel Plugin — 1:1 port of CheetahClaws bridges/telegram.py
// Zero external dependencies, uses only fetch() to Telegram Bot API

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

interface TelegramCfg { token: string; chatId: string; }

function api(token: string, method: string, params?: Record<string, unknown>) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: params ? JSON.stringify(params) : undefined,
    signal: AbortSignal.timeout(30000),
  }).then((r) => r.json()).catch(() => null);
}

export function createTelegramPlugin(cfg: TelegramCfg): ChannelPlugin {
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let offset = 0;
  let msgHandler: ((msg: ChannelMessage) => Promise<void>) | null = null;

  return {
    id: "telegram",
    name: "Telegram",

    async start(bot: ChannelBot) {
      msgHandler = async (m) => { await bot.onMessage(async (msg) => { if (msgHandler) await msgHandler(msg); }); };

      // Flush old messages to get starting offset
      const flush: any = await api(cfg.token, "getUpdates", { offset: -1, timeout: 0 });
      if (flush?.ok && flush.result?.length) offset = flush.result[flush.result.length - 1].update_id + 1;

      // No startup message — only crypto news as configured

      // Typing indicator loop
      let typingTimer: ReturnType<typeof setInterval> | null = null;
      const startTyping = () => {
        typingTimer = setInterval(() => {
          api(cfg.token, "sendChatAction", { chat_id: Number(cfg.chatId), action: "typing" });
        }, 4000);
      };
      const stopTyping = () => { if (typingTimer) clearInterval(typingTimer); typingTimer = null; };

      // Poll loop — matches CheetahClaws _tg_poll_loop
      pollTimer = setInterval(async () => {
        try {
          const result: any = await api(cfg.token, "getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });
          if (!result?.ok) return;
          for (const update of result.result || []) {
            offset = update.update_id + 1;
            const msg = update.message;
            if (!msg?.text) continue;
            const chatId = String(msg.chat?.id || cfg.chatId);
            startTyping();
            try {
              if (msgHandler) {
                await msgHandler({
                  id: String(msg.message_id),
                  channelId: "telegram",
                  userId: String(msg.from?.id || ""),
                  text: msg.text,
                  target: chatId,
                });
              }
            } finally { stopTyping(); }
          }
        } catch { /* poll error, retry next cycle */ }
      }, 2000);
    },

    async stop() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    },
  };
}

export default createTelegramPlugin;
