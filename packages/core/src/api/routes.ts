import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { safeMessage } from "../errors.ts";
import { cors } from "hono/cors";
import { join, dirname } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { registry } from "../plugin/registry.ts";
import { sessionManager } from "../session/manager.ts";
import { agentStore } from "../agent/store.ts";
import { runAgent } from "../agent/runner.ts";
import { listTools } from "../plugin/tools.ts";
import { channelManager } from "../channel/manager.ts";
import { memoryStore } from "../memory/store.ts";
import { onEvent } from "../event-bus/index.ts";
import type { VideoParams } from "../video/types.ts";
import { getVideoJobs, getVideoJob, startVideoGeneration, cancelVideoJob, deleteVideoJob } from "../video/pipeline.ts";
import { getWorkJobs, getWorkJob, createWorkJob, cancelWorkJob, deleteWorkJob, subscribeSSE } from "../worker/manager.ts";
import { createTask, listTasks, updateTask, deleteTask } from "../task/store.ts";
import { loadSkills } from "../skill/loader.ts";
import { spawnSubAgent } from "../multi-agent/subagent.ts";
import { makeSnapshot, listSnapshots, rewindFiles } from "../checkpoint/store.ts";
import { uploadSession, listSessions as listGistSessions } from "../cloud-save/gist.ts";
import { research, listSources } from "../research/engine.ts";
import { subscribe as monSubscribe, listSubscriptions, unsubscribe as monUnsubscribe } from "../monitor/scheduler.ts";
import * as cryptoHub from "../crypto-hub/hub.ts";
import { brainstorm } from "../brainstorm/engine.ts";
import { verifyToken, registerUser, loginUser } from "../auth/jwt.ts";
import { runTerminal } from "../gateway/routes-terminal.ts";
import { knowledgeBase } from "../knowledge/store.ts";
import { runAutoBugFixer } from "../agent/auto-bug-fixer.ts";
import { workspaceManager } from "../workspace/manager.ts";
import { kernel, agentFS, ledger } from "../kernel/index.ts";
import { tmuxAvailable, listSessions as tmuxListSessions, createSession as tmuxCreateSession, killSession as tmuxKillSession, sendKeys as tmuxSendKeys, capturePane as tmuxCapturePane, getStatus as tmuxGetStatus } from "../tmux/tools.ts";
import { listCommunityPlugins, getCommunityPlugin, installPlugin, uninstallPlugin, getPluginConfig, savePluginConfig } from "../plugin/community-plugins.ts";
import { agentScheduler } from "../agent/scheduler.ts";
import { chamberManager } from "../multi-agent/chamber.ts";
import { workflowEngine } from "../workflow/engine.ts";
import { usageTracker } from "../monitor/usage.ts";
import { getAllProviderConfigs, saveProviderConfig, deleteProviderConfig, testProviderConnection } from "../config/provider-config.ts";
import { logStore } from "../log/capture.ts";
import { cronManager } from "../cron/manager.ts";

// Auth middleware — bypass for /health, /api/auth, /v1, and /api/sessions
const PUBLIC_PATHS = ["/health", "/api/auth", "/", "/assets"];

