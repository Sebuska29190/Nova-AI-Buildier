// Ollama provider — local models via Ollama API
const BASE = "http://localhost:11434/v1";

const models = [
  { id: "llama3.2", name: "Llama 3.2", contextWindow: 131072, maxTokens: 8192, cost: { input: 0, output: 0 } },
  { id: "qwen2.5-coder", name: "Qwen 2.5 Coder", contextWindow: 32768, maxTokens: 8192, cost: { input: 0, output: 0 } },
  { id: "deepseek-r1", name: "DeepSeek R1 (local)", contextWindow: 131072, maxTokens: 8192, reasoning: true, cost: { input: 0, output: 0 } },
  { id: "mistral", name: "Mistral", contextWindow: 32768, maxTokens: 8192, cost: { input: 0, output: 0 } },
  { id: "phi4", name: "Phi-4", contextWindow: 16384, maxTokens: 8192, cost: { input: 0, output: 0 } },
];

export const ollamaProvider = {
  id: "ollama",
  name: "Ollama (Local)",
  models,
  auth: { method: "api-key" as const, envVar: "" },
  classifyError: (e: unknown) => {
    const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (m.includes("connect")||m.includes("refused")||m.includes("ECONN")) return "server" as const;
    return "unknown" as const;
  },
  stream: async (p: any) => {
    const body: Record<string, unknown> = { model: p.model, messages: p.messages, stream: true, max_tokens: p.maxTokens ?? 4096 };
    if (p.tools?.length) body.tools = p.tools;

    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: p.signal,
    });
    if (!res.ok) { p.onChunk({ type: "error", message: `Ollama ${res.status}: ${await res.text().catch(() => "")}` }); return; }

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
          if (delta.reasoning_content) p.onChunk({ type: "thinking", text: delta.reasoning_content });
        } catch {}
      }
      buf = buf.split("\n").pop() ?? "";
    }
    p.onChunk({ type: "done" });
  },
};

export default ollamaProvider;
