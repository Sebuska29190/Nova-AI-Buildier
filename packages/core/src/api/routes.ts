import { Hono } from "hono";
import { cors } from "hono/cors";
import { registerRoutes } from "./routes/middleware.ts";
import { register as registerAuth } from "./routes/auth.routes.ts";
import { register as registerModels } from "./routes/models.routes.ts";
import { register as registerChat } from "./routes/chat.routes.ts";
import { register as registerSessions } from "./routes/sessions.routes.ts";
import { register as registerAgents } from "./routes/agents.routes.ts";
import { register as registerChambers } from "./routes/chambers.routes.ts";
import { register as registerWorkflows } from "./routes/workflows.routes.ts";
import { register as registerChannels } from "./routes/channels.routes.ts";
import { register as registerMemory } from "./routes/memory.routes.ts";
import { register as registerWorker } from "./routes/worker.routes.ts";
import { register as registerTasksSkills } from "./routes/tasks-skills.routes.ts";
import { register as registerSystem } from "./routes/system.routes.ts";
import { register as registerPlugins } from "./routes/plugins.routes.ts";
import { register as registerConfig } from "./routes/config.routes.ts";
import { register as registerCrypto } from "./routes/crypto.routes.ts";
import { register as registerIntegrations } from "./routes/integrations.routes.ts";
import { register as registerRag } from "./routes/rag.routes.ts";
import { register as registerCron } from "./routes/cron.routes.ts";
import { register as registerCryptoHub } from "./routes/crypto-hub.routes.ts";
import { register as registerTrading } from "./routes/trading.routes.ts";
import { register as registerMesh } from "./routes/mesh.routes.ts";
import { register as registerAnalytics } from "./routes/analytics.routes.ts";

export function createRouter(): Hono {
  const app = new Hono();
  app.use("*", cors({
    origin: process.env.NOVA_CORS_ORIGIN || "http://localhost:4123",
  }));

  // Register middleware (auth, security headers)
  registerRoutes(app);

  // Register all route modules
  registerAuth(app);
  registerModels(app);
  registerChat(app);
  registerSessions(app);
  registerAgents(app);
  registerChambers(app);
  registerWorkflows(app);
  registerChannels(app);
  registerMemory(app);
  registerWorker(app);
  registerTasksSkills(app);
  registerSystem(app);
  registerPlugins(app);
  registerConfig(app);
  registerCrypto(app);
  registerIntegrations(app);
  registerRag(app);
  registerCron(app);
  registerCryptoHub(app);
  registerTrading(app);
  registerMesh(app);
  registerAnalytics(app);

  app.onError((err, c) => {
    console.error("Error:", err);
    return c.json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  });

  return app;
}
