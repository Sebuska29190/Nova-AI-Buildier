import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { onEvent } from "../event-bus/index.ts";
import { runAgent } from "../agent/runner.ts";
import { sessionManager } from "../session/manager.ts";
import { agentStore } from "../agent/store.ts";
import { safeMessage } from "../errors.ts";

interface WsClient {
  id: string; send: (data: string) => void; close: () => void;
}

interface AgentConnection {
  clientId: string;
  sessionId: string;
  agentId: string;
  status: "idle" | "working" | "waiting";
  lastActivity: Date;
  runId?: string;
}

const clients = new Map<string, WsClient>();
const abortControllers = new Map<string, AbortController>();
const clientRunIds = new Map<string, Set<string>>(); // clientId → Set<runId>
const agentConnections = new Map<string, AgentConnection>(); // sessionId → AgentConnection
const backgroundTasks = new Map<string, { runId: string; sessionId: string; agentId: string; startedAt: Date }>(); // runId → task info

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
        // Abort all active runs for this client
        const runIds = clientRunIds.get(clientId);
        if (runIds) {
          for (const runId of runIds) {
            const ac = abortControllers.get(runId);
            if (ac) { ac.abort(); abortControllers.delete(runId); }
            backgroundTasks.delete(runId);
          }
          clientRunIds.delete(clientId);
        }
        // Remove agent connections for this client
        for (const [sid, conn] of agentConnections) {
          if (conn.clientId === clientId) agentConnections.delete(sid);
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
    case "agent.status":
      return handleAgentStatus(client, msg);
    case "session.resume":
      return handleSessionResume(client, msg);
    case "agent.background":
      return handleBackgroundTask(client, msg);
    case "agent.background.status":
      return handleBackgroundStatus(client, msg);
    case "ping":
      client.send(JSON.stringify({ type: "pong" }));
      return;
  }
}

// ─── Chat Send (existing, enhanced with agent connection tracking) ─────

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

  // Track agent connection
  const agentId = msg.agentId || "default";
  agentConnections.set(sessionId, {
    clientId: client.id,
    sessionId,
    agentId,
    status: "working",
    lastActivity: new Date(),
    runId,
  });

  // Broadcast agent status update
  broadcastAgentStatus(client, sessionId, "working");

  const unsubAssistant = onEvent("event", (e: any) => {
    if (e.kind === "assistant" && e.runId === runId) client.send(JSON.stringify({ type: "assistant", runId, text: e.data?.text || "" }));
  });
  const unsubThinking = onEvent("event", (e: any) => {
    if (e.kind === "thinking" && e.runId === runId) client.send(JSON.stringify({ type: "thinking", runId, text: e.data?.text || "" }));
  });
  const unsubTool = onEvent("event", (e: any) => {
    if (e.kind === "tool_call" && e.runId === runId) client.send(JSON.stringify({ type: "tool_call", runId, toolCallId: e.data?.toolCallId, toolName: e.data?.toolName, args: e.data?.args }));
  });
  const unsubToolResult = onEvent("event", (e: any) => {
    if (e.kind === "tool_result" && e.runId === runId) {
      client.send(JSON.stringify({ type: "tool_result", runId, toolName: e.data?.toolName, success: e.data?.success, duration: e.data?.durationMs }));
    }
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
      agentId: msg.agentId,
      signal: ac.signal,
      runId,
    });
    client.send(JSON.stringify({ type: "result", runId, sessionId: result.sessionId, text: result.text }));

    // Update agent connection status
    const conn = agentConnections.get(sessionId);
    if (conn) {
      conn.status = "idle";
      conn.lastActivity = new Date();
      broadcastAgentStatus(client, sessionId, "idle");
    }
  } catch (e: unknown) {
    client.send(JSON.stringify({ type: "error", runId, error: safeMessage(e) }));
    const conn = agentConnections.get(sessionId);
    if (conn) {
      conn.status = "idle";
      broadcastAgentStatus(client, sessionId, "idle");
    }
  } finally {
    unsubAssistant(); unsubThinking(); unsubTool(); unsubToolResult(); unsubDone(); unsubJobDone();
    abortControllers.delete(runId);
    clientRunIds.get(client.id)?.delete(runId);
  }
}

// ─── Agent Status ─────────────────────────────────────────────────────

function handleAgentStatus(client: WsClient, msg: any): void {
  const sessionId = msg.sessionId;
  const conn = sessionId ? agentConnections.get(sessionId) : null;
  client.send(JSON.stringify({
    type: "agent.status",
    sessionId,
    status: conn?.status || "idle",
    agentId: conn?.agentId || null,
    lastActivity: conn?.lastActivity?.toISOString() || null,
  }));
}

function broadcastAgentStatus(client: WsClient, sessionId: string, status: string): void {
  const conn = agentConnections.get(sessionId);
  client.send(JSON.stringify({
    type: "agent.status",
    sessionId,
    agentId: conn?.agentId || null,
    status,
    lastActivity: new Date().toISOString(),
  }));
}

