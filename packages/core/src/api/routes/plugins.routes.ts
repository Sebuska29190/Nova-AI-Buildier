import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { listCommunityPlugins, getCommunityPlugin, installPlugin, uninstallPlugin, getPluginConfig, savePluginConfig } from "../../plugin/community-plugins.ts";
import { getAllProviderConfigs, saveProviderConfig, deleteProviderConfig, testProviderConnection } from "../../config/provider-config.ts";
import { registry } from "../../plugin/registry.ts";

export function register(app: Hono): void {
  // --- Plugins --------------------------------------------------------------
  app.get("/api/plugins", (c) => c.json({ plugins: listCommunityPlugins() }));
  app.get("/api/plugins/:id", (c) => {
    const plugin = getCommunityPlugin(c.req.param("id"));
    if (!plugin) return c.json({ error: "Plugin not found" }, 404);
    return c.json({ plugin });
  });
  app.post("/api/plugins/:id/install", async (c) => {
    const result = await installPlugin(c.req.param("id"));
    if (!result.success) return c.json({ error: result.error, log: result.log }, 400);
    return c.json({ status: "installed", path: result.path, log: result.log });
  });
  app.post("/api/plugins/:id/uninstall", async (c) => {
    const result = await uninstallPlugin(c.req.param("id"));
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ status: "uninstalled" });
  });
  app.get("/api/plugins/:id/config", (c) => {
    try { return c.json({ config: getPluginConfig(c.req.param("id")) }); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });
  app.post("/api/plugins/:id/config", async (c) => {
    try {
      const body = await c.req.json<Record<string, string>>();
      savePluginConfig(c.req.param("id"), body);
      return c.json({ status: "saved" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // --- Config / Provider API Keys --------------------------------------------
  app.get("/api/config/providers", (c) => {
    const providers = getAllProviderConfigs();
    return c.json({ providers });
  });

  app.post("/api/config/providers/:id", async (c) => {
    try {
      const providerId = c.req.param("id");
      const body = await c.req.json<{ apiKey?: string; baseUrl?: string; maxTokens?: number; thinkingLevel?: string; enabled?: boolean }>();
      const entry = saveProviderConfig(providerId, body);
      // Never send apiKey back to client
      const { apiKey, ...safe } = entry;
      return c.json({ status: "saved", provider: safe });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 400);
    }
  });

  app.delete("/api/config/providers/:id", (c) => {
    const providerId = c.req.param("id");
    const ok = deleteProviderConfig(providerId);
    if (!ok) return c.json({ error: "Provider not found" }, 404);
    return c.json({ status: "unbound" });
  });

  app.post("/api/config/providers/:id/test", async (c) => {
    try {
      const providerId = c.req.param("id");
      const body: any = await c.req.json().catch(() => ({}));
      const result = await testProviderConnection(providerId, body?.apiKey);
      return c.json(result);
    } catch (e: unknown) {
      return c.json({ ok: false, error: safeMessage(e) }, 400);
    }
  });

  app.post("/api/config/providers/refresh-models", (c) => {
    // Re-register providers with updated env vars by re-importing
    // The env vars are already set by saveProviderConfig, so providers
    // will pick them up on next stream call automatically.
    const models = registry.listModels();
    return c.json({ status: "ok", count: models.length, models });
  });
}
