// Prompt system — hierarchical prompt assembly (1:1 z CheetahClaws)
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_DIR = join(import.meta.dir, "..", "prompts");

export function buildSystemPrompt(provider?: string, modelId?: string): string {
  const parts: string[] = [];

  // Base prompt
  parts.push(loadPrompt("base/default.md") || loadPrompt("default.md") || "You are a helpful AI assistant.");

  // Model-family overlay
  if (provider) {
    const overlay = loadPrompt(`overlays/${provider}.md`);
    if (overlay) parts.push(overlay);
  }

  return parts.join("\n\n");
}

function loadPrompt(name: string): string | null {
  const paths = [join(PROMPTS_DIR, name), join(process.cwd(), "prompts", name), join(process.cwd(), "packages", "core", "prompts", name)];
  for (const p of paths) {
    if (existsSync(p)) return readFileSync(p, "utf-8");
  }
  return null;
}
