import type { ProviderPlugin, ModelDef, ChannelPlugin } from "@nova/sdk";

class PluginRegistry {
  providers = new Map<string, ProviderPlugin>();
  channels = new Map<string, ChannelPlugin>();
  models = new Map<string, { providerId: string; model: ModelDef }>();

  registerProvider(p: ProviderPlugin): void {
    this.providers.set(p.id, p);
    for (const m of p.models) {
      const key = `${p.id}/${m.id}`;
      this.models.set(key, { providerId: p.id, model: m });
      this.models.set(m.id, { providerId: p.id, model: m });
    }
  }

  registerChannel(c: ChannelPlugin): void {
    this.channels.set(c.id, c);
  }

  getProvider(id: string): ProviderPlugin | undefined {
    return this.providers.get(id);
  }

  resolveModel(ref: string): { providerId: string; provider: ProviderPlugin; model: ModelDef } | undefined {
    const entry = this.models.get(ref);
    if (!entry) return undefined;
    const provider = this.providers.get(entry.providerId);
    if (!provider) return undefined;
    return { providerId: entry.providerId, provider, model: entry.model };
  }

  listModels(): Array<{ ref: string; providerId: string; model: ModelDef }> {
    return [...this.models.entries()]
      .filter(([k]) => k.includes("/"))
      .map(([k, v]) => ({ ref: k, providerId: v.providerId, model: v.model }));
  }
}

export const registry = new PluginRegistry();
