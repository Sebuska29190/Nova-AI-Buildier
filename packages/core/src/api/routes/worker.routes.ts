import { Hono } from "hono";
import { getWorkJobs, getWorkJob, createWorkJob, cancelWorkJob, deleteWorkJob, subscribeSSE } from "../../worker/manager.ts";

export function register(app: Hono): void {
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
}
