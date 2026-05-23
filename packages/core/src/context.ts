// System context — CLAUDE.md injection, git info, cwd (1:1 z CheetahClaws)
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function buildContext(workspaceDir?: string): string[] {
  const parts: string[] = [];
  const dir = workspaceDir || process.cwd();

  // Git info
  try {
    const proc = Bun.spawnSync(["git", "log", "--oneline", "-5"], { cwd: dir });
    if (proc.exitCode === 0) {
      parts.push(`Recent git commits:\n${proc.stdout.toString().trim()}`);
    }
  } catch {}

  // CLAUDE.md / AGENTS.md
  for (const name of ["CLAUDE.md", "AGENTS.md"]) {
    const p = join(dir, name);
    if (existsSync(p)) {
      parts.push(`\n### ${name}\n${readFileSync(p, "utf-8").trim()}`);
    }
  }

  // CWD
  parts.push(`\nCurrent directory: ${dir}`);

  return parts;
}
