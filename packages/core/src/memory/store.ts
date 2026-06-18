import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface MemoryEntry {
  id: string;
  name: string;
  content: string;
  tags: string[];
  scope: "user" | "project";
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
  importance: "low" | "medium" | "high";
}

class MemoryStore {
  private baseDir = "";
  private cache = new Map<string, MemoryEntry>();

  init(): void {
    this.baseDir = join(process.cwd(), "memory");
    mkdirSync(join(this.baseDir, "user"), { recursive: true });
    mkdirSync(join(this.baseDir, "project"), { recursive: true });
    this.loadAll();
  }

  private scopeDir(scope: "user" | "project"): string {
    return join(this.baseDir, scope);
  }

  private filePath(entry: MemoryEntry): string {
    return join(this.scopeDir(entry.scope), `${entry.name}.md`);
  }

  private loadAll(): void {
    this.cache.clear();
    for (const scope of ["user", "project"] as const) {
      const dir = this.scopeDir(scope);
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
        const content = readFileSync(join(dir, file), "utf-8");
        const entry = this.parseEntry(content, file.replace(".md", ""), scope);
        if (entry) this.cache.set(entry.id, entry);
      }
    }
  }

  save(name: string, content: string, tags: string[] = [], scope: "user" | "project" = "user", importance: "low" | "medium" | "high" = "medium"): MemoryEntry {
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: randomUUID(), name, content, tags, scope,
      createdAt: now, updatedAt: now, lastUsedAt: now, importance,
    };
    this.cache.set(entry.id, entry);
    this.writeEntry(entry);
    return entry;
  }

  search(query: string, scope: "user" | "project" | "all" = "all"): MemoryEntry[] {
    const q = query.toLowerCase();
    return [...this.cache.values()]
      .filter((e) => (scope === "all" || e.scope === scope))
      .filter((e) => e.name.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
  }

  delete(id: string): boolean {
    const entry = this.cache.get(id);
    if (!entry) return false;
    this.cache.delete(id);
    const fp = this.filePath(entry);
    if (existsSync(fp)) try { unlinkSync(fp); } catch {}
    return true;
  }

  getAll(scope: "user" | "project" | "all" = "all"): MemoryEntry[] {
    return [...this.cache.values()]
      .filter((e) => scope === "all" || e.scope === scope)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  touch(id: string): void {
    const entry = this.cache.get(id);
    if (entry) { entry.lastUsedAt = new Date().toISOString(); this.writeEntry(entry); }
  }

  private writeEntry(entry: MemoryEntry): void {
    const frontmatter = `---
id: ${entry.id}
tags: [${entry.tags.join(", ")}]
scope: ${entry.scope}
created_at: ${entry.createdAt}
importance: ${entry.importance}
---\n`;
    writeFileSync(this.filePath(entry), frontmatter + entry.content);
  }

  private parseEntry(content: string, name: string, scope: "user" | "project"): MemoryEntry | null {
    const tags: string[] = [];
    let importance: "low" | "medium" | "high" = "medium";
    let body = content;
    let createdAt = new Date().toISOString();
    let entryId = name; // use filename as the stable ID

    if (content.startsWith("---")) {
      const end = content.indexOf("---", 3);
      if (end !== -1) {
        const fm = content.slice(3, end).trim();
        body = content.slice(end + 3).trim();
        for (const line of fm.split("\n")) {
          const [k, ...v] = line.split(":");
          const val = v.join(":").trim();
          if (k.trim() === "id") entryId = val;
          if (k.trim() === "tags") {
            try { const parsed: string[] = JSON.parse(val.replace(/'/g, '"')); if (Array.isArray(parsed)) tags.push(...parsed); } catch { tags.push(...val.replace(/[[\]"']/g, "").split(",").map((t: string) => t.trim())); }
          }
          if (k.trim() === "importance") importance = val as any;
          if (k.trim() === "created_at") createdAt = val;
        }
      }
    }

    if (!body) return null;
    return { id: entryId, name, content: body, tags, scope, createdAt, updatedAt: createdAt, lastUsedAt: createdAt, importance };
  }
}

export const memoryStore = new MemoryStore();
