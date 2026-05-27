import type { ProviderPlugin, ModelDef, StreamParams } from "@nova/sdk";

const modelId = process.env.CUSTOM_MODEL_NAME ?? "mimo-v2.5";

const models: ModelDef[] = [
  { id: modelId, name: `Custom (${modelId})`, contextWindow: 128_000, maxTokens: 16_384, cost: { input: 0, output: 0 } },
];

const plugin: ProviderPlugin = {
  id: "custom", name: "Custom (OpenAI-compatible)", models, auth: { method: "api-key", envVar: "CUSTOM_API_KEY" },
  classifyError: (e) => {
    const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (m.includes("401")||m.includes("auth")) return "auth";
    if (m.includes("429")||m.includes("rate")) return "rate";
    if (m.includes("refused")||m.includes("econn")) return "timeout";
    return "unknown";
  },
  stream: async (p: StreamParams) => {
    const base = process.env.CUSTOM_BASE_URL ?? "";
    if (!base) { p.onChunk({ type: "error", message: "CUSTOM_BASE_URL not set. Set env var to your OpenAI-compatible endpoint." }); return; }
    const key = process.env.CUSTOM_API_KEY ?? "";

    const body: Record<string, unknown> = {
      model: modelId, messages: p.messages, stream: true, max_tokens: p.maxTokens ?? 4096,
    };
    if (p.tools?.length) body.tools = p.tools;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (key) headers["Authorization"] = `Bearer ${key}`;

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST", headers, body: JSON.stringify(body), signal: p.signal,
    });
    if (!res.ok) { p.onChunk({ type: "error", message: `Custom ${res.status}: ${await res.text()}` }); return; }

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
export { plugin as customProvider };
