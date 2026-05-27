/**
 * OpenAI-compatible Proxy — exposes Nova's providers as an OpenAI API endpoint.
 * Other tools (Codex CLI, Aider, Cline, Continue) can hit this instead of api.openai.com.
 *
 * Start with: `bun run packages/core/src/proxy-server.ts`
 * Usage: Set OPENAI_API_KEY=http://localhost:4125/v1 in your tool
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { registry } from "./plugin/registry.ts";
import { runAgent } from "./agent/runner.ts";
import { sessionManager } from "./session/manager.ts";
import { onEvent } from "./event-bus/index.ts";
import { safeMessage } from "./errors.ts";

const proxy = new Hono();
proxy.use("/*", cors());

// Model list — returns Nova's models in OpenAI format
proxy.get("/v1/models", (c) => {
  const models = registry.listModels();
  return c.json({
    object: "list",
    data: models.map(m => ({
      id: m.ref,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: m.providerId || "nova",
      permission: [],
    })),
  });
});

// Chat completions — OpenAI-compatible
proxy.post("/v1/chat/completions", async (c) => {
  try {
    const body = await c.req.json<{
      model: string;
      messages: Array<{ role: string; content: string }>;
      stream?: boolean;
      max_tokens?: number;
      temperature?: number;
    }>();

    const resolved = registry.resolveModel(body.model);
    if (!resolved) {
      return c.json({ error: { message: `Model ${body.model} not found`, type: "invalid_request_error" } }, 400);
    }

    const lastMsg = body.messages.filter(m => m.role === "user").pop();
    if (!lastMsg) {
      return c.json({ error: { message: "No user message found", type: "invalid_request_error" } }, 400);
    }

    // Map from Nova auth to provider format if custom auth header is used
    const authHeader = c.req.header("Authorization") || "";
    const apiKey = authHeader.replace("Bearer ", "");

    const session = sessionManager.createSession(body.model);

    if (body.stream) {
      const headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      };

      const stream = new ReadableStream({
        async start(ctrl) {
          const enc = new TextEncoder();
          const send = (d: string) => ctrl.enqueue(enc.encode(`data: ${d}\n\n`));
          const runId = `proxy_${Date.now()}`;

          const unsub = onEvent("event", (e: any) => {
            if (e.kind === "assistant" && e.runId === runId && e.data?.text) {
              send(JSON.stringify({
                id: `chatcmpl-${session.id}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: body.model,
                choices: [{ index: 0, delta: { content: e.data.text }, finish_reason: null }],
              }));
            }
          });

          try {
            const result = await runAgent({
              sessionId: session.id,
              message: lastMsg.content,
              modelRef: body.model,
              tools: true,
              runId,
            });
            send(JSON.stringify({
              id: `chatcmpl-${session.id}`, object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000), model: body.model,
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            }));
            send("[DONE]");
          } catch (e: unknown) {
            send(JSON.stringify({ error: { message: safeMessage(e) } }));
          } finally {
            unsub();
            ctrl.close();
          }
        },
      });

      return new Response(stream, { headers });
    }

    // Non-streaming
    const result = await runAgent({
      sessionId: session.id,
      message: lastMsg.content,
      modelRef: body.model,
      tools: true,
    });

    return c.json({
      id: `chatcmpl-${session.id}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices: [{
        index: 0,
        message: { role: "assistant", content: result.text },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: result.usage?.input || 0, completion_tokens: result.usage?.output || 0, total_tokens: (result.usage?.input || 0) + (result.usage?.output || 0) },
    });
  } catch (e: unknown) {
    return c.json({ error: { message: safeMessage(e), type: "server_error" } }, 500);
  }
});

// Health check
proxy.get("/health", (c) => c.json({ status: "ok", server: "Nova Proxy", version: "0.1.0" }));

// Start server if run directly
if (import.meta.main) {
  const port = parseInt(process.env.PROXY_PORT || "4125", 10);
  serve({ fetch: proxy.fetch, port });
  console.log(`\n  Nova OpenAI Proxy running on :${port}`);
  console.log(`  Configure your tools:`);
  console.log(`    OPENAI_API_KEY=http://localhost:${port}/v1`);
  console.log(`    OPENAI_BASE_URL=http://localhost:${port}/v1`);
  console.log(`  Models: http://localhost:${port}/v1/models\n`);
}

export { proxy as proxyApp };
