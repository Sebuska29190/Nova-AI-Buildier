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

export function loadSkills(): SkillDef[] {
  const skills: SkillDef[] = [];
  for (const dir of SKILL_DIRS) {
    if (!existsSync(dir)) continue;
    skills.push(...scanDir(dir, dir));
  }
  return skills;
}

export function findSkillByTrigger(trigger: string): SkillDef | undefined {
  const skills = loadSkills();
  return skills.find((s) =>
    s.triggers.some((t) => trigger.toLowerCase().includes(t.toLowerCase()))
  );
}

export function getSkillsByCategory(category: string): SkillDef[] {
  return loadSkills().filter((s) => s.category === category);
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
