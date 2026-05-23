// Plugin loader — discovers and loads plugins from filesystem
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PluginManifest } from "@nova/sdk";

export interface PluginEntry {
  id: string; path: string;
  manifest?: PluginManifest;
  enabled: boolean;
}

const PLUGIN_DIRS = [
  join(process.cwd(), "plugins"),
  join(process.cwd(), "packages"),
];

export function discoverPlugins(): PluginEntry[] {
  const plugins: PluginEntry[] = [];

  for (const dir of PLUGIN_DIRS) {
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pluginJsonPath = join(dir, entry.name, "nova.plugin.json");
      const pkgJsonPath = join(dir, entry.name, "package.json");

      if (existsSync(pluginJsonPath)) {
        try {
          const manifest = JSON.parse(require("fs").readFileSync(pluginJsonPath, "utf-8")) as PluginManifest;
          plugins.push({ id: entry.name, path: join(dir, entry.name), manifest, enabled: true });
        } catch {}
      } else if (existsSync(pkgJsonPath)) {
        try {
          const pkg = JSON.parse(require("fs").readFileSync(pkgJsonPath, "utf-8"));
          if (pkg?.nova?.plugin) {
            plugins.push({ id: entry.name, path: join(dir, entry.name), manifest: pkg.nova, enabled: true });
          }
        } catch {}
      }
    }
  }

  return plugins;
}
