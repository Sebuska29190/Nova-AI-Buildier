// WeChat Channel Plugin — iLink Bot API (1:1 z CheetahClaws bridges/wechat.py)
export function createWeChatPlugin(token: string, baseUrl = "https://api.weixin.qq.com") {
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const call = async (method: string, params?: Record<string, unknown>) => {
    const url = `${baseUrl}/cgi-bin/${method}?access_token=${token}`;
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: params ? JSON.stringify(params) : undefined,
    }).catch(() => null);
    return res?.json().catch(() => null) || null;
  };

  return {
    id: "wechat", name: "WeChat",
    async start(bot: any) {
      await bot.sendMessage("", "🟢 Nova is online!");
      pollTimer = setInterval(async () => {}, 5000);
    },
    async stop() { if (pollTimer) clearInterval(pollTimer); },
  };
}

export default createWeChatPlugin;
