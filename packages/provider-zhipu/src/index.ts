import type { ProviderPlugin, ModelDef, StreamParams } from "@nova/sdk";

const BASE = "https://open.bigmodel.cn/api/paas/v4";

const models: ModelDef[] = [
  { id: "glm-4-plus", name: "GLM-4 Plus", contextWindow: 128_000, maxTokens: 4_096, cost: { input: 0.5, output: 0.5 } },
  { id: "glm-4", name: "GLM-4", contextWindow: 128_000, maxTokens: 4_096, cost: { input: 0.1, output: 0.1 } },
  { id: "glm-4-flash", name: "GLM-4 Flash", contextWindow: 128_000, maxTokens: 4_096, cost: { input: 0.0, output: 0.0 } },
  { id: "glm-4-air", name: "GLM-4 Air", contextWindow: 128_000, maxTokens: 4_096, cost: { input: 0.001, output: 0.001 } },
  { id: "glm-z1-flash", name: "GLM-Z1 Flash", contextWindow: 128_000, maxTokens: 4_096, reasoning: true, cost: { input: 0.0, output: 0.0 } },
];

const plugin: ProviderPlugin = {
  id: "zhipu", name: "Zhipu GLM", models, auth: { method: "api-key", envVar: "ZHIPU_API_KEY" },
  classifyError: (e) => {
    const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (m.includes("401")||m.includes("auth")) return "auth";
    if (m.includes("429")||m.includes("rate")) return "rate";
    return "unknown";
  },
  stream: async (p: StreamParams) => {
    const key = process.env.ZHIPU_API_KEY ?? "";
    if (!key) { p.onChunk({ type: "error", message: "ZHIPU_API_KEY not set" }); return; }

    const body: Record<string, unknown> = {
      model: p.model, messages: p.messages, stream: true, max_tokens: p.maxTokens ?? 4096,
    };
    if (p.tools?.length) body.tools = p.tools;

    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body), signal: p.signal,
    });
    if (!res.ok) { p.onChunk({ type: "error", message: `Zhipu ${res.status}: ${await res.text()}` }); return; }

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
export { plugin as zhipuProvider };
