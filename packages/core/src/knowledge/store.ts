/**
 * Knowledge Base — auto-saves all activity history to structured folders
 * grouped by category (bug-fix, feature, research, etc.)
 * Format: Markdown with YAML frontmatter — readable AND space-efficient
 * 1:1 z CheetahClaws knowledge management philosophy
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, appendFileSync } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";

export interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  source: string;
  createdAt: string;
  filePath: string;
}

const CATEGORIES = [
  "bug-fix",
  "feature",
  "research",
  "session",
  "decision",
  "learning",
  "config",
  "trading",
  "video",
  "agent",
  "skill",
  "error",
] as const;

export type KnowledgeCategory = (typeof CATEGORIES)[number];

class KnowledgeBase {
  private baseDir = "";

  init(basePath?: string): void {
    this.baseDir = basePath ?? join(process.cwd(), "knowledge");
    mkdirSync(this.baseDir, { recursive: true });

    // Create category subdirectories
    for (const cat of CATEGORIES) {
      mkdirSync(join(this.baseDir, cat), { recursive: true });
    }

    // Create index file
    const indexPath = join(this.baseDir, "INDEX.md");
    if (!existsSync(indexPath)) {
      writeFileSync(indexPath, this.generateIndex(), "utf-8");
    }

    console.log(`  ✓ Knowledge Base initialized at ${this.baseDir}`);
  }

  /**
   * Save an entry to the knowledge base, auto-categorizing it.
   * Returns the saved entry.
   */
  save(params: {
    title: string;
    content: string;
    category?: KnowledgeCategory | string;
    tags?: string[];
    source?: string;
  }): KnowledgeEntry {
    const category = this.inferCategory(params.category, params.title, params.content);
    const id = `${category}-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const safeTitle = params.title.replace(/[<>:"/\\|?*]/g, "_").slice(0, 80);
    const now = new Date().toISOString();
    const tags = params.tags ?? [];

    // Build markdown with YAML frontmatter
    const frontmatter = [
      "---",
      `id: ${id}`,
      `title: ${params.title}`,
      `category: ${category}`,
      `created_at: ${now}`,
      `source: ${params.source ?? "nova"}`,
      `tags: [${tags.join(", ")}]`,
      "---",
    ].join("\n");

    const fullContent = `${frontmatter}\n\n${params.content}\n`;

    // Save to category folder
    const fileName = `${now.slice(0, 10)}-${safeTitle}.md`;
    const filePath = join(this.baseDir, category, fileName);
    writeFileSync(filePath, fullContent, "utf-8");

    // Append to category index
    this.appendToCategoryIndex(category, { id, title: params.title, createdAt: now, tags });

    // Update global index
    this.updateGlobalIndex();

    return { id, category, title: params.title, content: fullContent, tags, source: params.source ?? "nova", createdAt: now, filePath };
  }

  /**
   * Auto-save a session transcript to knowledge base
   */
  saveSession(sessionId: string, messages: Array<{ role: string; content: string }>, modelRef: string): KnowledgeEntry {
    const title = `Session ${sessionId.slice(0, 8)}`;
    const content = messages
      .map((m) => `## ${m.role}\n\n${m.content}`)
      .join("\n\n---\n\n");
    return this.save({
      title,
      content,
      category: "session",
      tags: ["session", modelRef],
      source: `session:${sessionId}`,
    });
  }

  /**
   * Auto-save a bug fix record
   */
  saveBugFix(description: string, rootCause: string, fixApplied: string, filesChanged: string[]): KnowledgeEntry {
    const content = [
      `## Description\n\n${description}`,
      `## Root Cause\n\n${rootCause}`,
      `## Fix Applied\n\n${fixApplied}`,
      `## Files Changed\n\n${filesChanged.map((f) => `- \`${f}\``).join("\n")}`,
    ].join("\n\n");
    return this.save({
      title: `Bug Fix: ${description.slice(0, 60)}`,
      content,
      category: "bug-fix",
      tags: ["bug-fix", ...filesChanged.map((f) => extname(f).replace(".", "") || "file")],
      source: "auto_bug_fixer",
    });
  }

  /**
   * Search knowledge base by keyword across all categories
   */
  search(query: string, category?: string): KnowledgeEntry[] {
    const results: KnowledgeEntry[] = [];
    const dirs = category ? [join(this.baseDir, category)] : CATEGORIES.map((c) => join(this.baseDir, c));

    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const content = readFileSync(join(dir, file), "utf-8");
        if (content.toLowerCase().includes(query.toLowerCase())) {
          const entry = this.parseEntry(content, join(dir, file));
          if (entry) results.push(entry);
        }
      }
    }
    return results;
  }

  /**
   * List entries by category
   */
  listByCategory(category: string, limit = 50): KnowledgeEntry[] {
    const dir = join(this.baseDir, category);
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "INDEX.md")
      .sort()
      .reverse()
      .slice(0, limit);
    return files.map((f) => this.parseEntry(readFileSync(join(dir, f), "utf-8"), join(dir, f))).filter(Boolean) as KnowledgeEntry[];
  }

  /**
   * Get all categories with entry counts
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      const dir = join(this.baseDir, cat);
      if (existsSync(dir)) {
        stats[cat] = readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "INDEX.md").length;
      } else {
        stats[cat] = 0;
      }
    }
    return stats;
  }

  private inferCategory(category?: string, title?: string, content?: string): string {
    if (category && CATEGORIES.includes(category as any)) return category;
    const text = `${title} ${content}`.toLowerCase();
    if (text.includes("bug") || text.includes("fix") || text.includes("error") || text.includes("crash")) return "bug-fix";
    if (text.includes("feature") || text.includes("add") || text.includes("implement") || text.includes("new")) return "feature";
    if (text.includes("research") || text.includes("search") || text.includes("analyze") || text.includes("study")) return "research";
    if (text.includes("trade") || text.includes("stock") || text.includes("symbol") || text.includes("market")) return "trading";
    if (text.includes("video") || text.includes("generate") || text.includes("media")) return "video";
    if (text.includes("agent") || text.includes("delegate") || text.includes("sub-agent")) return "agent";
    if (text.includes("skill") || text.includes("tool") || text.includes("plugin")) return "skill";
    if (text.includes("config") || text.includes("setup") || text.includes("install")) return "config";
    if (text.includes("learn") || text.includes("understand") || text.includes("how to")) return "learning";
    if (text.includes("decide") || text.includes("choose") || text.includes("plan")) return "decision";
    return "session";
  }

  private parseEntry(content: string, filePath: string): KnowledgeEntry | null {
    try {
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!fmMatch) return null;
      const fm: Record<string, string> = {};
      for (const line of fmMatch[1].split("\n")) {
        const [k, ...v] = line.split(": ");
        if (k && v.length) fm[k.trim()] = v.join(": ").trim();
      }
      return {
        id: fm.id || randomUUID().slice(0, 8),
        category: fm.category || "session",
        title: fm.title || "Untitled",
        content: fmMatch[2].trim(),
        tags: (fm.tags || "").replace(/[\[\]]/g, "").split(",").map((t) => t.trim()).filter(Boolean),
        source: fm.source || "nova",
        createdAt: fm.created_at || new Date().toISOString(),
        filePath,
      };
    } catch {
      return null;
    }
  }

  private appendToCategoryIndex(category: string, entry: { id: string; title: string; createdAt: string; tags: string[] }): void {
    const indexPath = join(this.baseDir, category, "INDEX.md");
    const line = `- [${entry.title}](${entry.createdAt.slice(0, 10)}-${entry.title.replace(/[<>:"/\\|?*]/g, "_").slice(0, 80)}.md) — ${entry.createdAt.slice(0, 10)} \`[${entry.tags.join(", ")}]\`\n`;
    appendFileSync(indexPath, line, "utf-8");
  }

  private generateIndex(): string {
    return [
      "# Knowledge Base Index",
      "",
      "Auto-generated index of all knowledge entries grouped by category.",
      "",
      "## Categories",
      "",
      ...CATEGORIES.map((c) => `- [${c}](${c}/INDEX.md)`),
      "",
      "---",
      "",
      "Entries are automatically saved and categorized by the Nova Knowledge Base system.",
      "",
    ].join("\n");
  }

  private updateGlobalIndex(): void {
    const stats = this.getStats();
    const lines = [
      "# Knowledge Base Index",
      "",
      "Auto-generated index of all knowledge entries grouped by category.",
      `Last updated: ${new Date().toISOString()}`,
      "",
      "## Categories",
      "",
      ...CATEGORIES.map((c) => `- [${c}](${c}/INDEX.md) — ${stats[c]} entries`),
      "",
      "---",
      "",
      "Entries are automatically saved and categorized by the Nova Knowledge Base system.",
      "",
    ];
    writeFileSync(join(this.baseDir, "INDEX.md"), lines.join("\n"), "utf-8");
  }
}

export const knowledgeBase = new KnowledgeBase();