function authMiddleware(c: any, next: any) {
  const path = c.req.path;
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p))) return next();
  const auth = c.req.header("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : getCookie(c, "nova_token") || "";
  if (token) {
    const user = verifyToken(token);
    if (user) {
      c.set("user", user);
      return next();
    }
  }
  // Allow public GET requests only for known safe endpoints
  const PUBLIC_GET_PATHS = ["/api/sessions", "/api/tools", "/api/agents", "/v1/models", "/health"];
  if (c.req.method === "GET" && PUBLIC_GET_PATHS.some(p => path === p || path.startsWith(p + "/"))) return next();
  return c.json({ error: "Unauthorized" }, 401);
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

export function createRouter(): Hono {
  const app = new Hono();
  app.use("*", cors({
    origin: process.env.NOVA_CORS_ORIGIN || "http://localhost:4123",
  }));
  app.use("*", authMiddleware);

  // Auth (rate limited: 10 requests per minute per IP)
  app.post("/api/auth/register", async (c) => {
    const ip = c.req.header("x-forwarded-for") || "local";
    if (!rateLimit(`register:${ip}`, 10, 60000)) return c.json({ error: "Too many requests" }, 429);
    const body = await c.req.json<{ username: string; password: string }>();
    if (!body.username || !body.password) return c.json({ error: "username and password required" }, 400);
    const token = registerUser(body.username, body.password);
    if (!token) return c.json({ error: "User already exists" }, 409);
    return c.json({ token, username: body.username });
  });
  app.post("/api/auth/login", async (c) => {
    const ip = c.req.header("x-forwarded-for") || "local";
    if (!rateLimit(`login:${ip}`, 10, 60000)) return c.json({ error: "Too many requests" }, 429);
    const body = await c.req.json<{ username: string; password: string }>();
    const token = loginUser(body.username, body.password);
    if (!token) return c.json({ error: "Invalid credentials" }, 401);
    return c.json({ token, username: body.username });
  });
  app.get("/api/auth/me", (c) => {
    const user = (c as any).get("user");
    if (!user) return c.json({ error: "Not authenticated" }, 401);
    return c.json({ user });
  });

  // Health
  app.get("/health", (c) => c.json({ status: "ok", version: "0.6.1" }));

  // Models
  app.get("/v1/models", (c) => c.json({ object: "list", data: registry.listModels().map((m) => ({ id: m.ref, object: "model", owned_by: m.providerId })) }));

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

          // Subscribe to streaming text events only
          // Do NOT subscribe to "done" events — tool loops may fire multiple "done" events
          // (one per iteration), which would cause premature stream closure. Instead,
          // we send the final [DONE] after runAgent completes.
          const unsubAssistant = onEvent("event", (e: any) => {
            if (e.kind === "assistant" && e.runId === runId && e.data?.text) {
              sendSSE(JSON.stringify({
                id: `chatcmpl-${session.id}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: body.model,
                choices: [{ index: 0, delta: { content: e.data.text }, finish_reason: null }],
              }));
            }
          });

          try {
            const result = await runAgent({ sessionId: session.id, message: lastMsg?.content ?? "", modelRef: body.model, tools: true, runId });
            // Send final result and close stream
            sendSSE(JSON.stringify({
              id: `chatcmpl-${session.id}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: body.model,
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            }));
            sendSSE("[DONE]");
          } catch (e: unknown) {
            sendSSE(JSON.stringify({ error: { message: safeMessage(e) } }));
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
      const { workspaceManager } = await import("../workspace/manager.ts");
      workspaceManager.setRoot(body.workspace);
    }
    const result = await runAgent({ sessionId, message: body.message, modelRef: modelRef ?? "deepseek/deepseek-chat", thinkingLevel: body.thinkingLevel, systemPrompt: sysPrompt, tools: true, agentId: body.agentId });

    // Reset agent status after response
    if (body.agentId) agentStore.update(body.agentId, { status: "ready" as any });

    return c.json(result);
  });

  // Sessions
  app.get("/api/sessions", (c) => c.json({ sessions: sessionManager.listSessions(50) }));
  app.get("/api/sessions/search", (c) => {
    const q = c.req.query("q") || "";
    const limit = parseInt(c.req.query("limit") || "10", 10);
    if (!q.trim()) return c.json({ results: [], query: q });
    const results = sessionManager.searchTranscripts(q, limit);
    return c.json({ results, query: q, count: results.length });
  });
  app.get("/api/sessions/:id", (c) => {
    const s = sessionManager.getSession(c.req.param("id"));
    if (!s) return c.json({ error: "Not found" }, 404);
    return c.json({ session: s, messages: sessionManager.getTranscript(s.id) });
  });

  // Tools
  app.get("/api/tools", (c) => c.json({ tools: listTools().map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }));

  // Agents
  app.get("/api/agents", (c) => c.json({ agents: agentStore.list() }));
  // Static routes before parameterized ones to avoid :id catching "jobs"
  app.get("/api/agents/jobs", (c) => c.json({ jobs: agentScheduler.listJobs() }));
  app.get("/api/agents/:id", (c) => {
    const agent = agentStore.get(c.req.param("id"));
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    return c.json({ agent });
  });
  app.post("/api/agents", async (c) => {
    const body = await c.req.json<{ name: string; description?: string; modelRef?: string; systemPrompt?: string; emoji?: string; skills?: string[] }>();
    try {
      const agent = agentStore.create(body);
      return c.json({ agent }, 201);
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 400);
    }
  });

  // AI-assisted agent creation
  app.post("/api/agents/ai-create", async (c) => {
    try {
      const body: any = await c.req.json();
      const userDesc = body.description || "";
      if (!userDesc.trim()) return c.json({ error: "description is required" }, 400);

      const systemPrompt = "You are an AI agent designer. Return ONLY valid JSON.";
      const userPrompt = `Based on this user description, generate a JSON object for a new AI agent.

User description: "${userDesc}"

Return valid JSON only (no markdown, no code fences):
{
  "name": "Short catchy name (max 30 chars)",
  "emoji": "A single emoji representing the agent",
  "description": "One-line description of what this agent does (max 80 chars)",
  "systemPrompt": "Detailed system prompt/instructions for the agent (2-4 paragraphs)",
  "modelRef": "deepseek/deepseek-chat",
  "skills": ["web_search", "get_current_time", "calculate"]
}`;

      // Use piHarness for a quick one-shot completion via the session manager
      const sessionId = c.get("sessionId") || "ai-create-" + Date.now();
      const resolved = registry.resolveModel("deepseek/deepseek-chat");
      if (!resolved) return c.json({ error: "No provider available" }, 500);

      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt },
      ];

      let text = "";
      const provider = resolved.provider;
      const modelId = resolved.model.id;
      await provider.stream({
        model: modelId,
        messages,
        stream: false,
        onToken: (token: string) => { text += token; },
        onFinish: () => {},
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return c.json({ error: "Failed to parse AI response: " + text.slice(0, 200) }, 500);

      const agentData = JSON.parse(jsonMatch[0]);
      const agent = agentStore.create({
        name: agentData.name || "AI Agent",
        description: agentData.description || "AI-generated agent",
        modelRef: agentData.modelRef || "deepseek/deepseek-chat",
        systemPrompt: agentData.systemPrompt || "",
        emoji: agentData.emoji || "🤖",
        skills: agentData.skills || [],
      });
      return c.json({ agent, generated: agentData }, 201);
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });
  app.put("/api/agents/:id", async (c) => {
    const body = await c.req.json<{ name?: string; description?: string; modelRef?: string; systemPrompt?: string; thinkingLevel?: string; emoji?: string; skills?: string[] }>();
    const agent = agentStore.update(c.req.param("id"), body);
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    return c.json({ agent });
  });
  // Agent workspace
  app.put("/api/agents/:id/workspace", async (c) => {
    try {
      const body = await c.req.json<{ path: string }>();
      const agent = agentStore.get(c.req.param("id"));
      if (!agent) return c.json({ error: "Agent not found" }, 404);
      agentStore.update(c.req.param("id"), { workspace: body.path } as any);
      const { workspaceManager } = await import("../workspace/manager.ts");
      workspaceManager.setRoot(body.path);
      return c.json({ status: "ok", workspace: body.path });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // ─── Agent Memory ──────────────────────────────────────────
  app.get("/api/agents/:id/memory", async (c) => {
    try {
      const { agentMemory } = await import("../agent/memory.ts");
      const type = c.req.query("type") as any;
      const query = c.req.query("q");
      const memories = agentMemory.search(c.req.param("id"), query, type, undefined, 100);
      return c.json({ memories, total: agentMemory.count(c.req.param("id")) });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.post("/api/agents/:id/memory", async (c) => {
    try {
      const { agentMemory } = await import("../agent/memory.ts");
      const body = await c.req.json<{ content: string; type: string; importance?: number; tags?: string }>();
      if (!body.content || !body.type) return c.json({ error: "content and type required" }, 400);
      const memory = agentMemory.add(c.req.param("id"), body.type as any, body.content, (body.importance || 3) as any, (body.tags || "").split(",").map((t) => t.trim()).filter(Boolean));
      return c.json({ memory }, 201);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.delete("/api/agents/:id/memory/:memoryId", async (c) => {
    try {
      const { agentMemory } = await import("../agent/memory.ts");
      return c.json({ deleted: agentMemory.forget(c.req.param("memoryId")) });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.delete("/api/agents/:id/memory", async (c) => {
    try {
      const { agentMemory } = await import("../agent/memory.ts");
      const count = agentMemory.forgetByAgent(c.req.param("id"));
      return c.json({ deleted: count });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.delete("/api/agents/:id", (c) => {
    const ok = agentStore.delete(c.req.param("id"));
    if (!ok) return c.json({ error: "Agent not found" }, 404);
    return c.json({ status: "deleted" });
  });

  // Agent background jobs
  app.post("/api/agents/:id/start", async (c) => {
    try {
      const body: any = await c.req.json().catch(() => ({}));
      const result = await agentScheduler.startAgent(c.req.param("id"), { task: body?.task, workspace: body?.workspace });
      return c.json({ status: "started", ...result });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });
  app.post("/api/agents/:id/stop", async (c) => {
    try {
      await agentScheduler.stopAgent(c.req.param("id"));
      return c.json({ status: "stopped" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // ─── Agent Chambers ──────────────────────────────────────────
  app.get("/api/chambers", (c) => {
    try {
      const chambers = chamberManager.list();
      return c.json({ chambers });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.get("/api/chambers/:id", (c) => {
    try {
      const chamber = chamberManager.get(c.req.param("id"));
      if (!chamber) return c.json({ error: "Chamber not found" }, 404);
      const messages = chamberManager.getMessages(c.req.param("id"), 500);
      return c.json({ chamber, messages });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.post("/api/chambers", async (c) => {
    try {
      const body = await c.req.json<{ name: string; task: string; agents: { agentId: string; role: string; order: number }[]; maxRounds?: number }>();
      if (!body.name || !body.task || !body.agents?.length) return c.json({ error: "name, task, and agents required" }, 400);
      const chamber = chamberManager.create(body.name, body.task, body.agents, body.maxRounds);
      return c.json({ chamber }, 201);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.post("/api/chambers/:id/run", async (c) => {
    try {
      const result = await chamberManager.runRoom(c.req.param("id"));
      return c.json(result);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.post("/api/chambers/:id/stop", (c) => {
    try {
      return c.json({ stopped: chamberManager.stopRoom(c.req.param("id")) });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.delete("/api/chambers/:id", (c) => {
    try {
      return c.json({ deleted: chamberManager.delete(c.req.param("id")) });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // ─── Workflows ──────────────────────────────────────────────
  app.get("/api/workflows", (c) => {
    try { return c.json({ workflows: workflowEngine.list() }); }
    catch (e) { return c.json({ error: safeMessage(e) }, 400); }
  });
  app.post("/api/workflows", async (c) => {
    try {
      const b = await c.req.json<{ name: string; description?: string; steps: any[] }>();
      return c.json({ workflow: workflowEngine.create(b.name, b.description || "", b.steps) }, 201);
    } catch (e) { return c.json({ error: safeMessage(e) }, 400); }
  });
  app.get("/api/workflows/:id", (c) => {
    try { const w = workflowEngine.get(c.req.param("id")); if (!w) return c.json({ error: "Not found" }, 404); return c.json({ workflow: w }); }
    catch (e) { return c.json({ error: safeMessage(e) }, 400); }
  });
  app.put("/api/workflows/:id", async (c) => {
    try { const b = await c.req.json(); return c.json({ updated: workflowEngine.update(c.req.param("id"), b) }); }
    catch (e) { return c.json({ error: safeMessage(e) }, 400); }
  });
  app.delete("/api/workflows/:id", (c) => {
    try { return c.json({ deleted: workflowEngine.delete(c.req.param("id")) }); }
    catch (e) { return c.json({ error: safeMessage(e) }, 400); }
  });
  app.post("/api/workflows/:id/run", async (c) => {
    try { return c.json(await workflowEngine.execute(c.req.param("id"))); }
    catch (e) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // ─── Monitoring ──────────────────────────────────────────────
  app.get("/api/usage", (c) => {
    try {
      const since = c.req.query("since");
      const agentId = c.req.query("agentId");
      return c.json(usageTracker.summarize(since, agentId));
    } catch (e) { return c.json({ error: safeMessage(e) }, 400); }
  });
  app.get("/api/usage/top", (c) => {
    try { const since = c.req.query("since"); return c.json({ top: usageTracker.summarize(since).topAgents }); }
    catch (e) { return c.json({ error: safeMessage(e) }, 400); }
  });
  app.get("/api/usage/audit", async (c) => {
    try {
      const { toolAudit } = await import("../safety/tool-audit.ts");
      const taskId = c.req.query("taskId");
      const n = parseInt(c.req.query("n") || "20", 10);
      const entries = taskId ? toolAudit.getEntries(taskId) : toolAudit.getRecent(n);
      return c.json({ entries, stats: toolAudit.getStats() });
    } catch (e) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // Tool Analytics Dashboard
  app.get("/api/analytics/dashboard", async (c) => {
    try {
      const summary = usageTracker.summarize();
      const { toolAudit } = await import("../safety/tool-audit.ts");
      const recent = toolAudit.getRecent(20);
      const stats = toolAudit.getStats();

      // Per-tool usage from audit log
      const toolCounts: Record<string, number> = {};
      const toolSuccess: Record<string, { ok: number; fail: number }> = {};
      for (const entry of toolAudit.getRecent(1000)) {
        toolCounts[entry.toolName] = (toolCounts[entry.toolName] || 0) + 1;
        if (!toolSuccess[entry.toolName]) toolSuccess[entry.toolName] = { ok: 0, fail: 0 };
        if (entry.success) toolSuccess[entry.toolName].ok++;
        else toolSuccess[entry.toolName].fail++;
      }

      const topTools = Object.entries(toolCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({
          name,
          count,
          successRate: toolSuccess[name]
            ? Math.round((toolSuccess[name].ok / (toolSuccess[name].ok + toolSuccess[name].fail)) * 100)
            : 100,
        }));

      const successRate = recent.length
        ? Math.round((recent.filter((e) => e.success).length / recent.length) * 100)
        : 100;

      return c.json({
        topTools,
        topAgents: summary.topAgents,
        recentCalls: recent.map((e) => ({
          toolName: e.toolName,
          agentId: e.agentId,
          durationMs: e.durationMs,
          success: e.success,
          timestamp: e.timestamp,
        })),
        successRate,
        totalToolCalls: summary.totalToolCalls,
        uniqueTools: stats.uniqueTools,
      });
    } catch (e) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // Agent files
  app.get("/api/agents/:id/files", (c) => {
    const agent = agentStore.get(c.req.param("id"));
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    return c.json({ files: agentStore.listFiles(c.req.param("id")) });
  });
  app.get("/api/agents/:id/files/:fileName", (c) => {
    const file = agentStore.getFile(c.req.param("id"), c.req.param("fileName"));
    if (!file || (file as any).missing) return c.json({ error: "File not found" }, 404);
    return c.json({ file });
  });
  app.put("/api/agents/:id/files/:fileName", async (c) => {
    const body = await c.req.json<{ content: string }>();
    const agent = agentStore.get(c.req.param("id"));
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    agentStore.setFile(c.req.param("id"), c.req.param("fileName"), body.content);
    return c.json({ status: "saved" });
  });

  // Agent task endpoint — wysyła zadanie do konkretnego agenta
  app.post("/api/agents/:id/task", async (c) => {
    try {
      const agentId = c.req.param("id");
      const body = await c.req.json<{ task: string; model?: string }>();
      const agent = agentStore.get(agentId);
      if (!agent) return c.json({ error: "Agent not found" }, 404);
      const s = sessionManager.createSession(body.model || agent.modelRef, {});
      const result = await runAgent({ sessionId: s.id, message: body.task, modelRef: body.model || agent.modelRef, agentId, tools: true });
      return c.json({ result });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // Channels
  app.get("/api/channels", (c) => c.json({ channels: channelManager.getChannels() }));
  app.get("/api/channels/configs", (c) => {
    // Return saved channel configs (keys masked) from disk
    try {
      const configsPath = join(process.cwd(), "data", "channel-configs.json");
      if (existsSync(configsPath)) {
        const raw = JSON.parse(readFileSync(configsPath, "utf-8"));
        // Mask sensitive values
        const masked: Record<string, Record<string, string>> = {};
        for (const [chId, cfg] of Object.entries(raw)) {
          masked[chId] = {};
          for (const [k, v] of Object.entries(cfg as Record<string, string>)) {
            const sensitiveKeys = ["token", "botToken", "apiKey", "accessToken", "secret", "password", "authToken"];
            masked[chId][k] = sensitiveKeys.some(sk => k.toLowerCase().includes(sk))
              ? v.slice(0, 8) + "•••" + v.slice(-4)
              : v;
          }
        }
        return c.json({ configs: masked });
      }
      return c.json({ configs: {} });
    } catch { return c.json({ configs: {} }); }
  });
  app.post("/api/channels/:id/start", async (c) => {
    const body = await c.req.json<{ token?: string; botToken?: string; chatId?: string; channelId?: string }>();
    try {
      // Fix naming: UI sends botToken but backend expects token
      if (body.botToken && !body.token) body.token = body.botToken;
      await channelManager.start(c.req.param("id"), body as Record<string, string>);
      return c.json({ status: "started" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });
  app.post("/api/channels/:id/stop", async (c) => {
    await channelManager.stop(c.req.param("id"));
    return c.json({ status: "stopped" });
  });
  app.post("/api/channels/:id/test", async (c) => {
    try {
      const result = await channelManager.test(c.req.param("id"));
      return c.json(result);
    } catch (e: unknown) {
      return c.json({ ok: false, message: safeMessage(e) }, 500);
    }
  });
  app.post("/api/channels/report", async (c) => {
    try {
      const channels = channelManager.getChannels();
      const now = new Date().toISOString();
      let report = `Channel Report — ${now}\n${"=".repeat(50)}\n\n`;
      report += `Total channels configured: ${channels.length}\n\n`;
      for (const ch of channels) {
        const configKeys = Object.keys(ch.config || {}).join(", ");
        report += `[${ch.connected ? "ONLINE" : "OFFLINE"}] ${ch.name || ch.id}\n`;
        report += `  ID:        ${ch.id}\n`;
        report += `  Status:    ${ch.connected ? "Connected" : "Disconnected"}\n`;
        report += `  Config:    ${configKeys || "(none)"}\n`;
        report += "\n";
      }
      report += `${"=".repeat(50)}\n`;
      report += `Report generated at: ${now}\n`;
      return c.json({ report });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  // ─── File Upload ────────────────────────────────────────────────────────────
  const UPLOAD_DIR = join(process.cwd(), "data", "uploads");

  app.post("/api/upload", async (c) => {
    try {
      const body = await c.req.json<{ files: { name: string; type: string; content: string }[] }>();
      if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
        return c.json({ error: "No files provided" }, 400);
      }
      if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

      const uploaded: { name: string; path: string; size: number }[] = [];
      for (const file of body.files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = join(UPLOAD_DIR, `${Date.now()}-${safeName}`);
        const buffer = Buffer.from(file.content, "base64");
        writeFileSync(filePath, buffer);
        uploaded.push({ name: file.name, path: filePath, size: buffer.length });
      }

      return c.json({ status: "ok", files: uploaded });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  // Memory
  app.get("/api/memory", (c) => c.json({ memories: memoryStore.getAll(c.req.query("scope") as any) }));
  app.get("/api/memory/search", (c) => c.json({ results: memoryStore.search(c.req.query("q") || "") }));
  app.post("/api/memory", async (c) => {
    const body = await c.req.json<{ name: string; content: string; tags?: string[]; scope?: "user" | "project"; importance?: string }>();
    if (!body.name || !body.content) return c.json({ error: "name and content required" }, 400);
    const entry = memoryStore.save(body.name, body.content, body.tags, body.scope, body.importance as any);
    return c.json({ memory: entry }, 201);
  });
  app.delete("/api/memory/:id", (c) => {
    if (!memoryStore.delete(c.req.param("id"))) return c.json({ error: "Not found" }, 404);
    return c.json({ status: "deleted" });
  });

  // Video
  app.get("/api/video/jobs", (c) => c.json({ jobs: getVideoJobs() }));
  app.get("/api/video/jobs/:id", (c) => {
    const job = getVideoJob(c.req.param("id"));
    if (!job) return c.json({ error: "Job not found" }, 404);
    return c.json({ job });
  });
  app.post("/api/video/generate", async (c) => {
    const ct = c.req.header("content-type") || "";
    // FormData (audio upload) path
    if (ct.includes("multipart/form-data")) {
      const fd = await c.req.parseBody();
      const audioFile = fd.audio as File;
      if (!audioFile) return c.json({ error: "audio file is required" }, 400);
      const lang = (fd.language as string) || "en";
      const duration = parseInt((fd.duration as string) || "1", 10);
      const imageEngine = (fd.imageEngine as string) || "auto";
      const quality = (fd.quality as string) || "medium";
      const subtitleMode = (fd.subtitleMode as string) || "auto";
      const nicheName = fd.nicheName as string | undefined;
      const imageCount = parseInt((fd.imageCount as string) || "6", 10);
      const animationStyle = fd.animationStyle as string | undefined;
      const imageStyle = fd.imageStyle as string | undefined;
      const effects = fd.effects as string | undefined;
      const model = fd.model as string | undefined;
      const ttsEngine = fd.ttsEngine as string | undefined;
      // Transcribe audio using Whisper
      const buffer = Buffer.from(await audioFile.arrayBuffer());
      const tmpDir = join(process.cwd(), "data", "audio_uploads");
      mkdirSync(tmpDir, { recursive: true });
      const audioPath = join(tmpDir, `upload_${Date.now()}_${Math.random().toString(36).slice(2,8)}.mp3`);
      writeFileSync(audioPath, buffer);
      // Get actual audio duration from file
      let audioDurSec = 60;
      try {
        const { spawn } = await import("node:child_process");
        const { ffmpegPath } = await import("../video/assembly.ts");
        const ff = ffmpegPath();
        const result = await new Promise<string>((resolve) => {
          const proc = spawn(ff, ["-i", audioPath, "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] });
          let err = "";
          proc.stderr?.on("data", (d: Buffer) => { err += d.toString(); });
          proc.on("close", () => resolve(err));
          proc.on("error", () => resolve(""));
          setTimeout(() => { try { proc.kill(); } catch {}; resolve(err) }, 5000);
        });
        const m = result.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
        if (m) audioDurSec = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 100;
      } catch {}
      const durationMin = Math.max(1, Math.ceil(audioDurSec / 60));
      let transcribedText = "";
      let transcriptionSegments: Array<{ text: string; start: number; end: number }> = [];
      try {
        const { transcribeAudioWithTimestamps } = await import("../voice/stt.ts");
        console.log(`[video] transcribing audio with timestamps: ${audioPath}`);
        const result = await transcribeAudioWithTimestamps(audioPath);
        transcribedText = result.text;
        transcriptionSegments = result.segments;
        console.log(`[video] transcription result (${transcribedText.length} chars, ${transcriptionSegments.length} segments)`);
      } catch (e: any) {
        console.error(`[video] transcription error:`, e?.message || String(e));
        transcribedText = `Audio narration ${Date.now()}`;
      }
      const mediaType = (fd.mediaType as string) || "images";
      let stockVideos: string[] | undefined;
      if (fd.stockVideos) {
        try { stockVideos = JSON.parse(fd.stockVideos as string); } catch {}
      }
      const params: VideoParams = {
        topic: transcribedText.slice(0, 120) || "Audio narration",
        scriptText: transcribedText,
        duration: durationMin,
        language: lang,
        imageEngine: imageEngine as any,
        quality: quality as any,
        subtitleMode: subtitleMode as any,
        nicheName,
        imageCount,
        animationStyle,
        imageStyle,
        effects,
        model,
        ttsEngine: ttsEngine as any,
        isShort: false,
        audioPath,
        useAudioEffects: false,
        transcriptionSegments,
        transition: fd.transition as string | undefined,
        transitionDuration: fd.transitionDuration ? parseFloat(fd.transitionDuration as string) : undefined,
        subtitleAnimation: fd.subtitleAnimation as string | undefined,
        composition: fd.composition as string | undefined,
        mediaType: mediaType as "images" | "videos",
        stockVideos,
        musicVideoMode: fd.musicVideoMode === "true",
      };
      const job = await startVideoGeneration(params);
      return c.json({ job, transcribed: transcribedText.slice(0, 200) }, 201);
    }
    const body = await c.req.json<VideoParams>();
    if (!body.topic) return c.json({ error: "topic is required" }, 400);
    const job = await startVideoGeneration(body);
    return c.json({ job }, 201);
  });
  app.post("/api/video/jobs/:id/cancel", (c) => {
    const ok = cancelVideoJob(c.req.param("id"));
    if (!ok) return c.json({ error: "Job not found or not running" }, 404);
    return c.json({ status: "cancelled" });
  });
  app.delete("/api/video/jobs/:id", (c) => {
    const ok = deleteVideoJob(c.req.param("id"));
    if (!ok) return c.json({ error: "Job not found" }, 404);
    return c.json({ status: "deleted" });
  });
  // Dubbing service API
  app.post("/api/dub/start", async (c) => {
    try {
      const fd = await c.req.parseBody();
      const videoFile = fd.video as File;
      if (!videoFile) return c.json({ error: "video file required" }, 400);
      const lang = (fd.language as string) || "en";
      const sourceLang = (fd.sourceLanguage as string) || "auto";
      const ttsEngine = fd.ttsEngine as string | undefined;
      const subtitleMode = fd.subtitleMode as string | undefined;

      const buffer = Buffer.from(await videoFile.arrayBuffer());
      console.log(`[dub] Upload: ${videoFile.name}, size=${buffer.length}, type=${videoFile.type}`);

      const tmpDir = join(process.cwd(), "data", "dubbing");
      mkdirSync(tmpDir, { recursive: true });
      const videoPath = join(tmpDir, `input_${Date.now()}.mp4`);
      writeFileSync(videoPath, buffer);
      console.log(`[dub] Saved to: ${videoPath} (${existsSync(videoPath) ? statSync(videoPath).size : 0} bytes on disk)`);

      const { startDubbing } = await import("../dubbing-service.ts");
      const job = startDubbing({ inputPath: videoPath, sourceLanguage: sourceLang, targetLanguage: lang, ttsEngine, subtitleMode });
      return c.json({ job }, 201);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });
  app.get("/api/dub/jobs", async (c) => {
    const { getDubJobs } = await import("../dubbing-service.ts");
    return c.json({ jobs: getDubJobs() });
  });
  app.get("/api/dub/jobs/:id", async (c) => {
    const { getDubJob } = await import("../dubbing-service.ts");
    const job = getDubJob(c.req.param("id"));
    if (!job) return c.json({ error: "Not found" }, 404);
    return c.json({ job });
  });
  app.get("/api/dub/download/:id", async (c) => {
    const { getDubJob } = await import("../dubbing-service.ts");
    const job = getDubJob(c.req.param("id"));
    if (!job?.outputPath || !existsSync(job.outputPath)) return c.json({ error: "Not found" }, 404);
    const file = readFileSync(job.outputPath);
    const filename = job.outputPath.split(/[/\\]/).pop() || "dubbed.mp4";
    return new Response(file, { headers: { "Content-Type": "video/mp4", "Content-Disposition": `attachment; filename="${filename}"` } });
  });
  app.get("/api/video/jobs/:id/download", (c) => {
    const job = getVideoJob(c.req.param("id"));
    if (!job || !job.outputPath) return c.json({ error: "No output file" }, 404);
    if (!existsSync(job.outputPath)) return c.json({ error: "File not found on disk" }, 404);
    const filename = job.outputPath.split(/[/\\]/).pop() || "video.mp4";
    const file = readFileSync(job.outputPath);
    return c.newResponse(file, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(file.length),
      },
    });
  });

  // Worker
  app.get("/api/worker/jobs", (c) => c.json({ jobs: getWorkJobs() }));
  app.get("/api/worker/jobs/:id", (c) => {
    const job = getWorkJob(c.req.param("id"));
    if (!job) return c.json({ error: "Job not found" }, 404);
    return c.json({ job });
  });
  app.post("/api/worker/jobs", async (c) => {
    const body = await c.req.json<{ title: string; tasks: string[]; modelRef?: string }>();
    if (!body.title || !body.tasks?.length) return c.json({ error: "title and tasks required" }, 400);
    const job = createWorkJob(body.title, body.tasks, body.modelRef);
    return c.json({ job }, 201);
  });
  app.post("/api/worker/jobs/:id/cancel", (c) => {
    const ok = cancelWorkJob(c.req.param("id"));
    if (!ok) return c.json({ error: "Job not found or not running" }, 404);
    return c.json({ status: "cancelled" });
  });
  app.delete("/api/worker/jobs/:id", (c) => {
    const ok = deleteWorkJob(c.req.param("id"));
    if (!ok) return c.json({ error: "Job not found" }, 404);
    return c.json({ status: "deleted" });
  });
  app.get("/api/worker/events", (c) => {
    // SSE endpoint for live worker updates
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = (event: string, data: any) => {
      try {
        writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      } catch {}
    };
    const unsub = subscribeSSE(send);
    c.req.raw.signal.addEventListener("abort", () => { unsub(); writer.close().catch(() => {}); });
    return c.newResponse(readable, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  });

  // Tasks
  app.get("/api/tasks", (c) => c.json({ tasks: listTasks() }));
  app.post("/api/tasks", async (c) => {
    const body = await c.req.json<{ title: string; description?: string; priority?: string; tags?: string[] }>();
    if (!body.title) return c.json({ error: "title required" }, 400);
    return c.json({ task: createTask(body.title, body.description, body.priority as any, body.tags) }, 201);
  });
  app.patch("/api/tasks/:id", async (c) => {
    const body = await c.req.json<{ status?: string }>();
    const task = updateTask(c.req.param("id"), body as any);
    if (!task) return c.json({ error: "Not found" }, 404);
    return c.json({ task });
  });
  app.delete("/api/tasks/:id", (c) => { if (!deleteTask(c.req.param("id"))) return c.json({ error: "Not found" }, 404); return c.json({ status: "deleted" }); });

  // Skills
  app.get("/api/skills", (c) => c.json({ skills: loadSkills() }));

  // Sub-agents
  app.post("/api/subagent", async (c) => {
    const body = await c.req.json<{ id: string; name: string; modelRef: string; systemPrompt: string; message: string }>();
    const result = await spawnSubAgent({ id: body.id, name: body.name, modelRef: body.modelRef, systemPrompt: body.systemPrompt }, body.message);
    return c.json({ result });
  });

  // Checkpoints
  app.get("/api/checkpoints", (c) => c.json({ snapshots: listSnapshots() }));
  app.post("/api/checkpoints", async (c) => {
    const body = await c.req.json<{ description: string; files: string[] }>();
    return c.json({ snapshot: makeSnapshot(body.description, body.files) }, 201);
  });
  app.post("/api/checkpoints/:id/rewind", (c) => {
    if (!rewindFiles(c.req.param("id"))) return c.json({ error: "Not found" }, 404);
    return c.json({ status: "rewound" });
  });

  // Cloud save
  app.post("/api/cloud/upload", async (c) => {
    const body = await c.req.json<{ token: string; title: string; content: string }>();
    const id = await uploadSession(body.token, body.title, body.content);
    return c.json({ gistId: id });
  });
  app.post("/api/cloud/list", async (c) => {
    const body = await c.req.json<{ token: string }>();
    const sessions = await listGistSessions(body.token);
    return c.json({ sessions });
  });

  // Research
  app.post("/api/research", async (c) => {
    const body = await c.req.json<{ query: string }>();
    const results = await research(body.query);
    return c.json({ results });
  });

  // Monitor
  app.get("/api/monitor", (c) => c.json({ subscriptions: listSubscriptions() }));
  app.post("/api/monitor", async (c) => {
    const body = await c.req.json<{ topic: string; sources: string[]; interval: number }>();
    return c.json({ subscription: monSubscribe(body.topic, body.sources, body.interval) }, 201);
  });
  app.delete("/api/monitor/:id", (c) => {
    if (!monUnsubscribe(c.req.param("id"))) return c.json({ error: "Not found" }, 404);
    return c.json({ status: "deleted" });
  });

  // Trading
  app.get("/api/trading/:symbol", async (c) => {
    const result = await cryptoHub.analyzeSymbol(c.req.param("symbol"));
    return c.json({ analysis: result });
  });
  app.get("/api/trading/:symbol/history", async (c) => {
    const range = c.req.query("range") as any || "7";
    const data = await cryptoHub.getPriceHistory(c.req.param("symbol"), range);
    return c.json({ symbol: c.req.param("symbol"), data });
  });
  app.get("/api/trading/watchlist", async (c) => {
    return c.json({ watchlist: await cryptoHub.getWatchlist() });
  });
  app.post("/api/trading/watchlist", async (c) => {
    const body = await c.req.json<{ symbol: string; note?: string }>();
    if (!body.symbol) return c.json({ error: "symbol required" }, 400);
    const entry = await cryptoHub.addToWatchlist(body.symbol);
    return c.json({ entry }, 201);
  });
  app.delete("/api/trading/watchlist/:symbol", async (c) => {
    const result = await cryptoHub.removeFromWatchlist(c.req.param("symbol"));
    return c.json({ status: "removed", result });
  });

  // Brainstorm
  app.post("/api/brainstorm", async (c) => {
    const body = await c.req.json<{ topic: string }>();
    const ideas = await brainstorm(body.topic);
    return c.json({ ideas });
  });

  // Terminal runner
  app.post("/api/terminal", async (c) => {
    const body = await c.req.json<{ command: string }>();
    if (!body.command) return c.json({ error: "command required" }, 400);
    const output = await runTerminal(body.command);
    return c.json({ output });
  });

  // Knowledge Base
  app.get("/api/knowledge/stats", (c) => c.json({ stats: knowledgeBase.getStats() }));
  app.get("/api/knowledge/:category", (c) => {
    const entries = knowledgeBase.listByCategory(c.req.param("category"));
    return c.json({ entries });
  });
  app.get("/api/knowledge/search/:query", (c) => {
    const results = knowledgeBase.search(c.req.param("query"), c.req.query("category"));
    return c.json({ results });
  });
  app.post("/api/knowledge", async (c) => {
    const body = await c.req.json<{ title: string; content: string; category?: string; tags?: string[]; source?: string }>();
    if (!body.title || !body.content) return c.json({ error: "title and content required" }, 400);
    const entry = knowledgeBase.save(body);
    return c.json({ entry }, 201);
  });

  // Auto Bug Fixer
  app.post("/api/agent/auto-bug-fixer", async (c) => {
    const body = await c.req.json<{ repoDir?: string; testCmd?: string }>();
    const result = await runAutoBugFixer(body.repoDir || ".", body.testCmd || "bun test");
    return c.json({ result });
  });

  // ─── Workspace ──────────────────────────────────────────────────────────
  app.get("/api/workspace", (c) => {
    const state = workspaceManager.getState();
    if (!state) return c.json({ active: false });
    return c.json({ active: true, workspace: state });
  });
  app.get("/api/workspace/status", (c) => {
    const state = workspaceManager.getState();
    return c.json({ active: !!state, root: state?.root || null, files: state?.files?.length || 0 });
  });
  app.post("/api/workspace/set", async (c) => {
    const body = await c.req.json<{ dir: string }>();
    if (!body.dir) return c.json({ error: "dir required" }, 400);
    const ok = workspaceManager.setRoot(body.dir);
    if (!ok) return c.json({ error: "Failed to set workspace" }, 400);
    return c.json({ status: "ok", workspace: workspaceManager.getState() });
  });
  app.get("/api/workspace/files", (c) => {
    if (!workspaceManager.isActive()) return c.json({ error: "No workspace set" }, 400);
    const files = workspaceManager.listFiles(c.req.query("dir") || "", {
      ext: c.req.query("ext") || undefined,
      maxDepth: parseInt(c.req.query("depth") || "3"),
    });
    return c.json({ files });
  });
  app.get("/api/workspace/read", (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path required" }, 400);
    const content = workspaceManager.readFile(path);
    if (content === null) return c.json({ error: "File not found or too large" }, 404);
    return c.json({ content });
  });
  app.post("/api/workspace/write", async (c) => {
    const body = await c.req.json<{ path: string; content: string }>();
    if (!body.path || body.content === undefined) return c.json({ error: "path and content required" }, 400);
    const ok = workspaceManager.writeFile(body.path, body.content);
    if (!ok) return c.json({ error: "Failed to write file" }, 400);
    return c.json({ status: "ok" });
  });
  app.get("/api/workspace/tree", (c) => {
    if (!workspaceManager.isActive()) return c.json({ error: "No workspace set" }, 400);
    const tree = workspaceManager.getTree(c.req.query("dir") || "", parseInt(c.req.query("depth") || "2"));
    return c.json({ tree });
  });
  app.post("/api/workspace/clear", (c) => {
    workspaceManager.clear();
    return c.json({ status: "cleared" });
  });

  // ─── Kernel ─────────────────────────────────────────────────────────────
  app.get("/api/kernel/status", (c) => c.json({ initialized: kernel.isInitialized() }));
  app.get("/api/kernel/agentfs/:agentId", (c) => {
    const files = agentFS.listAgentFiles(c.req.param("agentId"));
    return c.json({ files });
  });
  app.get("/api/kernel/agentfs/:agentId/:fileName", (c) => {
    const content = agentFS.readAgentFile(c.req.param("agentId"), c.req.param("fileName"));
    if (content === null) return c.json({ error: "File not found" }, 404);
    return c.json({ content });
  });
  app.put("/api/kernel/agentfs/:agentId/:fileName", async (c) => {
    const body = await c.req.json<{ content: string }>();
    const ok = agentFS.writeAgentFile(c.req.param("agentId"), c.req.param("fileName"), body.content);
    if (!ok) return c.json({ error: "Failed to write" }, 400);
    return c.json({ status: "ok" });
  });
  app.get("/api/kernel/global", (c) => {
    const files = agentFS.listGlobalFiles();
    return c.json({ files });
  });
  app.get("/api/kernel/ledger", (c) => {
    const entries = ledger.query({
      agentId: c.req.query("agentId") || undefined,
      action: c.req.query("action") || undefined,
      limit: parseInt(c.req.query("limit") || "50"),
    });
    return c.json({ entries });
  });
  app.get("/api/kernel/ledger/stats", (c) => c.json({ stats: ledger.getStats() }));

  // ─── Research Sources ───────────────────────────────────────────────────
  app.get("/api/research/sources", (c) => c.json({ sources: listSources() }));

  // ─── Tmux ───────────────────────────────────────────────────────────────
  app.get("/api/tmux/status", (c) => c.json({ available: tmuxAvailable(), status: tmuxGetStatus() }));
  app.get("/api/tmux/sessions", (c) => c.json({ sessions: tmuxListSessions() }));
  app.post("/api/tmux/sessions", async (c) => {
    const body = await c.req.json<{ name: string; dir?: string }>();
    if (!body.name) return c.json({ error: "name required" }, 400);
    const ok = tmuxCreateSession(body.name, body.dir);
    if (!ok) return c.json({ error: "Failed to create session" }, 400);
    return c.json({ status: "created" });
  });
  app.delete("/api/tmux/sessions/:name", (c) => {
    const ok = tmuxKillSession(c.req.param("name"));
    if (!ok) return c.json({ error: "Session not found" }, 404);
    return c.json({ status: "killed" });
  });
  app.post("/api/tmux/send", async (c) => {
    const body = await c.req.json<{ session: string; command: string; window?: number; pane?: number }>();
    if (!body.session || !body.command) return c.json({ error: "session and command required" }, 400);
    const ok = tmuxSendKeys(body.session, body.command, body.window, body.pane);
    if (!ok) return c.json({ error: "Failed to send keys" }, 400);
    return c.json({ status: "sent" });
  });
  app.get("/api/tmux/capture", (c) => {
    const session = c.req.query("session");
    if (!session) return c.json({ error: "session required" }, 400);
    const output = tmuxCapturePane(session, parseInt(c.req.query("window") || "0"), parseInt(c.req.query("pane") || "0"));
    return c.json({ output });
  });

  // ─── Plugins ──────────────────────────────────────────────────────────────
  app.get("/api/plugins", (c) => c.json({ plugins: listCommunityPlugins() }));
  app.get("/api/plugins/:id", (c) => {
    const plugin = getCommunityPlugin(c.req.param("id"));
    if (!plugin) return c.json({ error: "Plugin not found" }, 404);
    return c.json({ plugin });
  });
  app.post("/api/plugins/:id/install", async (c) => {
    const result = await installPlugin(c.req.param("id"));
    if (!result.success) return c.json({ error: result.error, log: result.log }, 400);
    return c.json({ status: "installed", path: result.path, log: result.log });
  });
  app.post("/api/plugins/:id/uninstall", async (c) => {
    const result = await uninstallPlugin(c.req.param("id"));
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ status: "uninstalled" });
  });
  app.get("/api/plugins/:id/config", (c) => {
    try { return c.json({ config: getPluginConfig(c.req.param("id")) }); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });
  app.post("/api/plugins/:id/config", async (c) => {
    try {
      const body = await c.req.json<Record<string, string>>();
      savePluginConfig(c.req.param("id"), body);
      return c.json({ status: "saved" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // ─── Config / Provider API Keys ────────────────────────────────────────────
  app.get("/api/config/providers", (c) => {
    const providers = getAllProviderConfigs();
    return c.json({ providers });
  });

  app.post("/api/config/providers/:id", async (c) => {
    try {
      const providerId = c.req.param("id");
      const body = await c.req.json<{ apiKey?: string; baseUrl?: string; maxTokens?: number; thinkingLevel?: string; enabled?: boolean }>();
      const entry = saveProviderConfig(providerId, body);
      // Never send apiKey back to client
      const { apiKey, ...safe } = entry;
      return c.json({ status: "saved", provider: safe });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 400);
    }
  });

  app.delete("/api/config/providers/:id", (c) => {
    const providerId = c.req.param("id");
    const ok = deleteProviderConfig(providerId);
    if (!ok) return c.json({ error: "Provider not found" }, 404);
    return c.json({ status: "unbound" });
  });

  app.post("/api/config/providers/:id/test", async (c) => {
    try {
      const providerId = c.req.param("id");
      const body: any = await c.req.json().catch(() => ({}));
      const result = await testProviderConnection(providerId, body?.apiKey);
      return c.json(result);
    } catch (e: unknown) {
      return c.json({ ok: false, error: safeMessage(e) }, 400);
    }
  });

  app.post("/api/config/providers/refresh-models", (c) => {
    // Re-register providers with updated env vars by re-importing
    // The env vars are already set by saveProviderConfig, so providers
    // will pick them up on next stream call automatically.
    const models = registry.listModels();
    return c.json({ status: "ok", count: models.length, models });
  });

  // ─── Workspace API ────────────────────────────────────────────────────────
  app.post("/api/workspace/add-folder", async (c) => {
    try {
      const body = await c.req.json<{ path: string }>();
      const ok = workspaceManager.addFolder(body.path);
      return c.json({ ok });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.post("/api/workspace/remove-folder", async (c) => {
    try {
      const body = await c.req.json<{ path: string }>();
      const ok = workspaceManager.removeFolder(body.path);
      return c.json({ ok });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.get("/api/workspace/folders", (c) => {
    const folders = workspaceManager.getFolders();
    return c.json({ folders });
  });

  // Native folder picker — opens Windows folder dialog via PowerShell
  app.post("/api/workspace/browse", async (c) => {
    try {
      const { execSync } = await import("node:child_process");
      // PowerShell script that opens native FolderBrowserDialog
      // Use semicolons between statements so newline→space replacement doesn't break it
      const psScript = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$folder = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$folder.Description = "Select workspace folder for Nova AI"',
        '$folder.ShowNewFolderButton = $true',
        '$result = $folder.ShowDialog()',
        'if ($result -eq [System.Windows.Forms.DialogResult]::OK) {',
        '  Write-Output $folder.SelectedPath',
        '} else {',
        '  Write-Output "__CANCELLED__"',
        '}',
      ].join("; ");
      const result = execSync(
        `powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
        { encoding: "utf-8", timeout: 30000, shell: true },
      ).trim();
      if (result === "__CANCELLED__" || !result) {
        return c.json({ cancelled: true });
      }
      return c.json({ path: result });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  // ─── Config / Global Rules ─────────────────────────────────────────────────
  const RULES_PATH = join(process.cwd(), "config", "rules.txt");

  app.get("/api/config/rules", (c) => {
    try {
      if (existsSync(RULES_PATH)) {
        const rules = readFileSync(RULES_PATH, "utf-8");
        return c.json({ rules });
      }
      return c.json({ rules: "" });
    } catch (e: unknown) {
      return c.json({ rules: "", error: safeMessage(e) });
    }
  });

  app.post("/api/config/rules", async (c) => {
    try {
      const body = await c.req.json<{ rules: string }>();
      const dir = dirname(RULES_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(RULES_PATH, body.rules ?? "", "utf-8");
      return c.json({ status: "saved" });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  // Save generation defaults
  app.post("/api/config/settings", async (c) => {
    try {
      const body = await c.req.json<{ ttsEngine?: string; imageEngine?: string; videoQuality?: string }>();
      const SETTINGS_PATH = join(process.cwd(), "data", "defaults.json");
      const dir = dirname(SETTINGS_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const existing = existsSync(SETTINGS_PATH) ? JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) : {};
      const merged = { ...existing, ...body };
      writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
      // Also set env vars for runtime
      if (body.ttsEngine) process.env.NOVA_DEFAULT_TTS = body.ttsEngine;
      if (body.imageEngine) process.env.NOVA_DEFAULT_IMAGE = body.imageEngine;
      if (body.videoQuality) process.env.NOVA_DEFAULT_QUALITY = body.videoQuality;
      return c.json({ status: "saved", settings: merged });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  // ─── Config Export/Import ──────────────────────────────────────────────────────
  const CFG_DIR = join(process.cwd(), "data");
  const APPEARANCE_PATH = join(process.cwd(), "data", "appearance.json");
  const RULES_PATH_ = RULES_PATH; // already defined above

  app.get("/api/config/export", (c) => {
    try {
      const providers = getAllProviderConfigs();
      const rules = existsSync(RULES_PATH) ? readFileSync(RULES_PATH, "utf-8") : "";
      const defaults = existsSync(join(CFG_DIR, "defaults.json"))
        ? JSON.parse(readFileSync(join(CFG_DIR, "defaults.json"), "utf-8"))
        : {};
      const appearance = existsSync(APPEARANCE_PATH)
        ? JSON.parse(readFileSync(APPEARANCE_PATH, "utf-8"))
        : {};
      return c.json({
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        providers: providers.map((p: any) => ({
          id: p.id,
          providerId: p.providerId,
          name: p.name,
          enabled: p.enabled,
          model: p.model,
          baseUrl: p.baseUrl,
        })),
        rules,
        defaults,
        appearance,
      });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  app.post("/api/config/import", async (c) => {
    try {
      const body = await c.req.json<any>();
      if (!body || !body.exportVersion) {
        return c.json({ error: "Invalid config file: missing exportVersion" }, 400);
      }
      // Save rules
      if (body.rules !== undefined) {
        const dir = dirname(RULES_PATH);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(RULES_PATH, body.rules, "utf-8");
      }
      // Save defaults
      if (body.defaults) {
        if (!existsSync(CFG_DIR)) mkdirSync(CFG_DIR, { recursive: true });
        writeFileSync(join(CFG_DIR, "defaults.json"), JSON.stringify(body.defaults, null, 2), "utf-8");
      }
      // Save appearance
      if (body.appearance) {
        if (!existsSync(CFG_DIR)) mkdirSync(CFG_DIR, { recursive: true });
        writeFileSync(APPEARANCE_PATH, JSON.stringify(body.appearance, null, 2), "utf-8");
      }
      return c.json({ status: "imported" });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  app.get("/api/config/appearance", (c) => {
    try {
      const defaults = { theme: "dark", fontSize: "medium", accentColor: "#00f2fe", compact: false };
      if (existsSync(APPEARANCE_PATH)) {
        const saved = JSON.parse(readFileSync(APPEARANCE_PATH, "utf-8"));
        return c.json({ ...defaults, ...saved });
      }
      return c.json(defaults);
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  app.post("/api/config/appearance", async (c) => {
    try {
      const body = await c.req.json<{ theme?: string; fontSize?: string; accentColor?: string; compact?: boolean }>();
      if (!existsSync(CFG_DIR)) mkdirSync(CFG_DIR, { recursive: true });
      const existing = existsSync(APPEARANCE_PATH) ? JSON.parse(readFileSync(APPEARANCE_PATH, "utf-8")) : {};
      const merged = { ...existing, ...body };
      writeFileSync(APPEARANCE_PATH, JSON.stringify(merged, null, 2), "utf-8");
      return c.json({ status: "saved", appearance: merged });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  // ─── MCP Management ───────────────────────────────────────────────────────────
  app.get("/api/mcp/servers", async (c) => {
    try {
      const { listServers } = await import("../mcp-client.ts");
      return c.json({ servers: listServers() });
    } catch { return c.json({ servers: [] }); }
  });

  app.post("/api/mcp/restart", async (c) => {
    try {
      const mcp = await import("../mcp-client.ts");
      await mcp.stopAll();
      await mcp.initMCPServers();
      return c.json({ status: "restarted", servers: mcp.listServers() });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // ─── Crypto News Agent ────────────────────────────────────────────────────────
  app.post("/api/crypto/start", async (c) => {
    try {
      const { startScheduler, getStatus } = await import("../crypto/scheduler.ts");
      startScheduler();
      return c.json({ status: "running", interval: 45 });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/crypto/stop", async (c) => {
    try {
      const { stopScheduler } = await import("../crypto/scheduler.ts");
      stopScheduler();
      return c.json({ status: "stopped" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/crypto/now", async (c) => {
    try {
      const { runCryptoDigest } = await import("../crypto/scheduler.ts");
      const result = await runCryptoDigest();
      return c.json({ ok: true, published: result.published, skipped: result.skipped });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/crypto/history", async (c) => {
    try {
      const { getHistory } = await import("../crypto/scheduler.ts");
      return c.json({ publications: getHistory() });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/crypto/status", async (c) => {
    try {
      const { getStatus, getHistory } = await import("../crypto/scheduler.ts");
      return c.json({ ...getStatus(), history: getHistory() });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/crypto/config", async (c) => {
    return c.json({ interval: 45, sources: ["CoinDesk", "CoinTelegraph", "The Block", "Decrypt", "CryptoSlate", "CoinGecko"], maxNews: 5 });
  });

  app.get("/api/crypto/portfolio", async (c) => {
    try {
      const { loadPositions, calculatePortfolio } = await import("../crypto/portfolio.ts");
      return c.json({ positions: loadPositions(), snapshot: await calculatePortfolio() });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/crypto/portfolio", async (c) => {
    try {
      const body = await c.req.json<{ positions: Record<string, number> }>();
      const { savePositions } = await import("../crypto/portfolio.ts");
      const positions = Object.entries(body.positions || {}).map(([symbol, amount]) => ({ symbol, amount, entryPrice: undefined }));
      savePositions(positions);
      return c.json({ ok: true, positions });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // ─── Crypto — Base Ecosystem ──────────────────────────────────────────
  app.get("/api/crypto/base/status", async (c) => {
    try {
      const { fetchBaseEcosystem, fetchBaseOnchainStats } = await import("../crypto/base-tracker.ts");
      const [ecosystem, onchain] = await Promise.all([fetchBaseEcosystem(), fetchBaseOnchainStats()]);
      return c.json({ ecosystem, onchain });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // ─── Crypto — Wallet Scanner ─────────────────────────────────────────
  app.post("/api/crypto/wallet/check", async (c) => {
    try {
      const body = await c.req.json<{ addresses: string[] }>();
      if (!body.addresses?.length) return c.json({ error: "addresses array required" }, 400);
      const { scanWallets } = await import("../crypto/wallet-scanner.ts");
      const results = await scanWallets(body.addresses);
      return c.json({ results });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // ─── Crypto — Token Analyzer ─────────────────────────────────────────
  app.post("/api/crypto/analyze", async (c) => {
    try {
      const body = await c.req.json<{ symbol: string }>();
      if (!body.symbol) return c.json({ error: "symbol required" }, 400);
      const { analyzeToken } = await import("../crypto/token-analyzer.ts");
      const result = await analyzeToken(body.symbol);
      return c.json({ analysis: result });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // ─── Kimu Video Editor Bridge ────────────────────────────────────────────────
  app.get("/api/video-editor/status", async (c) => {
    try {
      const { getServices } = await import("../launcher.ts");
      const services = getServices();
      const kimu = services.find((s) => s.name === "kimu") || { running: false, label: "🎬 Video Editor", url: "http://localhost:3457" };
      return c.json(kimu);
    } catch { return c.json({ running: false, error: "Launcher not available" }); }
  });

  app.post("/api/video-editor/start", async (c) => {
    try {
      const { execSync } = await import("node:child_process");
      execSync('docker compose -f "' + import.meta.resolve("../../infra/kimu.yml") + '" up -d', { stdio: "pipe", timeout: 60000 });
      return c.json({ status: "starting", message: "Kimu is starting..." });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/video-editor/ai", async (c) => {
    try {
      const body = await c.req.json();
      const res = await fetch("http://localhost:3456/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return c.json({ error: "Kimu AI error" }, 502);
      return c.json(await res.json());
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 502); }
  });

  app.get("/api/video-editor/projects", async (c) => {
    try {
      const res = await fetch("http://localhost:3456/api/projects", { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return c.json({ error: "Kimu unavailable" }, 502);
      return c.json(await res.json());
    } catch { return c.json({ error: "Kimu unavailable" }, 502); }
  });

  app.post("/api/video-editor/import", async (c) => {
    try {
      const body = await c.req.json<{ filePath: string }>();
      const { existsSync, readFileSync } = await import("node:fs");
      if (!existsSync(body.filePath)) return c.json({ error: "File not found" }, 404);
      const fileBuffer = readFileSync(body.filePath);
      const form = new FormData();
      form.append("file", new Blob([fileBuffer]), body.filePath.split(/[\\/]/).pop() || "asset.mp4");
      const res = await fetch("http://localhost:3456/api/assets", {
        method: "POST", body: form, signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return c.json({ error: "Kimu import failed" }, 502);
      return c.json(await res.json());
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 502); }
  });

  app.post("/api/video-editor/export", async (c) => {
    try {
      const body = await c.req.json<{ projectId: string; format?: string }>();
      const res = await fetch("http://localhost:3456/api/exports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: body.projectId, format: body.format || "mp4" }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) return c.json({ error: "Kimu export failed" }, 502);
      return c.json(await res.json());
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 502); }
  });

  // ─── Shopping Agent ──────────────────────────────────────────────────────────
  app.get("/api/shopping/products", async (c) => {
    try {
      const query = c.req.query("q");
      const minPrice = c.req.query("minPrice") ? parseFloat(c.req.query("minPrice")!) : undefined;
      const maxPrice = c.req.query("maxPrice") ? parseFloat(c.req.query("maxPrice")!) : undefined;
      const site = c.req.query("site") || "all";
      const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 20;
      const sort = c.req.query("sort") || "relevance";
      const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!) : 0;

      if (!query) return c.json({ error: "Query required (q parameter)" }, 400);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const { searchProducts } = await import("../shopping/scraper.ts");
      const result = await searchProducts({ query, minPrice, maxPrice, site, limit: limit + offset });
      clearTimeout(timeout);
      const products = result.products.slice(offset, offset + limit);

      // Sort on client-request
      if (sort === "price_asc") products.sort((a: any, b: any) => (a.price ?? Infinity) - (b.price ?? Infinity));
      else if (sort === "price_desc") products.sort((a: any, b: any) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
      else if (sort === "newest") products.sort((a: any, b: any) => (b.title || "").localeCompare(a.title || ""));

      return c.json({ products, total: result.products.length });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/shopping/sites", async (c) => {
    return c.json({
      sites: [
        "amazon.fr", "fnac.com", "darty.com", "cdiscount.com", "boulanger.com",
        "zalando.fr", "adidas.fr", "nike.com/fr", "decathlon.fr", "intersport.fr",
        "leroymerlin.fr", "manomano.fr", "auchan.fr", "carrefour.fr",
        "sephora.fr", "galerieslafayette.com", "showroomprive.com", "veepee.fr",
        "la-redoute.fr", "but.fr", "electrodepot.fr",
        "celio.com", "petit-bateau.fr", "go-sport.com",
      ],
    });
  });

  // ─── Analytics ───────────────────────────────────────────────────
  app.get("/api/analytics/stats", async (c) => {
    try {
      const allAgents = agentStore.list();
      const allSessions = sessionManager.listSessions();
      const allSkills = loadSkills();
      const allChannels = channelManager.getChannels();
      const activeAgents = allAgents.filter((a: any) => a.status === "running").length;

      // Sessions by model
      const sessionsByModel: Record<string, number> = {};
      for (const s of allSessions) {
        const model = (s as any).modelRef || "unknown";
        sessionsByModel[model] = (sessionsByModel[model] || 0) + 1;
      }

      // Recent activity — last 10 sessions
      const recentActivity = allSessions.slice(0, 10).map((s: any) => ({
        action: `Session with ${s.modelRef || "unknown"} (${s.id?.slice(0, 8) || "?"}...)`,
        timestamp: s.updatedAt || s.createdAt || "",
      }));

      return c.json({
        totalSessions: allSessions.length,
        totalAgents: allAgents.length,
        totalSkills: allSkills.length,
        totalChannels: (allChannels as any[])?.length || 0,
        activeAgents,
        successRate: 99.5,
        avgLatency: 1842,
        totalSpend: 0.47,
        sessionsByModel: Object.entries(sessionsByModel).map(([model, count]) => ({ model, count })),
        recentActivity,
        uptime: process.uptime(),
        lastUpdated: new Date().toISOString(),
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // ─── Logs ─────────────────────────────────────────────────────────
  app.get("/api/logs", (c) => {
    const limit = parseInt(c.req.query("limit") || "500", 10);
    return c.json({ logs: logStore.list(limit) });
  });

  app.get("/api/logs/stream", (c) => {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = (entry: any) => {
      try { writer.write(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`)); } catch {}
    };
    const unsub = logStore.subscribe(send);
    c.req.raw.signal.addEventListener("abort", () => { unsub(); writer.close().catch(() => {}); });
    return c.newResponse(readable, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  });

  // ─── Stock Media Search ────────────────────────────────────────
  app.get("/api/stock/search", async (c) => {
    try {
      const q = c.req.query("q");
      const page = parseInt(c.req.query("page") || "1");
      if (!q) return c.json({ error: "query required" }, 400);
      const apiKey = process.env.PEXELS_API_KEY;
      if (!apiKey) return c.json({ photos: [] });
      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=20&page=${page}&orientation=landscape`, {
        headers: { Authorization: apiKey }, signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return c.json({ error: `Pexels HTTP ${res.status}` }, 502);
      const data = await res.json();
      return c.json({ photos: (data.photos || []).map((p: any) => ({
        id: p.id, url: p.url, photographer: p.photographer,
        src: { medium: p.src?.medium, large: p.src?.large, original: p.src?.original }, alt: p.alt,
      }))});
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // ─── Stock Video Search ─────────────────────────────────────────
  app.get("/api/stock/video-search", async (c) => {
    try {
      const q = c.req.query("q");
      const page = parseInt(c.req.query("page") || "1");
      if (!q) return c.json({ error: "query required" }, 400);
      const apiKey = process.env.PEXELS_API_KEY;
      if (!apiKey) return c.json({ videos: [] });
      const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=15&page=${page}&orientation=landscape&min_duration=10&max_duration=60`, {
        headers: { Authorization: apiKey }, signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return c.json({ error: `Pexels HTTP ${res.status}` }, 502);
      const data = await res.json();
      return c.json({ videos: (data.videos || []).filter((v: any) => v.duration >= 8).sort((a: any, b: any) => b.duration - a.duration).map((v: any) => {
        // Pick HD file (1280 or 1920 width), fallback to largest available
        const files = v.video_files || [];
        const hd = files.find((f: any) => f.width === 1280 && f.file_type === "video/mp4")
          || files.find((f: any) => f.width === 1920 && f.file_type === "video/mp4")
          || files.filter((f: any) => f.file_type === "video/mp4").sort((a: any, b: any) => b.width - a.width)[0]
          || files[0];
        return {
          id: v.id, url: v.url, photographer: v.user?.name || "Pexels",
          duration: v.duration, width: hd?.width || 0, height: hd?.height || 0,
          videoUrl: hd?.link || "",
          thumbnail: v.image || "",
        };
      })});
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // ─── Music Library ─────────────────────────────────────────────
  app.get("/api/music/library", (c) => {
    const tracks = [
      { id: "chill-1", title: "Sunset Chill", artist: "Nova Audio", duration: 180, genre: "chill", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
      { id: "upbeat-1", title: "Morning Energy", artist: "Nova Audio", duration: 210, genre: "upbeat", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
      { id: "cinematic-1", title: "Epic Journey", artist: "Nova Audio", duration: 240, genre: "cinematic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
      { id: "lofi-1", title: "Night Study", artist: "Nova Audio", duration: 195, genre: "lofi", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
      { id: "corporate-1", title: "Tech Forward", artist: "Nova Audio", duration: 165, genre: "corporate", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
      { id: "ambient-1", title: "Deep Space", artist: "Nova Audio", duration: 300, genre: "ambient", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
      { id: "pop-1", title: "Summer Vibes", artist: "Nova Audio", duration: 200, genre: "pop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3" },
      { id: "jazz-1", title: "Late Night Jazz", artist: "Nova Audio", duration: 280, genre: "jazz", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
      { id: "electronic-1", title: "Neon Pulse", artist: "Nova Audio", duration: 220, genre: "electronic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3" },
      { id: "acoustic-1", title: "Acoustic Dreams", artist: "Nova Audio", duration: 190, genre: "acoustic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3" },
    ];
    return c.json({ tracks });
  });

  // ─── Integrations ─────────────────────────────────────────────
  app.get("/api/integrations/services", async (c) => {
    try {
      const { integrationManager } = await import("../integrations/manager.ts");
      return c.json({ services: integrationManager.listServices() });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/integrations/accounts", async (c) => {
    try {
      const { integrationManager } = await import("../integrations/manager.ts");
      return c.json({ accounts: integrationManager.listAccounts() });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/integrations/accounts", async (c) => {
    try {
      const { integrationManager } = await import("../integrations/manager.ts");
      const body = await c.req.json<{ service: string; name: string; config: Record<string, string> }>();
      if (!body.service || !body.name) return c.json({ error: "service and name required" }, 400);
      const acc = integrationManager.addAccount(body.service, body.name, body.config || {});
      return c.json({ account: acc }, 201);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.delete("/api/integrations/accounts/:id", async (c) => {
    try {
      const { integrationManager } = await import("../integrations/manager.ts");
      const ok = integrationManager.removeAccount(c.req.param("id"));
      if (!ok) return c.json({ error: "Not found" }, 404);
      return c.json({ status: "deleted" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.put("/api/integrations/accounts/:id/toggle", async (c) => {
    try {
      const { integrationManager } = await import("../integrations/manager.ts");
      const body = await c.req.json<{ enabled: boolean }>();
      const acc = integrationManager.toggleAccount(c.req.param("id"), body.enabled);
      if (!acc) return c.json({ error: "Not found" }, 404);
      return c.json({ account: acc });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/integrations/accounts/:id/test", async (c) => {
    try {
      const { integrationManager } = await import("../integrations/manager.ts");
      const result = await integrationManager.testConnection(c.req.param("id"));
      return c.json(result);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/integrations/accounts/:id/logs", async (c) => {
    try {
      const { integrationManager } = await import("../integrations/manager.ts");
      const limit = parseInt(c.req.query("limit") || "20");
      return c.json({ logs: integrationManager.getLogs(c.req.param("id"), limit) });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // ─── RAG Pipeline ────────────────────────────────────────────
  app.get("/api/rag/documents", async (c) => {
    try { const { ragManager } = await import("../rag/manager.ts"); return c.json({ documents: ragManager.listDocuments() }); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/rag/upload", async (c) => {
    try {
      const { ragManager } = await import("../rag/manager.ts");
      const ct = c.req.header("content-type") || "";
      if (ct.includes("multipart/form-data")) {
        const fd = await c.req.parseBody();
        const file = fd.file as File;
        if (!file) return c.json({ error: "file required" }, 400);
        const buffer = Buffer.from(await file.arrayBuffer());
        const doc = await ragManager.uploadDocument(file.name, buffer);
        return c.json({ document: doc }, 201);
      }
      const body = await c.req.json<{ filename: string; content: string }>();
      if (!body.filename || !body.content) return c.json({ error: "filename and content required" }, 400);
      const doc = await ragManager.uploadDocument(body.filename, body.content);
      return c.json({ document: doc }, 201);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/rag/documents/:id", async (c) => {
    try {
      const { ragManager } = await import("../rag/manager.ts");
      const doc = ragManager.getDocument(c.req.param("id"));
      if (!doc) return c.json({ error: "Not found" }, 404);
      return c.json({ document: doc });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/rag/documents/:id/content", async (c) => {
    try {
      const { ragManager } = await import("../rag/manager.ts");
      const content = ragManager.getDocumentContent(c.req.param("id"));
      if (!content) return c.json({ error: "Not found" }, 404);
      return c.json({ content });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.delete("/api/rag/documents/:id", async (c) => {
    try {
      const { ragManager } = await import("../rag/manager.ts");
      const ok = ragManager.deleteDocument(c.req.param("id"));
      if (!ok) return c.json({ error: "Not found" }, 404);
      return c.json({ status: "deleted" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/rag/query", async (c) => {
    try {
      const { ragManager } = await import("../rag/manager.ts");
      const body = await c.req.json<{ question: string }>();
      if (!body.question) return c.json({ error: "question required" }, 400);
      const answer = await ragManager.query(body.question);
      return c.json({ answer, question: body.question });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // ─── Cron ─────────────────────────────────────────────────────────
  app.get("/api/cron", (c) => {
    try {
      const jobs = cronManager.listJobs(true); // include disabled
      return c.json({ jobs });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/cron/:id", (c) => {
    try {
      const job = cronManager.getJob(c.req.param("id"));
      if (!job) return c.json({ error: "Job not found" }, 404);
      return c.json({ job });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/cron", async (c) => {
    try {
      const body = await c.req.json<{ description: string; schedule?: string }>();
      if (!body.description && !body.schedule) return c.json({ error: "description or schedule required" }, 400);

      let schedule = body.schedule;
      let intervalMs = 60000;

      if (!schedule) {
        const { parseNaturalSchedule } = await import("../cron/manager.ts");
        const parsed = parseNaturalSchedule(body.description);
        if (!parsed) return c.json({ error: "Could not parse schedule from description" }, 400);
        schedule = parsed.cronExpr;
        intervalMs = parsed.intervalMs;
      }

      const nextRun = new Date(Date.now() + intervalMs).toISOString();
      const job = cronManager.createJob({
        description: body.description,
        schedule,
        nextRun,
      });
      return c.json({ job }, 201);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.put("/api/cron/:id", async (c) => {
    try {
      const body = await c.req.json<{ description?: string; schedule?: string; enabled?: boolean }>();
      const id = c.req.param("id");

      if (body.description !== undefined || body.schedule !== undefined) {
        const updateFields: any = {};
        if (body.description !== undefined) updateFields.description = body.description;
        if (body.schedule !== undefined) updateFields.schedule = body.schedule;
        if (body.schedule) {
          updateFields.nextRun = new Date(Date.now() + 3600000).toISOString();
        }
        cronManager.updateJob(id, updateFields);
      }

      if (body.enabled === true) cronManager.resumeJob(id);
      else if (body.enabled === false) cronManager.pauseJob(id);

      const job = cronManager.getJob(id);
      if (!job) return c.json({ error: "Job not found" }, 404);
      return c.json({ job });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.put("/api/cron/:id/enable", async (c) => {
    try {
      const body = await c.req.json<{ enabled: boolean }>();
      const id = c.req.param("id");
      if (body.enabled) cronManager.resumeJob(id);
      else cronManager.pauseJob(id);
      return c.json({ enabled: body.enabled });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/cron/:id/run", async (c) => {
    try {
      const id = c.req.param("id");
      const run = await cronManager.runNow(id);
      return c.json({ run }, run.status === "error" ? 500 : 200);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/cron/:id/runs", (c) => {
    try {
      const id = c.req.param("id");
      const limit = parseInt(c.req.query("limit") || "20");
      const runs = cronManager.getJobRuns(id, limit);
      return c.json({ runs });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.delete("/api/cron/:id", (c) => {
    try {
      const ok = cronManager.deleteJob(c.req.param("id"));
      if (!ok) return c.json({ error: "Job not found" }, 404);
      return c.json({ status: "deleted" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.onError((err, c) => {
    console.error("Error:", err);
    return c.json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  });

  // ─── Crypto & Trading Hub V2 ────────────────────────────────────────
  app.get("/api/crypto-hub/dashboard", async (c) => {
    try { const { getDashboard } = await import("../crypto-hub/v2.ts"); return c.json(await getDashboard()); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/crypto-hub/coin/:symbol", async (c) => {
    try { const { getCoinDetail } = await import("../crypto-hub/v2.ts"); return c.json(await getCoinDetail(c.req.param("symbol"))); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/crypto-hub/alerts", async (c) => {
    try { const { listAlerts } = await import("../crypto-hub/v2.ts"); return c.json({ alerts: listAlerts() }); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/crypto-hub/alerts", async (c) => {
    try {
      const { addAlert } = await import("../crypto-hub/v2.ts");
      const body = await c.req.json<{ symbol: string; type: string; value: number; message?: string; channel?: string; channelConfig?: string }>();
      return c.json(addAlert(body.symbol, body.type, body.value, body.message, body.channel, body.channelConfig));
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.delete("/api/crypto-hub/alerts/:id", async (c) => {
    try { const { removeAlert } = await import("../crypto-hub/v2.ts"); return c.json({ removed: removeAlert(c.req.param("id")) }); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/crypto-hub/portfolio", async (c) => {
    try { const { getPortfolioWithPnL } = await import("../crypto-hub/v2.ts"); return c.json(await getPortfolioWithPnL()); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/crypto-hub/portfolio", async (c) => {
    try {
      const { addPortfolioEntry } = await import("../crypto-hub/v2.ts");
      const body = await c.req.json<{ symbol: string; amount: number; buyPrice: number; notes?: string }>();
      return c.json(addPortfolioEntry(body.symbol, body.amount, body.buyPrice, body.notes));
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.delete("/api/crypto-hub/portfolio/:id", async (c) => {
    try { const { removePortfolioEntry } = await import("../crypto-hub/v2.ts"); return c.json({ removed: removePortfolioEntry(c.req.param("id")) }); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/crypto-hub/check-alerts", async (c) => {
    try { const { checkAlerts } = await import("../crypto-hub/v2.ts"); return c.json({ triggered: await checkAlerts() }); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });
  // ── Social Media Accounts API ────────────────────────────
  app.get("/api/social/accounts", async (c) => {
    const { listAccounts } = await import("../social/manager.ts");
    return c.json({ accounts: listAccounts() });
  });

  app.get("/api/social/platforms", async (c) => {
    const { PLATFORM_DEFS } = await import("../social/manager.ts");
    return c.json({ platforms: PLATFORM_DEFS });
  });

  app.post("/api/social/accounts", async (c) => {
    try {
      const body = await c.req.json<{ name: string; platform: string; apiConfig?: Record<string, string> }>();
      const { addAccount } = await import("../social/manager.ts");
      const account = addAccount({ name: body.name, platform: body.platform, apiConfig: body.apiConfig });
      return c.json({ account }, 201);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.delete("/api/social/accounts/:id", async (c) => {
    const { removeAccount } = await import("../social/manager.ts");
    const ok = removeAccount(c.req.param("id"));
    return c.json({ ok });
  });

  app.post("/api/social/accounts/:id/connect", async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json<{ apiConfig?: Record<string, string> }>().catch(() => ({}));
      const { getAccount, updateAccount, verifyAndConnect } = await import("../social/manager.ts");

      // If apiConfig provided, update it first
      if (body.apiConfig) {
        updateAccount(id, { apiConfig: body.apiConfig });
      }

      const result = await verifyAndConnect(id);
      return c.json(result);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/social/accounts/:id/launch", async (c) => {
    try {
      const id = c.req.param("id");
      const { getAccount } = await import("../social/manager.ts");
      const account = getAccount(id);
      if (!account) return c.json({ error: "Account not found" }, 404);

      const { PLATFORM_DEFS } = await import("../social/manager.ts");
      const platDef = PLATFORM_DEFS.find((p: any) => p.id === account.platform);
      const loginUrl = platDef?.loginUrl || `https://www.${account.platform}.com/login`;
      const profileDir = account.profileDir;

      if (!profileDir || !existsSync(profileDir)) {
        return c.json({ error: "No browser profile for this account" }, 400);
      }

      const { execSync } = await import("node:child_process");

      // Find Chrome/Edge/Brave
      const browsers = [
        "chrome", "msedge", "brave", "google-chrome",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      ];

      let browserCmd = "";
      for (const b of browsers) {
        try {
          execSync(`where ${b}`, { timeout: 1000, windowsHide: true });
          browserCmd = b;
          break;
        } catch {
          // Check full path
          if (existsSync(b)) { browserCmd = b; break; }
        }
      }

      if (!browserCmd) {
        return c.json({ error: "No browser found. Install Chrome, Edge, or Brave." }, 500);
      }

      // Normalize path for Chrome (forward slashes are more reliable on Windows)
      const normalizedDir = profileDir.replace(/\\/g, "/");

      // Kill only browser processes using THIS specific profile
      // Match by account ID in the command line (unique to this profile)
      try {
        execSync(`powershell -Command "Get-Process -Name chrome,msedge,brave -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match '${id}' } | Stop-Process -Force -ErrorAction SilentlyContinue"`, { timeout: 3000, windowsHide: true });
      } catch {}

      // Wait briefly for processes to release
      await new Promise(r => setTimeout(r, 1000));

      execSync(`start "" "${browserCmd}" --user-data-dir="${normalizedDir}" "${loginUrl}" --new-window --no-first-run --no-default-browser-check`, {
        timeout: 5000, shell: "cmd.exe", windowsHide: false,
      });

      return c.json({
        ok: true,
        message: `🌐 Browser opened for **${account.name}**.\nLog in, then click "Verify Login" to confirm.`,
      });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/social/accounts/:id/verify", async (c) => {
    try {
      const { verifyBrowserLogin } = await import("../social/manager.ts");
      const result = await verifyBrowserLogin(c.req.param("id"));
      return c.json(result);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });



  // ─── Playground ────────────────────────────────────────────────
  const playgroundHistory: any[] = [];

  app.post("/api/playground/run", async (c) => {
    try {
      const body = await c.req.json();
      const { model, systemPrompt, userPrompt, temperature, maxTokens } = body;

      const messages = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: userPrompt });

      // Use the existing chat mechanism
      const startTime = Date.now();
      const result = await runAgent({
        message: userPrompt,
        modelRef: model || "deepseek/deepseek-chat",
        systemPrompt: systemPrompt || undefined,
      });
      const latency = (Date.now() - startTime) / 1000;

      return c.json({ 
        text: result.text,
        latency,
        tokens: result.usage?.total_tokens || 0,
        cost: 0,
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  app.get("/api/playground/history", (c) => {
    return c.json({ runs: playgroundHistory.slice(0, 50) });
  });

  app.post("/api/playground/save", async (c) => {
    try {
      const body = await c.req.json();
      const { name, systemPrompt, userPrompt, model } = body;
      playgroundHistory.push({
        id: Date.now(),
        name,
        systemPrompt,
        userPrompt,
        model,
        savedAt: new Date().toISOString(),
      });
      return c.json({ ok: true });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // ─── OAuth Endpoints ──────────────────────────────────────
  app.get("/api/integrations/oauth/authorize/:service", async (c) => {
    try {
      const { oauthManager } = await import("../integrations/oauth");
      const { url, codeVerifier } = oauthManager.getAuthorizeUrl(c.req.param("service"));
      // Store codeVerifier in session for later exchange
      return c.json({ url, codeVerifier });
    } catch (e: any) { return c.json({ error: e.message }, 400); }
  });

  app.post("/api/integrations/oauth/callback", async (c) => {
    try {
      const { oauthManager } = await import("../integrations/oauth");
      const body = await c.req.json();
      const token = await oauthManager.exchangeCode(body.service, body.code, body.codeVerifier);
      // Store token for the integration
      if (body.integrationId) {
        oauthManager.storeTokens(body.integrationId, body.service, token);
      }
      return c.json({ ok: true, tokenType: token.tokenType, scopes: token.scopes });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/integrations/oauth/config", (c) => {
    const configs: Record<string, any> = {};
    for (const [service, config] of Object.entries(require("../integrations/oauth").OAUTH_CONFIGS)) {
      configs[service] = { authorizeUrl: config.authorizeUrl, scopes: config.scopes, usePKCE: config.usePKCE };
    }
    return c.json(configs);
  });

  // ─── Git Automation Endpoints ─────────────────────────────
  app.post("/api/git/status", async (c) => {
    try {
      const { gitManager } = await import("../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.getStatus(body.cwd || process.cwd()));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/diff", async (c) => {
    try {
      const { gitManager } = await import("../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.diff(body.cwd || process.cwd(), body.target));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/log", async (c) => {
    try {
      const { gitManager } = await import("../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.log(body.cwd || process.cwd(), body.count || 20));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/branch", async (c) => {
    try {
      const { gitManager } = await import("../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.branch(body.cwd || process.cwd(), body.name));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/checkout", async (c) => {
    try {
      const { gitManager } = await import("../git/manager");
      const body = await c.req.json();
      return c.json(await gitManager.checkout(body.cwd || process.cwd(), body.branch));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/commit", async (c) => {
    try {
      const { gitManager } = await import("../git/manager");
      const body = await c.req.json();
      return c.json(await gitManager.commit(body.cwd || process.cwd(), body.message, body.files));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/push", async (c) => {
    try {
      const { gitManager } = await import("../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.push(body.cwd || process.cwd(), body.remote, body.branch));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/pull", async (c) => {
    try {
      const { gitManager } = await import("../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.pull(body.cwd || process.cwd(), body.remote, body.branch));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/stash", async (c) => {
    try {
      const { gitManager } = await import("../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.stash(body.cwd || process.cwd(), body.message));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/stash-pop", async (c) => {
    try {
      const { gitManager } = await import("../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.stashPop(body.cwd || process.cwd()));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/blame", async (c) => {
    try {
      const { gitManager } = await import("../git/manager");
      const body = await c.req.json();
      return c.json(await gitManager.blame(body.cwd || process.cwd(), body.file));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // ─── RAG Embedding Endpoints ──────────────────────────────
  app.get("/api/rag/config", (c) => {
    const { embeddingManager } = require("../rag/manager");
    return c.json(embeddingManager.getConfig());
  });

  app.post("/api/rag/config", async (c) => {
    const { embeddingManager } = require("../rag/manager");
    const body = await c.req.json();
    await embeddingManager.setConfig(body.provider, body.model, body.apiKey);
    return c.json({ ok: true });
  });

  app.post("/api/rag/embed/:docId", async (c) => {
    const { embeddingManager } = require("../rag/manager");
    const count = await embeddingManager.embedDocument(c.req.param("docId"));
    return c.json({ embedded: count });
  });

  app.post("/api/rag/embed-all", async (c) => {
    const { embeddingManager } = require("../rag/manager");
    const result = await embeddingManager.embedAllDocuments();
    return c.json(result);
  });

  app.post("/api/rag/hybrid-search", async (c) => {
    const { embeddingManager } = require("../rag/manager");
    const body = await c.req.json();
    const results = await embeddingManager.hybridSearch(body.query, body.limit || 10);
    return c.json({ results });
  });

  // ─── DEX Trading Endpoints ───────────────────────────────
  app.post("/api/dex/quote", async (c) => {
    try {
      const { jupiterClient } = await import("../crypto-hub/dex/jupiter");
      const { findToken } = await import("../crypto-hub/dex/tokens");
      const body = await c.req.json();
      const inputToken = findToken(body.from);
      const outputToken = findToken(body.to);
      if (!inputToken || !outputToken) return c.json({ error: "Unknown token" }, 400);
      const amount = Math.floor(parseFloat(body.amount) * Math.pow(10, inputToken.decimals));
      const quote = await jupiterClient.getQuote({
        inputMint: inputToken.mint, outputMint: outputToken.mint,
        amount, slippageBps: body.slippage || 50,
      });
      return c.json(quote);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/dex/swap", async (c) => {
    try {
      const { jupiterClient } = await import("../crypto-hub/dex/jupiter");
      const { findToken } = await import("../crypto-hub/dex/tokens");
      const { walletManager } = await import("../crypto-hub/dex/wallet");
      walletManager.init();
      if (!walletManager.isConnected()) return c.json({ error: "Wallet not configured" }, 400);
      const body = await c.req.json();
      const inputToken = findToken(body.from);
      const outputToken = findToken(body.to);
      if (!inputToken || !outputToken) return c.json({ error: "Unknown token" }, 400);
      const amount = Math.floor(parseFloat(body.amount) * Math.pow(10, inputToken.decimals));
      const quote = await jupiterClient.getQuote({
        inputMint: inputToken.mint, outputMint: outputToken.mint, amount, slippageBps: 50,
      });
      const swap = await jupiterClient.getSwapTransaction({
        quoteResponse: quote, userPublicKey: walletManager.getAddress()!,
      });
      return c.json(swap);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/dex/price/:tokens", async (c) => {
    try {
      const { jupiterClient } = await import("../crypto-hub/dex/jupiter");
      const { findToken } = await import("../crypto-hub/dex/tokens");
      const symbols = c.req.param("tokens").split(",");
      const mints = symbols.map((s: string) => findToken(s.trim())?.mint).filter(Boolean);
      const prices = await jupiterClient.getSimplePrice(mints);
      return c.json(prices);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/dex/wallet", async (c) => {
    try {
      const { walletManager } = await import("../crypto-hub/dex/wallet");
      walletManager.init();
      const info = await walletManager.getInfo();
      return c.json(info || { error: "No wallet" });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/dex/tokens", (c) => {
    const { SOLANA_TOKENS } = require("../crypto-hub/dex/tokens");
    return c.json(SOLANA_TOKENS);
  });

  // ─── Polymarket Endpoints ────────────────────────────────
  app.get("/api/polymarket/markets", async (c) => {
    try {
      const { polymarketClient } = await import("../crypto-hub/polymarket/client");
      const limit = parseInt(c.req.query("limit") || "20");
      const active = c.req.query("active") !== "false";
      const markets = await polymarketClient.getMarkets({ limit, active, closed: false });
      return c.json(markets);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/markets/:id", async (c) => {
    try {
      const { polymarketClient } = await import("../crypto-hub/polymarket/client");
      const market = await polymarketClient.getMarket(c.req.param("id"));
      return c.json(market);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/trending", async (c) => {
    try {
      const { polymarketClient } = await import("../crypto-hub/polymarket/client");
      const limit = parseInt(c.req.query("limit") || "10");
      const markets = await polymarketClient.getTrendingMarkets(limit);
      return c.json(markets);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/search", async (c) => {
    try {
      const { polymarketClient } = await import("../crypto-hub/polymarket/client");
      const q = c.req.query("q") || "";
      const markets = await polymarketClient.searchMarkets(q, 10);
      return c.json(markets);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/book/:tokenId", async (c) => {
    try {
      const { polymarketClient } = await import("../crypto-hub/polymarket/client");
      const book = await polymarketClient.getOrderBook(c.req.param("tokenId"));
      return c.json(book);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/analyze/:id", async (c) => {
    try {
      const { polymarketAnalyzer } = await import("../crypto-hub/polymarket/analyzer");
      const analysis = await polymarketAnalyzer.analyzeMarket(c.req.param("id"));
      return c.json(analysis);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/opportunities", async (c) => {
    try {
      const { polymarketAnalyzer } = await import("../crypto-hub/polymarket/analyzer");
      const limit = parseInt(c.req.query("limit") || "5");
      const opps = await polymarketAnalyzer.findOpportunities(limit);
      return c.json(opps);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // ─── Strategy Endpoints ──────────────────────────────────
  app.get("/api/strategies", (c) => {
    const { strategyEngine } = require("../crypto-hub/strategies/engine");
    return c.json(strategyEngine.listStrategies());
  });

  app.post("/api/strategies", async (c) => {
    try {
      const { strategyEngine } = await import("../crypto-hub/strategies/engine");
      const body = await c.req.json();
      const strategy = strategyEngine.createStrategy(body.type, body.name, body.config || {});
      return c.json(strategy);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/strategies/:id", (c) => {
    const { strategyEngine } = require("../crypto-hub/strategies/engine");
    const s = strategyEngine.getStrategy(c.req.param("id"));
    return s ? c.json(s) : c.json({ error: "Not found" }, 404);
  });

  app.delete("/api/strategies/:id", (c) => {
    const { strategyEngine } = require("../crypto-hub/strategies/engine");
    strategyEngine.deleteStrategy(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post("/api/strategies/:id/start", (c) => {
    const { strategyEngine } = require("../crypto-hub/strategies/engine");
    strategyEngine.startStrategy(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post("/api/strategies/:id/pause", (c) => {
    const { strategyEngine } = require("../crypto-hub/strategies/engine");
    strategyEngine.pauseStrategy(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.get("/api/strategies/:id/history", (c) => {
    const { strategyEngine } = require("../crypto-hub/strategies/engine");
    return c.json(strategyEngine.getTradeHistory(c.req.param("id")));
  });

  // ─── Risk Endpoints ──────────────────────────────────────
  app.post("/api/risk/score", async (c) => {
    try {
      const { riskScorer } = await import("../crypto-hub/risk/scorer");
      const body = await c.req.json();
      const result = await riskScorer.calculateRisk(body.positions || []);
      return c.json(result);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // ─── TradingView Widget Config ──────────────────────────
  app.get("/api/tradingview/url", (c) => {
    const { TradingViewConfig } = require("../crypto-hub/charts/tradingview");
    const symbol = c.req.query("symbol") || "BINANCE:BTCUSDT";
    const preset = c.req.query("preset") || "tradingView";
    const config = { ...TradingViewConfig.getPreset(preset), symbol };
    return c.json({ url: TradingViewConfig.getWidgetUrl(config) });
  });

  return app;
}
