const BASE = import.meta.env.VITE_NOVA_API_URL || "http://localhost:4123";

async function get(path: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, { signal: controller.signal });
    if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function post(path: string, body?: unknown, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`POST ${path} ${res.status}: ${await res.text().catch(() => "")}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => get("/healthz"),
  models: () => get("/v1/models").then((r) => r.data || []),
  sessions: () => get("/api/sessions").then((r) => r.sessions || []),
  sessionDetail: (id: string) => get(`/api/sessions/${id}`),
  tools: () => get("/api/tools").then((r) => r.tools || []),
  agents: () => get("/api/agents").then((r) => r.agents || []),
  channels: () => get("/api/channels").then((r) => r.channels || []),
  memories: () => get("/api/memory").then((r) => r.memories || []),
  skills: () => get("/api/skills").then((r) => r.skills || []),
  agentSend: (message: string, model?: string, agentId?: string) =>
    post("/api/agent/send", { message, model, agentId }),

  // SSE streaming chat with session persistence
  chatSend: async (message: string, model: string, sessionKey?: string, onChunk?: (text: string) => void, signal?: AbortSignal, onEvent?: (event: any) => void): Promise<{ text: string; sessionKey: string }> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (sessionKey) headers["x-nova-session-key"] = sessionKey;

    const res = await fetch(BASE + "/v1/chat/completions", {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: message }],
        stream: true,
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);

    const newSessionKey = res.headers.get("x-nova-session-id") || sessionKey || "";
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No body");

    const decoder = new TextDecoder();
    let buf = "", fullText = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith("data: ") && t !== "data: [DONE]") {
          try {
            const j = JSON.parse(t.slice(6));
            // Premium: Handle all event types
            if (j.type === "text" && j.content) {
              fullText += j.content;
              onChunk?.(fullText);
            } else if (j.type === "thinking" && j.content) {
              onEvent?.({ type: "thinking", content: j.content });
            } else if (j.type === "tool_call") {
              onEvent?.({ type: "tool_call", tool: j.tool, args: j.args });
            } else if (j.type === "tool_result") {
              onEvent?.({ type: "tool_result", tool: j.tool, success: j.success, duration: j.duration });
            } else if (j.type === "done" && j.text) {
              fullText = j.text;
              onEvent?.({ type: "done", text: j.text });
            } else if (j.type === "error") {
              onEvent?.({ type: "error", message: j.message });
            }
            // Legacy format fallback
            else if (j.choices?.[0]?.delta?.content) {
              fullText += j.choices[0].delta.content;
              onChunk?.(fullText);
            }
          } catch { /* skip parse errors */ }
        }
      }
    }
    return { text: fullText, sessionKey: newSessionKey };
  },
};
