import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { cronManager } from "../../cron/manager.ts";

export function register(app: Hono): void {
  // --- Cron ---------------------------------------------------------
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
        const { parseNaturalSchedule } = await import("../../cron/manager.ts");
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
}
