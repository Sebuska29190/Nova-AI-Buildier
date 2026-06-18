import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { chamberManager } from "../../multi-agent/chamber.ts";

export function register(app: Hono): void {
  // --- Agent Chambers ------------------------------------------
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
      const body = await c.req.json<{ name: string; task: string; agents: { agentId: string; role: string; order: number }[]; maxRounds?: number; executionMode?: string; workspace?: string }>();
      if (!body.name || !body.task || !body.agents?.length) return c.json({ error: "name, task, and agents required" }, 400);
      const validAgents = body.agents.filter(a => a.agentId && a.agentId.trim()).map((a, i) => ({ ...a, order: i }));
      if (validAgents.length === 0) return c.json({ error: "No valid agents selected" }, 400);
      const chamber = chamberManager.create(body.name, body.task, validAgents, body.maxRounds, body.executionMode, body.workspace);
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

  app.put("/api/chambers/:id", async (c) => {
    try {
      const body = await c.req.json();
      const ok = chamberManager.update(c.req.param("id"), body);
      return ok ? c.json({ ok: true }) : c.json({ error: "Cannot update (running or not found)" }, 400);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.post("/api/chambers/:id/restart", (c) => {
    try {
      const ok = chamberManager.restart(c.req.param("id"));
      return c.json({ restarted: ok });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.get("/api/chambers/:id/analytics", (c) => {
    try {
      const analytics = chamberManager.getAnalytics(c.req.param("id"));
      return analytics ? c.json(analytics) : c.json({ error: "Not found" }, 404);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  // --- Chambers SSE (real-time updates) -----------------
  app.get("/api/chambers/:id/events", (c) => {
    const chamberId = c.req.param("id");
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");

    // Poll for new messages every 2 seconds
    let lastMsgCount = 0;
    const interval = setInterval(async () => {
      try {
        const chamber = chamberManager.get(chamberId);
        if (!chamber) { clearInterval(interval); return; }
        const messages = chamberManager.getMessages(chamberId, 500);
        if (messages.length > lastMsgCount) {
          const newMsgs = messages.slice(lastMsgCount);
          lastMsgCount = messages.length;
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "messages", messages: newMsgs, round: chamber.status === "running" ? messages.filter((m: any) => m.type === "message").length : -1 })}\n\n`));
        }
        if (chamber.status !== "running") {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "status", status: chamber.status })}\n\n`));
          clearInterval(interval);
          await writer.close();
        }
      } catch { clearInterval(interval); }
    }, 2000);

    // Cleanup on disconnect
    c.req.raw.signal?.addEventListener("abort", () => { clearInterval(interval); writer.close(); });

    return new Response(stream.readable, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  });
}
