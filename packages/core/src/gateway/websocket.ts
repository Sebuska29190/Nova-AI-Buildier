import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { onEvent } from "../event-bus/index.ts";
import { runAgent } from "../agent/runner.ts";
import { sessionManager } from "../session/manager.ts";
import { safeMessage } from "../errors.ts";

interface WsClient {
  id: string; send: (data: string) => void; close: () => void;
}

const clients = new Map<string, WsClient>();
const abortControllers = new Map<string, AbortController>();
const clientRunIds = new Map<string, Set<string>>(); // clientId → Set<runId>

export function setupWebSocket(server: Server): void {
  try {
    const { WebSocketServer } = require("ws");
    const wss = new WebSocketServer({ noServer: true });

    // Intercept upgrade events — handle /ws ourselves to avoid ws library abortHandshake bug
    server.on("upgrade", (req: any, socket: any, head: any) => {
      const url = req.url || "";
      if (url === "/ws" || url.startsWith("/ws?")) {
        wss.handleUpgrade(req, socket, head, (ws: any) => {
          wss.emit("connection", ws, req);
        });
      }
    });

    wss.on("connection", (ws: any) => {
      const clientId = randomUUID();
      const client: WsClient = { id: clientId, send: ws.send.bind(ws), close: ws.close.bind(ws) };
      clients.set(clientId, client);
      ws.send(JSON.stringify({ type: "connected", clientId }));

      ws.on("message", async (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(raw.toString());
          await handleMessage(client, msg);
        } catch (e: unknown) {
          ws.send(JSON.stringify({ type: "error", message: safeMessage(e) }));
        }
      });

      ws.on("close", () => {
        clients.delete(clientId);
        const runIds = clientRunIds.get(clientId);
        if (runIds) {
          for (const runId of runIds) {
            const ac = abortControllers.get(runId);
            if (ac) { ac.abort(); abortControllers.delete(runId); }
          }
          clientRunIds.delete(clientId);
        }
      });
    });
  } catch {}
}

async function handleMessage(client: WsClient, msg: any): Promise<void> {
  switch (msg.type) {
    case "chat.send":
      return handleChatSend(client, msg);
    case "chat.abort":
      return handleChatAbort(client, msg);
    case "ping":
      client.send(JSON.stringify({ type: "pong" }));
      return;
  }
}

async function handleChatSend(client: WsClient, msg: any): Promise<void> {
  const runId = msg.runId || randomUUID();
  const ac = new AbortController();
  abortControllers.set(runId, ac);
  // Track runId → clientId mapping
  if (!clientRunIds.has(client.id)) clientRunIds.set(client.id, new Set());
  clientRunIds.get(client.id)!.add(runId);
  let sessionId = msg.sessionId;

  // Create session if not provided
  if (!sessionId) {
    const session = sessionManager.createSession(msg.model || "deepseek/deepseek-chat");
    sessionId = session.id;
    // Send session created event so the UI knows the new session ID
    client.send(JSON.stringify({ type: "session_created", runId, sessionId }));
  }

  const unsubAssistant = onEvent("event", (e: any) => {
    if (e.kind === "assistant" && e.runId === runId) client.send(JSON.stringify({ type: "assistant", runId, text: e.data?.text || "" }));
  });
  const unsubThinking = onEvent("event", (e: any) => {
    if (e.kind === "thinking" && e.runId === runId) client.send(JSON.stringify({ type: "thinking", runId, text: e.data?.text || "" }));
  });
  const unsubTool = onEvent("event", (e: any) => {
    if (e.kind === "tool_call" && e.runId === runId) client.send(JSON.stringify({ type: "tool_call", runId, toolCallId: e.data?.toolCallId, toolName: e.data?.toolName, args: e.data?.args }));
  });
  const unsubDone = onEvent("done", (e: any) => {
    if (e.runId === runId) client.send(JSON.stringify({ type: "done", runId }));
  });
  const unsubJobDone = onEvent("job_done", (e: any) => {
    client.send(JSON.stringify({ type: "job_done", agentId: e.agentId, runId: e.runId, status: e.status, text: e.text, error: e.error }));
  });

  try {
    const result = await runAgent({
      sessionId,
      message: msg.message,
      modelRef: msg.model || "deepseek/deepseek-chat",
      thinkingLevel: msg.thinkingLevel,
      signal: ac.signal,
      runId,
    });
    client.send(JSON.stringify({ type: "result", runId, sessionId: result.sessionId, text: result.text }));
  } catch (e: unknown) {
    client.send(JSON.stringify({ type: "error", runId, error: safeMessage(e) }));
  } finally {
    unsubAssistant(); unsubThinking(); unsubTool(); unsubDone();
    abortControllers.delete(runId);
    clientRunIds.get(client.id)?.delete(runId);
  }
}

function handleChatAbort(client: WsClient, msg: any): void {
  const ac = abortControllers.get(msg.runId);
  if (ac) { ac.abort(); abortControllers.delete(msg.runId); }
}
