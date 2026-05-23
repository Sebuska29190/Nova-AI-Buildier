// Gemini provider — native API via OpenAI-compatible endpoint
const BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

const models = [
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 1048576, maxTokens: 65536, cost: { input: 1.25, output: 10.0 } },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1048576, maxTokens: 8192, cost: { input: 0.10, output: 0.40 } },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", contextWindow: 2097152, maxTokens: 8192, cost: { input: 1.25, output: 5.0 } },
];

function getApiKey(): string { return process.env.GEMINI_API_KEY ?? ""; }

export const geminiProvider = {
  id: "gemini",
  name: "Gemini",
  models,
  auth: { method: "api-key" as const, envVar: "GEMINI_API_KEY" },
  classifyError: (e: unknown) => {
    const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (m.includes("401")||m.includes("auth")||m.includes("api key")) return "auth" as const;
    if (m.includes("429")||m.includes("rate")) return "rate" as const;
    if (m.includes("context")||m.includes("length")||m.includes("token")) return "context" as const;
    return "unknown" as const;
  },
  stream: async (p: any) => {
    const key = getApiKey();
    if (!key) { p.onChunk({ type: "error", message: "GEMINI_API_KEY not set" }); return; }

    const body: Record<string, unknown> = { model: p.model, messages: p.messages, stream: true, max_tokens: p.maxTokens ?? 4096 };
    if (p.tools?.length) body.tools = p.tools;

    const res = await fetch(`${BASE}/chat/completions?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: p.signal,
    });
    if (!res.ok) { p.onChunk({ type: "error", message: `Gemini ${res.status}: ${await res.text().catch(() => "")}` }); return; }

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
          if (!delta) continue;
          if (delta.content) p.onChunk({ type: "text", text: delta.content });
        } catch {}
      }
      buf = buf.split("\n").pop() ?? "";
    }
    p.onChunk({ type: "done" });
  },
};

export default geminiProvider;
