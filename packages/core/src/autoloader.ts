/**
 * Module Auto-Loader — skanuje katalogi i automatycznie podpina moduły
 *
 * Agent może stworzyć plik w monitored/ lub safety/ i system go podniesie BEZ
 * ręcznego edytowania main.ts czy runner.ts.
 *
 * Konwencja:
 *   - monitored/<nazwa>.ts → auto-import w main.ts
 *   - safety/<nazwa>.ts    → auto-import w runner.ts (jeśli exportuje registerTool)
 *   - plugin/<nazwa>.ts    → auto-import w main.ts (jeśli exportuje init)
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = process.cwd();

interface AutoModule {
  name: string;
  path: string;
  type: "monitored" | "safety" | "plugin";
}

/**
 * Znajduje wszystkie moduły w monitorowanych katalogach
 */
export function findAutoModules(): AutoModule[] {
  const modules: AutoModule[] = [];
  const dirs = [
    { path: join(BASE, "packages", "core", "src", "monitored"), type: "monitored" as const },
    { path: join(BASE, "packages", "core", "src", "safety"), type: "safety" as const },
  ];

  for (const dir of dirs) {
    if (!existsSync(dir.path)) continue;
    for (const entry of readdirSync(dir.path)) {
      if (!entry.endsWith(".ts") || entry.endsWith(".d.ts")) continue;
      const fullPath = join(dir.path, entry);
      if (statSync(fullPath).isFile()) {
        modules.push({
          name: entry.replace(/\.ts$/, ""),
          path: fullPath,
          type: dir.type,
        });
      }
    }
  }
  return modules;
}

/**
 * Sprawdza czy plik zawiera określony export
 */
export function hasExport(filePath: string, exportName: string): boolean {
  try {
    const content = require("fs").readFileSync(filePath, "utf-8");
    return content.includes(`export ${exportName}`) ||
           content.includes(`export const ${exportName}`) ||
           content.includes(`export function ${exportName}`) ||
           content.includes(`export class ${exportName}`);
  } catch {
    return false;
  }
}

/**
 * Dynamicznie importuje wszystkie moduły z katalogu
 * Zwraca listę zaimportowanych nazw
 */
export async function loadModules(dir: string): Promise<string[]> {
  const loaded: string[] = [];
  const fullDir = join(BASE, "packages", "core", "src", dir);
  if (!existsSync(fullDir)) return loaded;

  for (const entry of readdirSync(fullDir)) {
    if (!entry.endsWith(".ts") || entry.endsWith(".d.ts")) continue;
    const fullPath = join(fullDir, entry);
    if (!statSync(fullPath).isFile()) continue;

    try {
      // Dynamic import — Bun rozwiąże ścieżkę względem projektu
      const relPath = `./${dir}/${entry.replace(/\.ts$/, "")}`;
      await import(relPath);
      loaded.push(entry);
    } catch (e) {
      console.warn(`[AutoLoader] Failed to load ${entry}: ${e}`);
    }
  }
  return loaded;
}
