import type { ProviderPlugin, ModelDef, StreamParams } from "@nova/sdk";

const BASE = "https://api.x.ai/v1";

const models: ModelDef[] = [
  { id: "grok-3", name: "Grok 3", contextWindow: 131_072, maxTokens: 8_192, cost: { input: 3.0, output: 15.0 } },
  { id: "grok-3-mini", name: "Grok 3 Mini", contextWindow: 131_072, maxTokens: 8_192, cost: { input: 0.3, output: 0.5 } },
  { id: "grok-3-mini-high", name: "Grok 3 Mini High", contextWindow: 131_072, maxTokens: 8_192, reasoning: true, cost: { input: 0.3, output: 0.5 } },
  { id: "grok-2", name: "Grok 2", contextWindow: 131_072, maxTokens: 8_192, cost: { input: 2.0, output: 10.0 } },
];

const plugin: ProviderPlugin = {
  id: "grok", name: "Grok (xAI)", models, auth: { method: "api-key", envVar: "XAI_API_KEY" },
  classifyError: (e: unknown) => {
    const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (m.includes("401")||m.includes("auth")) return "auth";
    if (m.includes("429")||m.includes("rate")) return "rate";
    return "unknown";
  },
  stream: async (p: StreamParams) => {
    const key = process.env.XAI_API_KEY ?? "";
    if (!key) { p.onChunk({ type: "error", message: "XAI_API_KEY not set" }); return; }

    const body: Record<string, unknown> = {
      model: p.model, messages: p.messages, stream: true, max_tokens: p.maxTokens ?? 4096,
    };
    if (p.tools?.length) body.tools = p.tools;

    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body), signal: p.signal,
    });
    if (!res.ok) { p.onChunk({ type: "error", message: `Grok ${res.status}: ${await res.text()}` }); return; }

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
export { plugin as grokProvider };
