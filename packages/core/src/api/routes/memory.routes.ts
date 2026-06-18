import { Hono } from "hono";
import { memoryStore } from "../../memory/store.ts";

export function register(app: Hono): void {
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
}
