import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { registry } from "../../plugin/registry.ts";
import { sessionManager } from "../../session/manager.ts";
import { agentStore } from "../../agent/store.ts";
import { runAgent } from "../../agent/runner.ts";
import { onEvent, emitEvent } from "../../event-bus/index.ts";
import { qualityScorer } from "../../agent/scoring.ts";
import { capabilityRegistry } from "../../agent/router.ts";
import { learningLoop } from "../../agent/learning.ts";
import { agentScheduler } from "../../agent/scheduler.ts";

export function register(app: Hono): void {
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
      const { workspaceManager } = await import("../../workspace/manager.ts");
      workspaceManager.setRoot(body.path);
      return c.json({ status: "ok", workspace: body.path });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // --- Agent Memory ------------------------------------------
  app.get("/api/agents/:id/memory", async (c) => {
    try {
      const { agentMemory } = await import("../../agent/memory.ts");
      const type = c.req.query("type") as any;
      const query = c.req.query("q");
      const memories = agentMemory.search(c.req.param("id"), query, type, undefined, 100);
      return c.json({ memories, total: agentMemory.count(c.req.param("id")) });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.post("/api/agents/:id/memory", async (c) => {
    try {
      const { agentMemory } = await import("../../agent/memory.ts");
      const body = await c.req.json<{ content: string; type: string; importance?: number; tags?: string }>();
      if (!body.content || !body.type) return c.json({ error: "content and type required" }, 400);
      const memory = agentMemory.add(c.req.param("id"), body.type as any, body.content, (body.importance || 3) as any, (body.tags || "").split(",").map((t) => t.trim()).filter(Boolean));
      return c.json({ memory }, 201);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.delete("/api/agents/:id/memory/:memoryId", async (c) => {
    try {
      const { agentMemory } = await import("../../agent/memory.ts");
      return c.json({ deleted: agentMemory.forget(c.req.param("memoryId")) });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.delete("/api/agents/:id/memory", async (c) => {
    try {
      const { agentMemory } = await import("../../agent/memory.ts");
      const count = agentMemory.forgetByAgent(c.req.param("id"));
      return c.json({ deleted: count });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.delete("/api/agents/:id", (c) => {
    const ok = agentStore.delete(c.req.param("id"));
    if (!ok) return c.json({ error: "Agent not found" }, 404);
    return c.json({ status: "deleted" });
  });

  // ─── Agent Work Viewer SSE — live agent execution events ──────
  app.get("/api/agents/runs/:runId/events", (c) => {
    const runId = c.req.param("runId");
    const controller = new AbortController();

    const stream = new ReadableStream({
      start(ctrl) {
        const unsubEvent = onEvent("event", (e) => {
          if ((e as any).runId !== runId) return;
          try {
            const data = JSON.stringify({ type: (e as any).kind, data: (e as any).data, ts: Date.now() });
            ctrl.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
          } catch {}
        });
        const unsubDone = onEvent("done", (e: any) => {
          if (e.runId !== runId) return;
          try {
            ctrl.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "done", ts: Date.now() })}\n\n`));
            ctrl.close();
          } catch {}
        });
        const unsubErr = onEvent("error", (e: any) => {
          if (e.runId !== runId) return;
          try {
            ctrl.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "error", error: e.message, ts: Date.now() })}\n\n`));
            ctrl.close();
          } catch {}
        });
        controller.signal.addEventListener("abort", () => {
          unsubEvent(); unsubDone(); unsubErr();
          try { ctrl.close(); } catch {}
        }, { once: true });
      },
      cancel() { controller.abort(); },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  // ─── Agent Run Status ─────────────────────────────────────────
  app.get("/api/agents/runs/:runId/status", (c) => {
    const runId = c.req.param("runId");
    const job = agentScheduler.getJob(runId);
    return c.json({
      runId,
      status: job?.status || "unknown",
      startTime: job?.startedAt || null,
      toolCount: job?.toolCount || 0,
      iteration: job?.iteration || 0,
    });
  });

  // ─── Agent Memory — persistent run history & learning ─────────
  app.get("/api/agents/:id/runs/history", (c) => {
    try {
      const agentId = c.req.param("id");
      const { agentMemory } = require("../../agent/memory.ts");
      const entries = agentMemory.getEntries(agentId);
      return c.json({ runs: entries });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.post("/api/agents/:id/learn", async (c) => {
    try {
      const agentId = c.req.param("id");
      const body = await c.req.json<{ insight: string; category?: string }>();
      const { agentMemory } = require("../../agent/memory.ts");
      agentMemory.recordInsight(agentId, body.insight, body.category || "manual");
      return c.json({ status: "recorded" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // ─── Agent Steer — mid-execution intervention ─────────────────
  app.post("/api/agents/runs/:runId/steer", async (c) => {
    try {
      const runId = c.req.param("runId");
      const body = await c.req.json<{ message: string }>();
      if (!body.message?.trim()) return c.json({ error: "message required" }, 400);

      const job = agentScheduler.getJob(runId);
      if (!job) return c.json({ error: "Run not found" }, 404);
      if (job.status !== "running") return c.json({ error: `Run is ${job.status}, not running` }, 400);

      // Inject message into session — agent picks it up on next iteration
      sessionManager.append(job.sessionId, "user", `[STEER from operator] ${body.message.trim()}`);
      emitEvent({ type: "event", kind: "message", sessionId: job.sessionId, runId, data: { text: `Steer injected: ${body.message}` } });

      return c.json({ status: "steered", runId });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // ─── Agent Stop (force) ───────────────────────────────────────
  app.post("/api/agents/runs/:runId/stop", async (c) => {
    try {
      const runId = c.req.param("runId");
      const job = agentScheduler.getJob(runId);
      if (!job) return c.json({ error: "Run not found" }, 404);

      const ok = await agentScheduler.stopRun(runId);
      return c.json({ status: ok ? "stopped" : "already_stopped", runId });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // ─── Agent Runs List (all background runs) ────────────────────
  app.get("/api/agents/runs", (c) => {
    try {
      const jobs = agentScheduler.listJobs();
      return c.json({ runs: jobs });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // ─── Agent Quality Scoring ────────────────────────────────────
  app.get("/api/agents/:id/score", (c) => {
    const score = qualityScorer.get(c.req.param("id"));
    const badge = qualityScorer.getTrustBadge(c.req.param("id"));
    return c.json({ score, badge });
  });

  app.get("/api/agents/scores", (c) => {
    const scores = qualityScorer.listByTrust();
    return c.json({ scores });
  });

  // ─── Smart Agent Router — auto-select best agent for task ─────
  app.post("/api/agents/match", async (c) => {
    try {
      const body = await c.req.json<{ task: string; topK?: number }>();
      if (!body.task?.trim()) return c.json({ error: "task required" }, 400);
      capabilityRegistry.build(); // Refresh index
      const matches = capabilityRegistry.match(body.task, body.topK || 5);
      return c.json({ matches });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.get("/api/agents/capabilities", (c) => {
    capabilityRegistry.build();
    return c.json({ capabilities: capabilityRegistry.list() });
  });

  // ─── Learning Loop — remediation history ────────────────────
  app.get("/api/agents/:id/learning", (c) => {
    const history = learningLoop.getHistory(c.req.param("id"));
    return c.json({ agentId: c.req.param("id"), corrections: history });
  });

  app.post("/api/agents/:id/remediate", async (c) => {
    learningLoop.apply(c.req.param("id"));
    return c.json({ status: "remediated", agentId: c.req.param("id") });
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

  // Agent task endpoint — wysyla zadanie do konkretnego agenta
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
}
