import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { registry } from "../../plugin/registry.ts";
import { sessionManager } from "../../session/manager.ts";
import { agentStore } from "../../agent/store.ts";
import { runAgent } from "../../agent/runner.ts";
import { onEvent } from "../../event-bus/index.ts";
import { workspaceManager } from "../../workspace/manager.ts";

export function register(app: Hono): void {
  // Chat completions (OpenAI-compat)
  app.post("/v1/chat/completions", async (c) => {
    const body = await c.req.json<{ model: string; messages: Array<{ role: string; content: string }>; stream?: boolean; tools?: unknown[]; }>();

    const resolved = registry.resolveModel(body.model);
    if (!resolved) return c.json({ error: { message: `Model ${body.model} not found` } }, 400);

    const sessionKey = c.req.header("x-nova-session-key");
    let session = sessionKey ? sessionManager.getSession(sessionKey) : undefined;
    if (!session) session = sessionManager.createSession(body.model);
    const lastMsg = body.messages.filter((m) => m.role === "user").pop();
    if (lastMsg) sessionManager.append(session.id, "user", lastMsg.content);

    if (body.stream !== false) {
      const headers = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "x-nova-session-id": session.id };
      const s = new ReadableStream({
        async start(ctrl) {
          const enc = new TextEncoder();
          const sendSSE = (d: string) => ctrl.enqueue(enc.encode(`data: ${d}\n\n`));
          const runId = `run_${Date.now()}`;

          // Premium: Forward ALL event types for real-time visibility
          const unsubAssistant = onEvent("event", (e: any) => {
            // Forward events for this session (match by sessionId)
            if (e.sessionId !== session.id) return;

            if (e.kind === "assistant" && e.data?.text) {
              sendSSE(JSON.stringify({ type: "text", content: e.data.text }));
            }
            else if (e.kind === "thinking" && e.data?.text) {
              sendSSE(JSON.stringify({ type: "thinking", content: e.data.text }));
            }
            else if (e.kind === "tool_call" && e.data) {
              const toolName = e.data.name || e.data.toolName || "";
              // Only forward tool_call events that have a real tool name (skip empty/partial deltas)
              if (toolName && toolName.length > 2 && toolName !== "unknown") {
                sendSSE(JSON.stringify({ type: "tool_call", tool: toolName, args: e.data.arguments || e.data.args }));
              }
            }
            else if (e.kind === "tool_result" && e.data) {
              const resultToolName = e.data.toolName || e.data.name || "";
              // Only forward tool_result events that have a real tool name
              if (resultToolName && resultToolName.length > 2 && resultToolName !== "unknown") {
                sendSSE(JSON.stringify({ type: "tool_result", tool: resultToolName, success: e.data.success !== false, duration: e.data.durationMs }));
              }
            }
          });

          try {
            const result = await runAgent({ sessionId: session.id, message: lastMsg?.content ?? "", modelRef: body.model, tools: true, runId });
            sendSSE(JSON.stringify({ type: "done", text: result.text }));
            sendSSE("[DONE]");
          } catch (e: unknown) {
            sendSSE(JSON.stringify({ type: "error", message: safeMessage(e) }));
            sendSSE("[DONE]");
          } finally {
            unsubAssistant();
            ctrl.close();
          }
        },
      });
      return new Response(s, { headers });
    }

    const result = await runAgent({ sessionId: session.id, message: lastMsg?.content ?? "", modelRef: body.model, tools: true });
    c.header("x-nova-session-id", session.id);
    return c.json({ id: `chatcmpl-${session.id}`, model: body.model, choices: [{ index: 0, message: { role: "assistant", content: result.text }, finish_reason: "stop" }] });
  });

  // Agent API — supports agentId to use agent's model+prompt
  app.post("/api/agent/send", async (c) => {
    const body = await c.req.json<{ message: string; model?: string; sessionId?: string; thinkingLevel?: string; systemPrompt?: string; agentId?: string; workspace?: string; }>();
    let sessionId = body.sessionId;
    let modelRef = body.model;
    let sysPrompt = body.systemPrompt;

    // If agentId is provided, resolve agent's model and system prompt
    if (body.agentId) {
      const agent = agentStore.get(body.agentId);
      if (!agent) return c.json({ error: `Agent '${body.agentId}' not found` }, 404);
      modelRef = agent.modelRef;
      sysPrompt = agent.systemPrompt;
      // Mark agent as active
      agentStore.update(body.agentId, { status: "active" as any });
    }

    if (!sessionId) {
      const s = sessionManager.createSession(modelRef ?? "deepseek/deepseek-chat", { systemPrompt: sysPrompt });
      sessionId = s.id;
    }
    // Set workspace if provided
    if (body.workspace) {
      const { workspaceManager } = await import("../../workspace/manager.ts");
      workspaceManager.setRoot(body.workspace);
    }
    const result = await runAgent({ sessionId, message: body.message, modelRef: modelRef ?? "deepseek/deepseek-chat", thinkingLevel: body.thinkingLevel, systemPrompt: sysPrompt, tools: true, agentId: body.agentId });

    // Reset agent status after response
    if (body.agentId) agentStore.update(body.agentId, { status: "ready" as any });

    return c.json(result);
  });
}
