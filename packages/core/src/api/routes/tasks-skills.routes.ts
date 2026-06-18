import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { createTask, listTasks, updateTask, deleteTask } from "../../task/store.ts";
import { loadSkills } from "../../skill/loader.ts";
import { spawnSubAgent } from "../../multi-agent/subagent.ts";
import { makeSnapshot, listSnapshots, rewindFiles } from "../../checkpoint/store.ts";

export function register(app: Hono): void {
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
}
