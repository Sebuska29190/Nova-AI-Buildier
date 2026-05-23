import type { ProviderPlugin, ModelDef, StreamParams } from "@nova/sdk";

const BASE = "https://api.moonshot.cn/v1";

const models: ModelDef[] = [
  { id: "moonshot-v1-8k", name: "Moonshot V1 8K", contextWindow: 8_000, maxTokens: 4_096, cost: { input: 0.012, output: 0.012 } },
  { id: "moonshot-v1-32k", name: "Moonshot V1 32K", contextWindow: 32_000, maxTokens: 4_096, cost: { input: 0.024, output: 0.024 } },
  { id: "moonshot-v1-128k", name: "Moonshot V1 128K", contextWindow: 128_000, maxTokens: 4_096, cost: { input: 0.06, output: 0.06 } },
  { id: "kimi-latest", name: "Kimi Latest", contextWindow: 128_000, maxTokens: 8_192, cost: { input: 0.06, output: 0.06 } },
];

const plugin: ProviderPlugin = {
  id: "kimi", name: "Kimi (Moonshot)", models, auth: { method: "api-key", envVar: "MOONSHOT_API_KEY" },
  classifyError: (e) => {
    const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (m.includes("401")||m.includes("auth")) return "auth";
    if (m.includes("429")||m.includes("rate")) return "rate";
    return "unknown";
  },
  stream: async (p: StreamParams) => {
    const key = process.env.MOONSHOT_API_KEY ?? "";
    if (!key) { p.onChunk({ type: "error", message: "MOONSHOT_API_KEY not set" }); return; }

    const body: Record<string, unknown> = {
      model: p.model, messages: p.messages, stream: true, max_tokens: p.maxTokens ?? 4096,
    };
    if (p.tools?.length) body.tools = p.tools;

    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body), signal: p.signal,
    });
    if (!res.ok) { p.onChunk({ type: "error", message: `Kimi ${res.status}: ${await res.text()}` }); return; }

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      for (const line of buf.split("\n").slice(0, -1)) {
        const t = line.trim();
        if (!t.startsWith("data: ")) continue;
        const d = t.slice(6);
        if (d === "[DONE]") continue;
        try {
          const j = JSON.parse(d);
          const delta = j.choices?.[0]?.delta;
          if (!delta) { if (j.usage) p.onChunk({ type: "usage", input: j.usage.prompt_tokens ?? 0, output: j.usage.completion_tokens ?? 0 }); continue; }
          if (delta.content) p.onChunk({ type: "text", text: delta.content });
          if (delta.tool_calls) for (const tc of delta.tool_calls) p.onChunk({ type: "tool_call", id: tc.id, name: tc.function?.name ?? "", args: tc.function?.arguments ?? "" });
        } catch { /* skip */ }
      }
      buf = buf.split("\n").pop() ?? "";
    }
    p.onChunk({ type: "done" });
  },
};

export default plugin;
export { plugin as kimiProvider };
