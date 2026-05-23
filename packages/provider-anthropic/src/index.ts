// Anthropic provider — native Messages API with streaming + thinking blocks
const BASE = "https://api.anthropic.com/v1";

const models = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", contextWindow: 200000, maxTokens: 64000, cost: { input: 3.0, output: 15.0 } },
  { id: "claude-haiku-4-20250514", name: "Claude Haiku 4", contextWindow: 200000, maxTokens: 64000, cost: { input: 0.8, output: 4.0 } },
  { id: "claude-opus-4-20250514", name: "Claude Opus 4", contextWindow: 200000, maxTokens: 64000, cost: { input: 15.0, output: 75.0 } },
];

function getApiKey(): string { return process.env.ANTHROPIC_API_KEY ?? ""; }

export const anthropicProvider = {
  id: "anthropic",
  name: "Anthropic",
  models,
  auth: { method: "api-key" as const, envVar: "ANTHROPIC_API_KEY" },
  thinkingProfile: { levels: ["off", "low", "medium", "high"], defaultLevel: "high" },
  classifyError: (e: unknown) => {
    const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (m.includes("401")||m.includes("auth")) return "auth" as const;
    if (m.includes("429")||m.includes("rate")) return "rate" as const;
    if (m.includes("context")||m.includes("length")||m.includes("too many tokens")) return "context" as const;
    if (m.includes("timeout")) return "timeout" as const;
    if (m.includes("529")||m.includes("overloaded")) return "server" as const;
    return "unknown" as const;
  },
  stream: async (p: any) => {
    const key = getApiKey();
    if (!key) { p.onChunk({ type: "error", message: "ANTHROPIC_API_KEY not set" }); return; }

    const messages = p.messages.filter((m: any) => m.role !== "system");
    const systemMsg = p.messages.find((m: any) => m.role === "system");

    const body: Record<string, unknown> = { model: p.model, messages, max_tokens: p.maxTokens ?? 4096, stream: true };
    if (systemMsg) body.system = [{ type: "text", text: systemMsg.content }];
    if (p.tools?.length) body.tools = p.tools;

    const res = await fetch(`${BASE}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2025-01-25" },
      body: JSON.stringify(body), signal: p.signal,
    });
    if (!res.ok) { p.onChunk({ type: "error", message: `Anthropic ${res.status}: ${await res.text().catch(() => "")}` }); return; }

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
          if (j.type === "content_block_delta" && j.delta?.text) { p.onChunk({ type: "text", text: j.delta.text }); }
          if (j.type === "content_block_start" && j.content_block?.type === "tool_use") { p.onChunk({ type: "tool_call", id: j.content_block.id, name: j.content_block.name, args: "" }); }
          if (j.type === "content_block_delta" && j.delta?.type === "input_json_delta") { p.onChunk({ type: "tool_call", id: "", name: "", args: j.delta.partial_json ?? "" }); }
          if (j.type === "message_stop") { p.onChunk({ type: "done" }); }
        } catch {}
      }
      buf = buf.split("\n").pop() ?? "";
    }
    p.onChunk({ type: "done" });
  },
};

export default anthropicProvider;
