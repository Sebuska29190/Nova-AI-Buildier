import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { join, dirname } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { uploadSession, listSessions as listGistSessions } from "../../cloud-save/gist.ts";
import { research, listSources } from "../../research/engine.ts";
import { subscribe as monSubscribe, listSubscriptions, unsubscribe as monUnsubscribe } from "../../monitor/scheduler.ts";
import { brainstorm } from "../../brainstorm/engine.ts";
import { runTerminal } from "../../gateway/routes-terminal.ts";
import { knowledgeBase } from "../../knowledge/store.ts";
import { runAutoBugFixer } from "../../agent/auto-bug-fixer.ts";
import { workspaceManager } from "../../workspace/manager.ts";
import { kernel, agentFS, ledger } from "../../kernel/index.ts";
import { tmuxAvailable, listSessions as tmuxListSessions, createSession as tmuxCreateSession, killSession as tmuxKillSession, sendKeys as tmuxSendKeys, capturePane as tmuxCapturePane, getStatus as tmuxGetStatus } from "../../tmux/tools.ts";

export function register(app: Hono): void {
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

  // Trading routes removed in Nexus AI v2.0

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

  // --- Workspace ----------------------------------------------------------
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
    const files = workspaceManager.listFiles(c.req.query("dir") || "", { maxDepth: parseInt(c.req.query("depth") || "3") });
    return c.json({ files: files.map((f: any) => f.path) });
  });
  app.post("/api/workspace/clear", (c) => {
    workspaceManager.clear();
    return c.json({ status: "cleared" });
  });

  // --- Kernel -------------------------------------------------------------
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

  // --- Research Sources ---------------------------------------------------
  app.get("/api/research/sources", (c) => c.json({ sources: listSources() }));

  // --- Tmux ---------------------------------------------------------------
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
}
