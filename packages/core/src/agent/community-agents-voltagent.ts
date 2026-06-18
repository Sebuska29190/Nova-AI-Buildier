/**
 * Community Agents — VoltAgent Imports (112 agents)
 * Agent definitions loaded from voltagent-agents.json
 * System prompts loaded from packages/core/agents/{id}/AGENTS.md at seed time
 * Source: https://github.com/VoltAgent/awesome-claude-code-subagents
 */

import type { AgentConfig } from "./store.ts";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Read system prompt from agent directory */
function loadPrompt(agentId: string): string {
  try {
    const p = join(import.meta.dirname || process.cwd(), "..", "..", "agents", agentId, "AGENTS.md");
    if (existsSync(p)) return readFileSync(p, "utf-8");
    // Fallback for packaged paths
    const p2 = join(process.cwd(), "packages", "core", "agents", agentId, "AGENTS.md");
    if (existsSync(p2)) return readFileSync(p2, "utf-8");
  } catch {}
  return `You are ${agentId}, a specialized AI agent.`;
}

/** Load agent definitions from JSON file */
function loadAgentsFromJson(): AgentConfig[] {
  try {
    const jsonPath = join(import.meta.dirname || process.cwd(), "voltagent-agents.json");
    const raw = readFileSync(jsonPath, "utf-8");
    return JSON.parse(raw) as AgentConfig[];
  } catch {
    // Fallback: try from packages/core/src/agent/
    try {
      const jsonPath2 = join(process.cwd(), "packages", "core", "src", "agent", "voltagent-agents.json");
      const raw = readFileSync(jsonPath2, "utf-8");
      return JSON.parse(raw) as AgentConfig[];
    } catch {
      console.warn("  ⚠ Could not load voltagent-agents.json — no VoltAgent agents available");
      return [];
    }
  }
}

export const VOLTAGENT_AGENTS: AgentConfig[] = loadAgentsFromJson();

export function seedVoltAgentAgents(agentStore: any): number {
  let count = 0;
  for (const agent of VOLTAGENT_AGENTS) {
    if (agentStore.get(agent.id)) continue;
    try {
      agentStore.create({ ...agent, systemPrompt: loadPrompt(agent.id) });
      count++;
    } catch (e: any) {
      // Skip SQLite UNIQUE constraint (already seeded by another path)
      if (!e.message?.includes("UNIQUE constraint")) console.warn(`  ⚠ VoltAgent seed skip: ${agent.id} — ${e.message}`);
    }
  }
  if (count > 0) console.log(`  ✓ ${count} VoltAgent community agents seeded`);
  return count;
}
