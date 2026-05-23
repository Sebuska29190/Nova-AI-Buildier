import type { ProviderPlugin, ModelDef, StreamParams, ThinkingProfile } from "@nova/sdk";

const BASE = "https://api.deepseek.com";

const models: ModelDef[] = [
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", contextWindow: 1_000_000, maxTokens: 384_000, reasoning: true, cost: { input: 0.14, output: 0.28 } },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", contextWindow: 1_000_000, maxTokens: 384_000, reasoning: true, cost: { input: 1.74, output: 3.48 } },
  { id: "deepseek-chat", name: "DeepSeek Chat", contextWindow: 131_072, maxTokens: 8_192, cost: { input: 0.28, output: 0.42 } },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner", contextWindow: 131_072, maxTokens: 65_536, reasoning: true, cost: { input: 0.28, output: 0.42 } },
];

const thinking: ThinkingProfile = { levels: ["off", "low", "medium", "high"], defaultLevel: "high" };

const plugin: ProviderPlugin = {
  id: "deepseek", name: "DeepSeek", models, auth: { method: "api-key", envVar: "DEEPSEEK_API_KEY" },
  thinkingProfile: thinking,
  classifyError: (e) => {
    const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (m.includes("401")||m.includes("auth")) return "auth";
    if (m.includes("429")||m.includes("rate")) return "rate";
    if (m.includes("context")||m.includes("length")||m.includes("token")) return "context";
    return "unknown";
  },
  stream: async (p: StreamParams) => {
    const key = process.env.DEEPSEEK_API_KEY ?? "";
    if (!key) { p.onChunk({ type: "error", message: "DEEPSEEK_API_KEY not set" }); return; }

    const body: Record<string, unknown> = {
      model: p.model, messages: p.messages, stream: true, max_tokens: p.maxTokens ?? 4096,
    };
    if (p.thinking && p.thinking !== "off") {
      body.thinking = { type: "enabled" };
      body.reasoning_effort = p.thinking === "high" ? "high" : "medium";
    }
    if (p.tools?.length) body.tools = p.tools;

    const res = await fetch(`${BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body), signal: p.signal,
    });
    if (!res.ok) { p.onChunk({ type: "error", message: `DeepSeek ${res.status}: ${await res.text()}` }); return; }

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
          if (delta.reasoning_content) p.onChunk({ type: "thinking", text: delta.reasoning_content });
          if (delta.content) p.onChunk({ type: "text", text: delta.content });
          if (delta.tool_calls) for (const tc of delta.tool_calls) p.onChunk({ type: "tool_call", id: tc.id, name: tc.function?.name ?? "", args: tc.function?.arguments ?? "" });
        } catch { /* skip parse errors */ }
      }
      buf = buf.split("\n").pop() ?? "";
    }
    p.onChunk({ type: "done" });
  },
};

export default plugin;
export { plugin as deepseekProvider };
