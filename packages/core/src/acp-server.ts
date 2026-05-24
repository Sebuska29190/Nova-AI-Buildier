/**
 * ACP (Agent Client Protocol) Server — allows IDEs (VS Code, Zed, JetBrains)
 * to connect to Nova as an AI agent backend.
 *
 * Implements JSON-RPC over HTTP with ACP spec methods.
 * Start with: `bun run packages/core/src/acp-server.ts`
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { runAgent } from "./agent/runner.ts";
import { sessionManager } from "./session/manager.ts";
import { listTools, getTool } from "./plugin/tools.ts";
import { safeMessage } from "./errors.ts";

interface ACPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

interface ACPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: { code: number; message: string };
}

const acp = new Hono();
acp.use("/*", cors());

// Health check
acp.get("/health", (c) => c.json({ status: "ok", server: "Nova ACP", version: "0.1.0" }));

// ACP JSON-RPC endpoint
acp.post("/acp", async (c) => {
  try {
    const body: ACPRequest = await c.req.json();
    const result = await handleACPRequest(body);
    return c.json(result);
  } catch (e: unknown) {
    return c.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: `Parse error: ${safeMessage(e)}` },
    } as ACPResponse, 400);
  }
});

// Also support SSE streaming for chat
acp.post("/acp/stream", async (c) => {
  try {
    const body: ACPRequest = await c.req.json();
    if (body.method === "sampling/createMessage") {
      const { messages, maxTokens, modelPreferences } = body.params || {};
      const modelRef = modelPreferences?.models?.[0]?.model || "deepseek/deepseek-chat";
      const userMsg = messages?.filter((m: any) => m.role === "user").pop()?.content || "";

      const headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      };

      const stream = new ReadableStream({
        async start(ctrl) {
          const enc = new TextEncoder();
          const send = (d: string) => ctrl.enqueue(enc.encode(`data: ${d}\n\n`));

          const session = sessionManager.createSession(modelRef);
          const result = await runAgent({ sessionId: session.id, message: userMsg, modelRef, tools: true });

          send(JSON.stringify({
            type: "response",
            message: { role: "assistant", content: [{ type: "text", text: result.text }] },
            model: modelRef,
          }));
          send("[DONE]");
          ctrl.close();
        },
      });

      return new Response(stream, { headers });
    }
    return c.json({
      jsonrpc: "2.0", id: body.id,
      error: { code: -32601, message: `Method not found: ${body.method}` },
    } as ACPResponse);
  } catch (e: unknown) {
    return c.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: safeMessage(e) } }, 400);
  }
});

async function handleACPRequest(req: ACPRequest): Promise<ACPResponse> {
  const { id, method, params = {} } = req;

  switch (method) {
    case "initialize": {
      return {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: "0.1.0",
          capabilities: {
            sampling: {},
            tools: {},
            resources: {},
          },
          serverInfo: { name: "nova-acp", version: "0.1.0" },
        },
      };
    }

    case "tools/list": {
      const tools = listTools();
      return {
        jsonrpc: "2.0", id,
        result: {
          tools: tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.parameters || { type: "object", properties: {} },
          })),
        },
      };
    }

    case "tools/call": {
      const { name, arguments: args } = params;
      const tool = getTool(name);
      if (!tool) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: `Tool not found: ${name}` } };
      }
      try {
        const result = await tool.execute(args || {}, { sessionId: "" });
        return {
          jsonrpc: "2.0", id,
          result: {
            content: [{ type: "text", text: result }],
            isError: false,
          },
        };
      } catch (e: unknown) {
        return {
          jsonrpc: "2.0", id,
          result: {
            content: [{ type: "text", text: `Error: ${safeMessage(e)}` }],
            isError: true,
          },
        };
      }
    }

    case "sampling/createMessage": {
      const { messages, modelPreferences } = params;
      const modelRef = modelPreferences?.models?.[0]?.model || "deepseek/deepseek-chat";
      const userMsg = messages?.filter((m: any) => m.role === "user").pop()?.content || "";

      const session = sessionManager.createSession(modelRef);
      const result = await runAgent({ sessionId: session.id, message: userMsg, modelRef, tools: true });

      return {
        jsonrpc: "2.0", id,
        result: {
          message: { role: "assistant", content: [{ type: "text", text: result.text }] },
          model: modelRef,
        },
      };
    }

    case "resources/list": {
      return {
        jsonrpc: "2.0", id,
        result: { resources: [] },
      };
    }

    default:
      return {
        jsonrpc: "2.0", id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// Start server if run directly
if (import.meta.main) {
  const port = parseInt(process.env.ACP_PORT || "4124", 10);
  serve({ fetch: acp.fetch, port });
  console.log(`\n  Nova ACP Server running on :${port}`);
  console.log(`  Connect VS Code / Zed / JetBrains to http://localhost:${port}/acp`);
  console.log(`  Health: http://localhost:${port}/health\n`);
}

export { acp as acpApp };
