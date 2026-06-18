import { Hono } from "hono";
import { meshRouter, meshBus } from "../../agent-mesh/index.ts";

export function register(app: Hono): void {
  // --- Agent Mesh API ------------------------------------------
  app.get("/api/mesh/topology", (c) => c.json(meshRouter.getTopology()));
  
  app.get("/api/mesh/agents", (c) => c.json(meshRouter.getAllAgents()));
  
  app.get("/api/mesh/agents/:id", (c) => {
    const agent = meshRouter.getAgent(c.req.param("id"));
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    return c.json(agent);
  });

  app.post("/api/mesh/send", async (c) => {
    try {
      const body = await c.req.json<{ from: string; to: string; payload: unknown }>();
      const result = await meshRouter.send({
        id: crypto.randomUUID(),
        from: body.from,
        to: body.to,
        type: "request",
        payload: body.payload,
        timestamp: Date.now(),
      });
      return c.json({ success: true, result });
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
  });

  app.get("/api/mesh/events", (c) => {
    const limit = parseInt(c.req.query("limit") || "50");
    return c.json(meshBus.getHistory(limit));
  });

  app.get("/api/mesh/stats", (c) => c.json({
    totalAgents: meshRouter.getAllAgents().length,
    onlineAgents: meshRouter.getOnlineCount(),
    topology: meshRouter.getTopology().routes.length,
  }));
}
