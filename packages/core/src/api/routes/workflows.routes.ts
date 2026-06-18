import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { workflowEngine } from "../../workflow/engine.ts";
import { usageTracker } from "../../monitor/usage.ts";

export function register(app: Hono): void {
  // --- Workflows ----------------------------------------------
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

  // --- Monitoring ----------------------------------------------
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
      const { toolAudit } = await import("../../safety/tool-audit.ts");
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
      const { toolAudit } = await import("../../safety/tool-audit.ts");
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
}
