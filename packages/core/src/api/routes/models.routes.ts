import { Hono } from "hono";
import { registry } from "../../plugin/registry.ts";
import { getAllProviderConfigs } from "../../config/provider-config.ts";

export function register(app: Hono): void {
  // Models
  app.get("/v1/models", (c) => c.json({ object: "list", data: registry.listModels().map((m) => ({ id: m.ref, object: "model", owned_by: m.providerId })) }));

  // Grouped models — filtered by configured providers only
  app.get("/api/models/grouped", (c) => {
    const providerConfigsList = getAllProviderConfigs();
    const configuredMap = new Map<string, any>();
    for (const p of providerConfigsList) configuredMap.set(p.providerId, p);

    const grouped: Record<string, { name: string; hasApiKey: boolean; models: { id: string; name: string }[] }> = {};
    for (const [id, provider] of registry.providers) {
      const configEntry = configuredMap.get(id);
      const hasApiKey = configEntry?.hasApiKey === true;
      const enabled = configEntry?.enabled !== false;

      if (!hasApiKey && id !== "ollama" && id !== "lmstudio" && id !== "custom") continue;
      if (!enabled) continue;

      grouped[id] = {
        name: provider.name,
        hasApiKey,
        models: provider.models.map(m => ({ id: `${id}/${m.id}`, name: m.name || m.id })),
      };
    }
    return c.json({ grouped });
  });
}
