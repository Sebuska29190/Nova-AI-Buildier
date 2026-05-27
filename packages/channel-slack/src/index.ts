// Slack Channel Plugin — polling-based via REST API (1:1 z CheetahClaws bridges/slack.py)
const API = "https://slack.com/api";

export function createSlackPlugin(token: string, channelId: string) {
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastTs = "";
  let msgHandler: ((msg: any) => Promise<void>) | null = null;

  const call = async (method: string, params?: Record<string, unknown>) => {
    const res = await fetch(`${API}/${method}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: params ? JSON.stringify(params) : undefined,
    }).catch(() => null);
    return res?.json().catch(() => null) || null;
  };

  return {
    id: "slack", name: "Slack",
    async start(bot: any) {
      msgHandler = bot.onMessage.bind(bot);

      const msg: any = await call("conversations.history", { channel: channelId, limit: 1 });
      if (msg?.messages?.[0]) lastTs = msg.messages[0].ts;
      await bot.sendMessage(channelId, "🟢 Nova is online!");

      pollTimer = setInterval(async () => {
        const result: any = await call("conversations.history", { channel: channelId, oldest: lastTs, limit: 5 });
        if (!result?.messages) return;
        for (const msg of result.messages.reverse()) {
          if (msg.bot_id || msg.subtype) continue;
          lastTs = msg.ts;
          if (msgHandler) {
            await msgHandler({
              id: msg.ts,
              channelId: "slack",
              userId: msg.user || "",
              text: msg.text,
              target: channelId,
            });
          }
        }
      }, 3000);
    },
    async stop() { if (pollTimer) clearInterval(pollTimer); },
  };
}

export default createSlackPlugin;