// ─── Session Resume ───────────────────────────────────────────────────

function handleSessionResume(client: WsClient, msg: any): void {
  const sessionId = msg.sessionId;
  if (!sessionId) {
    client.send(JSON.stringify({ type: "error", message: "sessionId required" }));
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    client.send(JSON.stringify({ type: "error", message: `Session ${sessionId} not found` }));
    return;
  }

  const transcript = sessionManager.getTranscript(sessionId);
  const toolActivity = sessionManager.getToolActivity(sessionId, 20);

  client.send(JSON.stringify({
    type: "session.resumed",
    sessionId,
    session: {
      id: session.id,
      modelRef: session.modelRef,
      agentId: session.agentId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    messages: transcript.map(t => ({ role: t.role, content: t.content, createdAt: t.createdAt })),
    toolActivity,
  }));
}

// ─── Background Tasks ─────────────────────────────────────────────────

async function handleBackgroundTask(client: WsClient, msg: any): Promise<void> {
  const runId = msg.runId || randomUUID();
  const ac = new AbortController();
  abortControllers.set(runId, ac);

  // Track runId → clientId
  if (!clientRunIds.has(client.id)) clientRunIds.set(client.id, new Set());
  clientRunIds.get(client.id)!.add(runId);

  // Create session for background task
  const agentId = msg.agentId || "default";
  const agent = agentStore.get(agentId);
  const modelRef = agent?.modelRef || msg.model || "deepseek/deepseek-chat";
  const session = sessionManager.createSession(modelRef, { agentId });
  const sessionId = session.id;

  // Track as background task
  backgroundTasks.set(runId, { runId, sessionId, agentId, startedAt: new Date() });

  // Notify: started
  client.send(JSON.stringify({ type: "background.started", runId, sessionId, agentId }));

  // Subscribe to events for this background run
  const unsubAssistant = onEvent("event", (e: any) => {
    if (e.kind === "assistant" && e.runId === runId) {
      client.send(JSON.stringify({ type: "background.assistant", runId, sessionId, text: e.data?.text || "" }));
    }
  });
  const unsubTool = onEvent("event", (e: any) => {
    if (e.kind === "tool_call" && e.runId === runId) {
      client.send(JSON.stringify({ type: "background.tool_call", runId, sessionId, toolName: e.data?.toolName, args: e.data?.args }));
    }
  });
  const unsubToolResult = onEvent("event", (e: any) => {
    if (e.kind === "tool_result" && e.runId === runId) {
      client.send(JSON.stringify({ type: "background.tool_result", runId, sessionId, toolName: e.data?.toolName, success: e.data?.success, duration: e.data?.durationMs }));
    }
  });
  const unsubDone = onEvent("done", (e: any) => {
    if (e.runId === runId) client.send(JSON.stringify({ type: "background.done", runId, sessionId }));
  });

  try {
    const result = await runAgent({
      sessionId,
      message: msg.message,
      modelRef,
      agentId: msg.agentId,
      thinkingLevel: msg.thinkingLevel,
      signal: ac.signal,
      runId,
    });

    client.send(JSON.stringify({
      type: "background.completed",
      runId,
      sessionId,
      agentId,
      text: result.text,
      usage: result.usage,
    }));
  } catch (e: unknown) {
    client.send(JSON.stringify({
      type: "background.error",
      runId,
      sessionId,
      agentId,
      error: safeMessage(e),
    }));
  } finally {
    unsubAssistant(); unsubTool(); unsubToolResult(); unsubDone();
    abortControllers.delete(runId);
    clientRunIds.get(client.id)?.delete(runId);
    backgroundTasks.delete(runId);
  }
}

function handleBackgroundStatus(client: WsClient, msg: any): void {
  const tasks = Array.from(backgroundTasks.values());
  client.send(JSON.stringify({
    type: "background.status",
    tasks: tasks.map(t => ({
      runId: t.runId,
      sessionId: t.sessionId,
      agentId: t.agentId,
      startedAt: t.startedAt.toISOString(),
    })),
    count: tasks.length,
  }));
}

// ─── Chat Abort (existing) ────────────────────────────────────────────

function handleChatAbort(client: WsClient, msg: any): void {
  const runId = msg.runId || "last";
  if (runId === "last") {
    // Abort the most recent run for this client
    const runIds = clientRunIds.get(client.id);
    if (runIds && runIds.size > 0) {
      const lastRunId = Array.from(runIds).pop();
      if (lastRunId) {
        const ac = abortControllers.get(lastRunId);
        if (ac) { ac.abort(); abortControllers.delete(lastRunId); }
      }
    }
  } else {
    const ac = abortControllers.get(runId);
    if (ac) { ac.abort(); abortControllers.delete(runId); }
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export function getAgentConnections(): Map<string, AgentConnection> {
  return agentConnections;
}

export function getBackgroundTasks(): Map<string, { runId: string; sessionId: string; agentId: string; startedAt: Date }> {
  return backgroundTasks;
}
