import { Hono } from "hono";
import { sessionManager } from "../../session/manager.ts";
import { listTools } from "../../plugin/tools.ts";

export function register(app: Hono): void {
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

  // Tool activity for a session
  app.get("/api/sessions/:id/tools", (c) => {
    const id = c.req.param("id");
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const activity = sessionManager.getToolActivity(id, limit);
    return c.json({ activity, count: activity.length });
  });

  // Agent session state
  app.get("/api/sessions/:id/state", (c) => {
    const state = sessionManager.getSessionState(c.req.param("id"));
    return c.json({ state });
  });

  app.delete("/api/sessions/:id", (c) => {
    const ok = sessionManager.deleteSession(c.req.param("id"));
    return c.json({ deleted: ok });
  });

  // Tools
  app.get("/api/tools", (c) => c.json({ tools: listTools().map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }));
}
