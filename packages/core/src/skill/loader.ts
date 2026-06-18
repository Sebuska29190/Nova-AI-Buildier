// Skill system — markdown skills with YAML frontmatter (recursive directory scan)
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface SkillDef {
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
  prompt: string;
  category: string;
  filePath: string;
}

const SKILL_DIRS = [
  join(process.cwd(), "skills"),
  join(process.cwd(), "..", "skills"),
];

// ─── Cache ────────────────────────────────────────────────────────────

let _cache: SkillDef[] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30_000; // 30s

function getCachedSkills(): SkillDef[] {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;
  _cache = loadSkillsRaw();
  _cacheTime = now;
  return _cache;
}

export function invalidateSkillCache(): void {
  _cache = null;
}

// ─── Core loaders ─────────────────────────────────────────────────────

function loadSkillsRaw(): SkillDef[] {
  const skills: SkillDef[] = [];
  for (const dir of SKILL_DIRS) {
    if (!existsSync(dir)) continue;
    skills.push(...scanDir(dir, dir));
  }
  return skills;
}

export function loadSkills(): SkillDef[] {
  return getCachedSkills();
}

// ─── Dynamic loading by name ──────────────────────────────────────────

export function loadSkillByName(name: string): SkillDef | undefined {
  return getCachedSkills().find((s) => s.name === name);
}

export function loadSkillByNames(names: string[]): SkillDef[] {
  const all = getCachedSkills();
  return names.map((n) => all.find((s) => s.name === n)).filter(Boolean) as SkillDef[];
}

// ─── Context-based matching ───────────────────────────────────────────

export function findSkillsForContext(userMessage: string, agentId?: string): SkillDef[] {
  const all = getCachedSkills();
  const lowerMsg = userMessage.toLowerCase();
  const matched: { skill: SkillDef; score: number }[] = [];

  for (const skill of all) {
    let score = 0;

    // Trigger match — exact substring in message
    for (const trigger of skill.triggers) {
      if (lowerMsg.includes(trigger.toLowerCase())) {
        score += 3;
      }
    }

    // Description keyword match
    if (skill.description) {
      const descWords = skill.description.toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (word.length > 3 && lowerMsg.includes(word)) {
          score += 1;
        }
      }
    }

    // Name match
    if (lowerMsg.includes(skill.name.toLowerCase())) {
      score += 5;
    }

    // Agent-specific skills boost
    if (agentId && skill.category.includes(agentId)) {
      score += 2;
    }

    if (score > 0) {
      matched.push({ skill, score });
    }
  }

  // Sort by score descending, return top matches
  matched.sort((a, b) => b.score - a.score);
  return matched.slice(0, 5).map((m) => m.skill);
}

// ─── Category queries ─────────────────────────────────────────────────

export function getSkillsByCategory(category: string): SkillDef[] {
  return getCachedSkills().filter((s) => s.category === category);
}

export function getAllSkillCategories(): string[] {
  const cats = new Set(getCachedSkills().map((s) => s.category));
  return Array.from(cats).sort();
}

// ─── Prompt generation ────────────────────────────────────────────────

export function buildSkillContext(skills: SkillDef[], maxTokens?: number): string {
  if (skills.length === 0) return "";
  const parts = ["<available_skills>"];
  let totalLen = 0;
  const limit = maxTokens ?? 4000;

  for (const skill of skills) {
    const block = `<skill>\n<name>${skill.name}</name>\n<description>${skill.description}</description>\n<instructions>\n${skill.prompt}\n</instructions>\n</skill>`;
    if (totalLen + block.length > limit) break;
    parts.push(block);
    totalLen += block.length;
  }

  parts.push("</available_skills>");
  return parts.join("\n");
}

// ─── Trigger search (existing) ────────────────────────────────────────

export function findSkillByTrigger(trigger: string): SkillDef | undefined {
  const lowerTrigger = trigger.toLowerCase();
  return getCachedSkills().find((s) =>
    s.triggers.some((t) => lowerTrigger.includes(t.toLowerCase()))
  );
}

// ─── Internal ─────────────────────────────────────────────────────────

function scanDir(dir: string, baseDir: string): SkillDef[] {
  const skills: SkillDef[] = [];
  if (!existsSync(dir)) return skills;

  for (const entry of readdirSync(dir)) {
    const fp = join(dir, entry);
    const stat = statSync(fp);

    if (stat.isDirectory()) {
      skills.push(...scanDir(fp, baseDir));
    } else if (stat.isFile() && entry.endsWith(".md")) {
      const content = readFileSync(fp, "utf-8");
      const relPath = relative(baseDir, fp).replace(/\\/g, "/");
      const category = relPath.includes("/") ? relPath.split("/").slice(0, -1).join("/") : "root";
      const skillName = entry.replace(".md", "");
      const skill = parseSkill(content, skillName, relPath, category);
      if (skill) skills.push(skill);
    }
  }

  return skills;
}

function parseSkill(content: string, name: string, relPath: string, category: string): SkillDef | null {
  const def: SkillDef = {
    name, description: "", triggers: [name],
    tools: [], prompt: content, category, filePath: relPath,
  };

  if (content.startsWith("---")) {
    const end = content.indexOf("---", 3);
    if (end !== -1) {
      const fm = content.slice(3, end).trim();
      def.prompt = content.slice(end + 3).trim();
      for (const line of fm.split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const k = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();

        if (k === "description") def.description = val;
        if (k === "triggers") {
          def.triggers = val
            .replace(/[\[\]"']/g, "")
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean);
          if (def.triggers.length === 0) def.triggers = [name];
        }
        if (k === "tools") {
          def.tools = val
            .replace(/[\[\]"']/g, "")
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean);
        }
      }
    }
  }

  return def;
}
