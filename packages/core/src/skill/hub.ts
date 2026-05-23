/**
 * Skill Hub — agentskills.io integration
 *
 * Publish/download skills from the global skill registry.
 * Skills are stored as SKILL.md files following the agentskills.io standard.
 *
 * Inspired by Hermes Agent skills_hub.py / skills_sync.py
 */

import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { registerTool } from "../plugin/tools.ts";
import { loadSkills } from "../skill/loader.ts";

const SKILLS_DIR = join(process.cwd(), "skills");
const HUB_API = "https://agentskills.io/api/v1";

if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true });

interface HubSkill {
  name: string;
  description: string;
  author: string;
  version: string;
  downloads: number;
  rating: number;
}

interface HubSearchResult {
  skills: HubSkill[];
  total: number;
}

async function apiGet(path: string): Promise<any> {
  const res = await fetch(`${HUB_API}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apiPost(path: string, body: any): Promise<any> {
  const res = await fetch(`${HUB_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Tools ─────────────────────────────────────────────────────

registerTool({
  name: "skill_hub_search",
  description: "Search the global agentskills.io skill registry for reusable skills",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      limit: { type: "integer", description: "Max results (default 10)" },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async execute(args: { query: string; limit?: number }) {
    try {
      const data = await apiGet(
        `/skills/search?q=${encodeURIComponent(args.query)}&limit=${args.limit || 10}`
      );

      if (!data.skills || data.skills.length === 0) {
        return `No skills found for "${args.query}" on agentskills.io.`;
      }

      const lines = [
        `🔍 Found ${data.skills.length} skills for "${args.query}" (total: ${data.total}):`,
      ];
      data.skills.forEach((s: HubSkill, i: number) => {
        lines.push(
          `${i + 1}. **${s.name}** v${s.version} by ${s.author} ⭐${s.rating}`
        );
        lines.push(`   ${s.description}`);
        lines.push(`   Downloads: ${s.downloads}`);
      });
      lines.push("");
      lines.push(
        `Use \`skill_hub_download\` with the skill name to install it locally.`
      );
      return lines.join("\n");
    } catch (e) {
      return `Failed to search skill hub: ${e instanceof Error ? e.message : e}. Try again later.`;
    }
  },
});

registerTool({
  name: "skill_hub_download",
  description: "Download and install a skill from agentskills.io by name",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Skill name to download" },
    },
    required: ["name"],
    additionalProperties: false,
  },
  async execute(args: { name: string }) {
    try {
      // Download the SKILL.md from hub
      const res = await fetch(
        `${HUB_API}/skills/${encodeURIComponent(args.name)}/download`,
        { signal: AbortSignal.timeout(10_000) }
      );

      if (!res.ok) {
        if (res.status === 404) return `❌ Skill "${args.name}" not found on agentskills.io.`;
        return `❌ Failed to download: ${res.status}`;
      }

      const skillMd = await res.text();
      const skillDir = join(SKILLS_DIR, args.name);
      if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), skillMd);

      // Reload skill cache
      const { loadSkills } = await import("../skill/loader.ts");
      await loadSkills();

      return `✅ Downloaded skill "${args.name}" from agentskills.io.\nLocation: ${join(skillDir, "SKILL.md")}`;
    } catch (e) {
      return `Failed to download: ${e instanceof Error ? e.message : e}`;
    }
  },
});

registerTool({
  name: "skill_hub_publish",
  description: "Publish a local skill to the agentskills.io global registry",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Skill name (hyphenated slug)" },
      description: { type: "string", description: "One-line description" },
      category: { type: "string", description: "Category (e.g. 'coding', 'research', 'devops')" },
    },
    required: ["name", "description"],
    additionalProperties: false,
  },
  async execute(args: { name: string; description: string; category?: string }) {
    try {
      const skillPath = join(SKILLS_DIR, args.name, "SKILL.md");
      if (!existsSync(skillPath)) {
        return `❌ No local skill "${args.name}" found at ${skillPath}.\nUse \`skill_create\` first, or download one with \`skill_hub_download\`.`;
      }

      const content = readFileSync(skillPath, "utf-8");
      // Frontmatter extraction
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = fmMatch ? fmMatch[1] : "";
      const instructions = fmMatch ? content.slice(fmMatch[0].length).trim() : content;

      await apiPost("/skills/publish", {
        name: args.name,
        description: args.description,
        category: args.category || "general",
        content: instructions,
        frontmatter,
      });

      return `✅ Published "${args.name}" to agentskills.io! 🚀`;
    } catch (e) {
      return `Failed to publish: ${e instanceof Error ? e.message : e}`;
    }
  },
});

registerTool({
  name: "skill_hub_list",
  description: "List skills available on the local skill hub (plus cached from hub)",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    try {
      const localSkills = loadSkills();
      const localNames = new Set(localSkills.map((s) => s.name));

      const hubEnabled = false; // Disable hub fetch by default to avoid rate limits
      let hubSkills: HubSkill[] = [];

      const lines = ["📚 Local skills:"];
      if (localSkills.length === 0) {
        lines.push("  (none — install from hub with `skill_hub_download`)");
      } else {
        localSkills.forEach((s, i) => {
          const source = s.source === "auto-generated" ? "AI" : "built-in";
          lines.push(`  ${i + 1}. ${s.name} [${source}] — ${s.description}`);
        });
      }

      if (hubEnabled && hubSkills.length > 0) {
        lines.push(``);
        lines.push(`🌐 Hub skills (${hubSkills.length}):`);
        hubSkills.forEach((s, i) => {
          lines.push(`  ${i + 1}. ${s.name} v${s.version} ⭐${s.rating}`);
        });
      }

      lines.push(``);
      lines.push(`Commands:`);
      lines.push(`  skill_hub_search <query> — search agentskills.io`);
      lines.push(`  skill_hub_download <name> — install a skill`);
      lines.push(`  skill_hub_publish <name> <desc> — publish locally`);

      return lines.join("\n");
    } catch (e) {
      return `Error listing skills: ${e instanceof Error ? e.message : e}`;
    }
  },
});
