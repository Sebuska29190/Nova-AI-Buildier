#!/usr/bin/env bun
/**
 * VoltAgent Subagent Importer — converts Claude Code .md agents → Nexus AI agents
 * Fetches from: https://github.com/VoltAgent/awesome-claude-code-subagents
 * 
 * Usage: bun run packages/core/src/tools/import-voltagent-agents.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const REPO_RAW = "https://raw.githubusercontent.com/VoltAgent/awesome-claude-code-subagents/main";
const AGENTS_DIR = join(process.cwd(), "packages", "core", "agents");
const CATEGORIES_DIR = "categories";

// Agents we already have in Nexus (skip these)
const EXISTING_AGENTS = new Set([
  "auto-coder", "code-reviewer", "security-auditor", "tester",
  "data-analyst", "devops-engineer", "documentation-writer",
  "project-manager", "research-assistant", "paper-writer",
  "auditor", "auto-bug-fixer", "default",
]);

// Category → URL path mapping (all 10 categories)
const CATEGORIES: Record<string, string> = {
  "01-core-development": "01-core-development",
  "02-language-specialists": "02-language-specialists",
  "03-infrastructure": "03-infrastructure",
  "04-quality-security": "04-quality-security",
  "05-data-ai": "05-data-ai",
  "06-developer-experience": "06-developer-experience",
  "07-mobile": "07-mobile",
  "08-web-graphics": "08-web-graphics",
  "09-meta-orchestration": "09-meta-orchestration",
  "10-specialized-domains": "10-specialized-domains",
};

// Mapping: VoltAgent agent name → Nexus agent ID
function agentId(name: string): string {
  return name.replace(/[_\s]+/g, "-").replace(/[^a-z0-9-]/g, "").toLowerCase();
}

// Claude tools → Nexus tools
const TOOL_MAP: Record<string, string> = {
  "Read": "workspace_read_file",
  "Write": "workspace_write_file", 
  "Edit": "workspace_edit_file",
  "Bash": "bash_exec",
  "Glob": "workspace_list_files",
  "Grep": "search_files_content",
};

function mapTools(claudeTools: string[]): string[] {
  const nexus: string[] = [];
  for (const t of claudeTools) {
    const mapped = TOOL_MAP[t.trim()] || t.trim();
    if (!nexus.includes(mapped)) nexus.push(mapped);
  }
  // Add essential tools
  const essentials = ["workspace_read_file", "workspace_list_files", "agent_memory_save", "agent_memory_search"];
  for (const e of essentials) {
    if (!nexus.includes(e)) nexus.push(e);
  }
  return nexus;
}

interface AgentMeta {
  name: string;
  description: string;
  tools: string;
  model: string;
  category: string;
}

function parseFrontmatter(content: string): AgentMeta | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  
  const frontmatter: Record<string, string> = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) frontmatter[kv[1]] = kv[2].trim().replace(/^"|"$/g, "");
  }
  
  return {
    name: frontmatter.name || "",
    description: frontmatter.description || "",
    tools: frontmatter.tools || "Read, Write, Edit, Bash, Glob, Grep",
    model: frontmatter.model || "sonnet",
    category: frontmatter.category || "imported",
  };
}

async function fetchAgentFiles(): Promise<Map<string, { meta: AgentMeta; systemPrompt: string; category: string }>> {
  const agents = new Map<string, { meta: AgentMeta; systemPrompt: string; category: string }>();
  
  for (const [catDir, catName] of Object.entries(CATEGORIES)) {
    console.log(`  📂 Fetching ${catName}...`);
    
    try {
      // Fetch the category index (GitHub API)
      const apiUrl = `https://api.github.com/repos/VoltAgent/awesome-claude-code-subagents/contents/categories/${catDir}`;
      const resp = await fetch(apiUrl, {
        headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "Nexus-AI-Importer" },
      });
      
      if (!resp.ok) {
        console.log(`    ⚠️ HTTP ${resp.status} for ${catDir}, trying raw listing...`);
        continue;
      }
      
      const files: Array<{ name: string; download_url: string }> = await resp.json();
      
      for (const file of files) {
        if (!file.name.endsWith(".md") || file.name === "README.md") continue;
        
        const agentName = file.name.replace(".md", "");
        if (EXISTING_AGENTS.has(agentId(agentName))) {
          console.log(`    ⏭️ ${agentName} (already exists)`);
          continue;
        }
        
        try {
          const contentResp = await fetch(file.download_url);
          if (!contentResp.ok) { console.log(`    ⚠️ Failed to download ${agentName}`); continue; }
          
          const content = await contentResp.text();
          const meta = parseFrontmatter(content);
          if (!meta) { console.log(`    ⚠️ No frontmatter in ${agentName}`); continue; }
          
          const systemPrompt = content.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
          
          agents.set(agentName, { meta, systemPrompt, category: catName });
          console.log(`    ✅ ${agentName}`);
        } catch (e: any) {
          console.log(`    ❌ ${agentName}: ${e.message}`);
        }
      }
    } catch (e: any) {
      console.log(`  ❌ ${catName}: ${e.message}`);
    }
  }
  
  return agents;
}

function generateAgentFiles(
  agentName: string,
  meta: AgentMeta,
  systemPrompt: string,
  category: string,
): { agentsMd: string; soulMd: string; memoryMd: string } {
  const id = agentId(agentName);
  const tools = mapTools(meta.tools.split(","));
  const emoji = getEmoji(category);
  
  const agentsMd = `# ${meta.name}

## Goal

${meta.description}

## Skills

${tools.map(t => `- \`${t}\``).join("\n")}

## Model

\`${meta.model}\` → mapped to \`deepseek/deepseek-chat\`

## Category

${category} (imported from VoltAgent/awesome-claude-code-subagents)

---
${systemPrompt}
---

## ⚠️ CRITICAL: Anti-Hallucination Rules

1. Verify every claim with runtime evidence — run tests, read files, check actual output
2. Never fabricate bugs, imports, or file contents
3. If you cannot confirm something, say "I cannot verify this" instead of guessing
4. Before reporting a bug: read the full file, confirm it actually exists
5. Build succeeds = code is valid — do not claim broken imports when build passes
`;

  const soulMd = `# SOUL.md — ${meta.name}

You are **${meta.name}**, a specialized ${category} agent imported from the VoltAgent collection.

## Core Identity

${meta.description}

## How You Work

- Be thorough but efficient
- Verify before reporting
- Use the tools listed in your skills section
- Learn from each run and save insights to memory
`;

  const memoryMd = `# Agent Memory — ${meta.name}

Imported: ${new Date().toISOString()}
Source: VoltAgent/awesome-claude-code-subagents
Category: ${category}

## Initial State

Fresh import — no prior runs recorded.
`;

  return { agentsMd, soulMd, memoryMd };
}

function getEmoji(category: string): string {
  const map: Record<string, string> = {
    "01-core-development": "💻",
    "02-language-specialists": "🔤", 
    "03-infrastructure": "☁️",
    "04-quality-security": "🔒",
    "05-data-ai": "📊",
    "06-developer-experience": "🛠️",
    "07-mobile": "📱",
    "08-web-graphics": "🎨",
    "09-meta-orchestration": "🎯",
    "10-specialized-domains": "🏭",
  };
  return map[category] || "🤖";
}

async function generateCommunityAgentsEntry(agents: Map<string, { meta: AgentMeta; systemPrompt: string; category: string }>): Promise<string> {
  const entries: string[] = [];
  
  for (const [name, { meta, category }] of agents) {
    const id = agentId(name);
    const tools = mapTools(meta.tools.split(","));
    
    entries.push(`  // ── ${category} ──────────────────────────────────────────
  {
    id: "${id}",
    name: "${meta.name}",
    description: "${meta.description.replace(/"/g, '\\"').slice(0, 150)}",
    emoji: "${getEmoji(category)}",
    modelRef: "deepseek/deepseek-chat",
    systemPrompt: AUTO_IMPORTED_AGENTS["${id}"] || "",
    skills: [${tools.map(t => `"${t}"`).join(", ")}],
    status: "ready",
  },`);
  }
  
  return entries.join("\n");
}

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   VoltAgent Subagent Importer for Nexus  ║");
  console.log("╚══════════════════════════════════════════╝\n");
  
  // Fetch all agents
  const agents = await fetchAgentFiles();
  console.log(`\n  📦 Total new agents to import: ${agents.size}`);
  
  if (agents.size === 0) {
    console.log("  ✅ Nothing to import — all agents already exist.\n");
    return;
  }
  
  // Generate agent directories
  let imported = 0;
  for (const [name, { meta, systemPrompt, category }] of agents) {
    const id = agentId(name);
    const dir = join(AGENTS_DIR, id);
    
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    
    const { agentsMd, soulMd, memoryMd } = generateAgentFiles(name, meta, systemPrompt, category);
    
    writeFileSync(join(dir, "AGENTS.md"), agentsMd, "utf-8");
    writeFileSync(join(dir, "SOUL.md"), soulMd, "utf-8");
    writeFileSync(join(dir, "MEMORY.md"), memoryMd, "utf-8");
    imported++;
  }
  
  console.log(`  ✅ Generated ${imported} agent directories`);
  
  // Generate community-agents entries snippet
  const entry = await generateCommunityAgentsEntry(agents);
  const snippetPath = join(process.cwd(), "packages", "core", "src", "tools", "_voltagent-agents-snippet.ts");
  writeFileSync(snippetPath, `// Auto-generated by voltagent-importer\n// Copy relevant entries into community-agents.ts\n\nexport const VOLTAGENT_IMPORTS = {\n${entry}\n};\n`, "utf-8");
  console.log(`  ✅ Snippet written to: tools/_voltagent-agents-snippet.ts`);
  
  console.log("\n  🎉 Import complete!\n");
}

main().catch(console.error);
