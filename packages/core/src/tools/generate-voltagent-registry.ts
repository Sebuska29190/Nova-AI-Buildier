#!/usr/bin/env bun
/**
 * Generates community-agents-voltagent.ts — LIGHT version
 * Prompts loaded from agent directories at runtime, not inlined
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const AGENTS_DIR = join(process.cwd(), "packages", "core", "agents");
const OUTPUT = join(process.cwd(), "packages", "core", "src", "agent", "community-agents-voltagent.ts");

const NATIVE = new Set([
  "auto-coder", "code-reviewer", "security-auditor", "tester",
  "data-analyst", "devops-engineer", "documentation-writer",
  "project-manager", "research-assistant", "paper-writer",
  "auditor", "auto-bug-fixer", "default",
]);

const dirs = readdirSync(AGENTS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && !NATIVE.has(d.name))
  .map(d => d.name);

const EMOJI: Record<string, string> = {
  "01-core-development": "💻", "02-language-specialists": "🔤",
  "03-infrastructure": "☁️", "04-quality-security": "🔒",
  "05-data-ai": "📊", "06-developer-experience": "🛠️",
  "09-meta-orchestration": "🎯",
};

const entries: string[] = [];

for (const dir of dirs) {
  const path = join(AGENTS_DIR, dir, "AGENTS.md");
  if (!existsSync(path)) continue;
  
  const c = readFileSync(path, "utf-8");
  const name = (c.match(/^# (.+)$/m) || ["", dir])[1].trim();
  const goal = (c.match(/## Goal\n\n(.+?)(?:\n|$)/) || ["", "Specialized agent"])[1].trim().slice(0, 120);
  const skillsM = c.match(/## Skills\n\n([\s\S]*?)(?:\n##|$)/);
  let skills = ["workspace_read_file", "workspace_list_files", "agent_memory_save"];
  if (skillsM) skills = skillsM[1].split("\n").filter(l => l.startsWith("- `")).map(l => l.replace(/^- `|`$/g, "").trim()).filter(Boolean);
  
  const catM = c.match(/## Category\n\n(.+?) /);
  const cat = catM ? catM[1].trim() : "imported";
  const emoji = EMOJI[cat] || "🤖";
  
  entries.push(`  { id: "${dir}", name: "${name.replace(/"/g, '\\"')}", description: "${goal.replace(/"/g, '\\"')}", emoji: "${emoji}", modelRef: "deepseek/deepseek-chat", skills: [${skills.map(s => `"${s}"`).join(", ")}], status: "ready" },`);
}

const output = `/**
 * Community Agents — VoltAgent Imports (${entries.length} agents)
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
  return \`You are \${agentId}, a specialized AI agent.\`;
}

export const VOLTAGENT_AGENTS: AgentConfig[] = [
${entries.join("\n\n")}
];

export function seedVoltAgentAgents(agentStore: any): number {
  let count = 0;
  for (const agent of VOLTAGENT_AGENTS) {
    if (!agentStore.get(agent.id)) {
      agentStore.create({ ...agent, systemPrompt: loadPrompt(agent.id) });
      count++;
    }
  }
  if (count > 0) console.log(\`  ✓ \${count} VoltAgent community agents seeded\`);
  return count;
}
`;

writeFileSync(OUTPUT, output, "utf-8");
const size = Buffer.byteLength(output, "utf-8");
console.log(`✅ ${entries.length} agents → ${(size/1024).toFixed(1)} KB`);
