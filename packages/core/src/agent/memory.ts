/**
 * Agent Persistent Memory — każdy agent uczy się z każdego runu
 *
 * Dwa typy pamięci:
 * - episodic: co się wydarzyło (fakty, wyniki, decyzje)
 * - semantic: czego się nauczył (wnioski, reguły, wzorce)
 *
 * Przy starcie agenta: najbardziej istotne + wysokiej wagi pamięci
 * są wstrzykiwane do system prompta.
 * Po zakończeniu runu: ekstrakcja kluczowych wniosków i zapis.
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { registerTool } from "../plugin/tools.ts";
import { safeMessage } from "../errors.ts";
import { agentStore } from "./store.ts";
import { sessionAgentMap } from "./runner.ts";

/** Resolve agent ID from session ID */
function resolveAgentFromSession(sessionId: string): string | null {
  return sessionAgentMap.get(sessionId) ?? null;
}

type MemoryType = "episodic" | "semantic";
type MemoryImportance = 1 | 2 | 3 | 4 | 5; // 1=trivial, 5=critical

interface AgentMemory {
  id: string;
  agentId: string;
  type: MemoryType;
  content: string;
  importance: MemoryImportance;
  tags: string[];
  sourceRunId?: string;
  createdAt: string;
}

class AgentMemoryManager {
  private db!: Database;
  private initialized = false;

  init(dbPath?: string): void {
    if (this.initialized) return;
    const path = dbPath ?? join(process.cwd(), "nova.db");
    this.db = new Database(path);
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run(`CREATE TABLE IF NOT EXISTS agent_memories (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('episodic','semantic')),
      content TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 3 CHECK(importance BETWEEN 1 AND 5),
      tags TEXT NOT NULL DEFAULT '[]',
      source_run_id TEXT,
      created_at TEXT NOT NULL
    )`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agent_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_agent_memories_importance ON agent_memories(agent_id, importance DESC)`);
    this.initialized = true;
    this.registerTools();
  }

  // ─── CRUD ────────────────────────────────────────────────────

  add(agentId: string, type: MemoryType, content: string, importance: MemoryImportance = 3, tags: string[] = [], sourceRunId?: string): AgentMemory {
    const id = randomUUID().slice(0, 12);
    const now = new Date().toISOString();
    this.db.run(
      "INSERT INTO agent_memories (id, agent_id, type, content, importance, tags, source_run_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [id, agentId, type, content, importance, JSON.stringify(tags), sourceRunId || null, now],
    );
    console.log(`  🧠 Memory saved for ${agentId} (${type}, importance ${importance})`);
    return { id, agentId, type, content, importance, tags, sourceRunId, createdAt: now };
  }

  search(agentId: string, query?: string, type?: MemoryType, minImportance?: number, limit = 20): AgentMemory[] {
    const conditions: string[] = ["agent_id = ?"];
    const params: any[] = [agentId];

    if (type) { conditions.push("type = ?"); params.push(type); }
    if (minImportance) { conditions.push("importance >= ?"); params.push(minImportance); }
    if (query) { conditions.push("content LIKE ?"); params.push(`%${query}%`); }

    const sql = `SELECT * FROM agent_memories WHERE ${conditions.join(" AND ")} ORDER BY importance DESC, created_at DESC LIMIT ?`;
    params.push(limit);

    return this.db.query(sql).all(...params).map((r: any) => this.rowToMemory(r));
  }

  forget(id: string): boolean {
    const result = this.db.run("DELETE FROM agent_memories WHERE id = ?", [id]);
    return (result.changes ?? 0) > 0;
  }

  forgetByAgent(agentId: string): number {
    const result = this.db.run("DELETE FROM agent_memories WHERE agent_id = ?", [agentId]);
    return result.changes ?? 0;
  }

  count(agentId: string): number {
    const r = this.db.query("SELECT COUNT(*) as c FROM agent_memories WHERE agent_id = ?").get(agentId) as any;
    return r?.c ?? 0;
  }

  // ─── Prompt Injection ─────────────────────────────────────────

  /** Get top memories for injection into agent's system prompt */
  injectMemory(agentId: string, maxMemories = 10): string {
    const count = this.count(agentId);
    if (count === 0) return "";

    // Top: high-importance semantic memories + recent episodic
    const semantic = this.search(agentId, undefined, "semantic", 3, Math.ceil(maxMemories * 0.6));
    const episodic = this.search(agentId, undefined, "episodic", 2, Math.ceil(maxMemories * 0.4));

    const all = [...semantic, ...episodic].slice(0, maxMemories);
    if (all.length === 0) return "";

    const lines = all.map((m) => {
      const tagStr = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
      const impStr = "★".repeat(m.importance) + "☆".repeat(5 - m.importance);
      return `  ${impStr} ${m.content}${tagStr}`;
    });

    return `\n\n## 🧠 Your Persistent Memory (${count} total, showing ${all.length} most relevant)\nYou remember:\n${lines.join("\n")}\n\nUse \`agent_memory_save\` to store new memories, \`agent_memory_search\` to recall more, and \`agent_memory_forget\` to remove outdated ones.`;
  }

  /** Consolidate run results into semantic memories */
  async consolidateRun(agentId: string, runSummary: string, runId: string): Promise<number> {
    if (!runSummary || runSummary.length < 50) return 0;

    // Extract key learnings via simple heuristics:
    // Sentences containing: "learned", "discovered", "found that", "important", "remember"
    const indicators = /(learned|discovered|found\s+that|important|remember|key insight|lesson|warning|always|never|critical|note to self)/gi;
    const sentences = runSummary.match(/[^.!?\n]+[.!?]/g) || [runSummary];
    const relevant = sentences.filter((s) => { indicators.lastIndex = 0; return indicators.test(s); });

    let saved = 0;
    for (const sentence of relevant) {
      const trimmed = sentence.trim();
      if (trimmed.length < 20) continue;
      // Dedup: skip if similar memory already exists
      const existing = this.search(agentId, trimmed.slice(0, 60), "semantic", 1, 3);
      if (existing.some((e) => this.similarity(e.content, trimmed) > 0.7)) continue;

      const importance: MemoryImportance = trimmed.toLowerCase().includes("critical") || trimmed.toLowerCase().includes("always") || trimmed.toLowerCase().includes("never") ? 5 : 4;

      this.add(agentId, "semantic", trimmed, importance, ["auto-consolidated"], runId);
      saved++;
    }

    if (saved > 0) {
      // Update MEMORY.md file in agent workspace
      try {
        const recent = this.search(agentId, undefined, undefined, 3, 20);
        const md = recent.map((m) => `- ${"★".repeat(m.importance)} ${m.content}`).join("\n");
        agentStore.setFile(agentId, "MEMORY.md", `# Agent Memory\n\nLast consolidated: ${new Date().toISOString()}\nTotal memories: ${this.count(agentId)}\n\n## Key Learnings\n\n${md}`);
      } catch {}
    }

    return saved;
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private similarity(a: string, b: string): number {
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    if (longer.length === 0) return 1.0;
    const longerLower = longer.toLowerCase();
    const matches = shorter.toLowerCase().split(" ").filter((w) => longerLower.includes(w)).length;
    return matches / Math.max(shorter.split(" ").length, 1);
  }

  private rowToMemory(r: any): AgentMemory {
    return {
      id: r.id, agentId: r.agent_id, type: r.type,
      content: r.content, importance: r.importance,
      tags: JSON.parse(r.tags || "[]"), sourceRunId: r.source_run_id || undefined,
      createdAt: r.created_at,
    };
  }

  // ─── Tools ────────────────────────────────────────────────────

  private registerTools(): void {
    registerTool({
      name: "agent_memory_save",
      description: "Save a memory for the current agent — facts, learnings, important findings",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "What to remember (be specific and concise)" },
          type: { type: "string", enum: ["episodic", "semantic"], description: "episodic=what happened, semantic=what you learned" },
          importance: { type: "number", description: "1-5 (1=trivial, 5=critical)", minimum: 1, maximum: 5 },
          tags: { type: "string", description: "Comma-separated tags (e.g. code,debug,config)" },
        },
        required: ["content", "type"],
        additionalProperties: false,
      },
      execute: async (args: Record<string, unknown>, ctx: any) => {
        const agentId = ctx?.sessionId ? resolveAgentFromSession(ctx.sessionId) : null;
        if (!agentId) return "❌ No active agent session";
        const content = args.content as string;
        const type = args.type as string;
        const tags = ((args.tags as string) || "").split(",").map((t: string) => t.trim()).filter(Boolean);
        this.add(agentId, type as MemoryType, content, (args.importance || 3) as MemoryImportance, tags);
        return `✅ Memory saved (${type}, importance ${args.importance || 3})`;
      },
    });

    registerTool({
      name: "agent_memory_search",
      description: "Search through memories from previous runs",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term (optional — empty = show most important)" },
          type: { type: "string", enum: ["episodic", "semantic"], description: "Filter by memory type" },
          minImportance: { type: "number", description: "Minimum importance 1-5", minimum: 1, maximum: 5 },
        },
        additionalProperties: false,
      },
      execute: async (args: Record<string, unknown>, ctx: any) => {
        const agentId = ctx?.sessionId ? resolveAgentFromSession(ctx.sessionId) : null;
        if (!agentId) return "❌ No active agent session";
        const results = this.search(agentId, args.query as string, args.type as MemoryType | undefined, args.minImportance as MemoryImportance | undefined);
        if (results.length === 0) return "No matching memories found.";
        return results.map((m) => {
          const tagStr = m.tags.length > 0 ? ` [${m.tags.join(",")}]` : "";
          return `[${m.type}] ${"★".repeat(m.importance)} ${m.content}${tagStr} (${m.createdAt.slice(0, 10)})`;
        }).join("\n");
      },
    });

    registerTool({
      name: "agent_memory_forget",
      description: "Remove a memory by ID or clear all memories",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Memory ID to remove. Omit to clear ALL memories (confirmation required)" },
          confirm: { type: "boolean", description: "Set to true to confirm clearing ALL memories" },
        },
        additionalProperties: false,
      },
      execute: async (args: Record<string, unknown>, ctx: any) => {
        const agentId = ctx?.sessionId ? resolveAgentFromSession(ctx.sessionId) : null;
        if (!agentId) return "❌ No active agent session";
        if (args.id as string) {
          return this.forget(args.id as string) ? `🗑️ Memory ${args.id} removed` : "❌ Memory not found";
        }
        if (!args.confirm) return "⚠️ This will delete ALL memories. Pass confirm=true to proceed.";
        const count = this.forgetByAgent(agentId);
        return `🗑️ Cleared ${count} memories for this agent`;
      },
    });

    registerTool({
      name: "agent_memory_summarize",
      description: "Get a summary of what this agent remembers — how many memories, top insights, most common tags",
      parameters: {
        type: "object",
        properties: { type: { type: "string", enum: ["episodic", "semantic"], description: "Filter by type" } },
        additionalProperties: false,
      },
      execute: async (args: Record<string, unknown>, ctx: any) => {
        const agentId = ctx?.sessionId ? resolveAgentFromSession(ctx.sessionId) : null;
        if (!agentId) return "❌ No active agent session";
        const total = this.count(agentId);
        const top5 = this.search(agentId, undefined, args.type as MemoryType | undefined, 4, 5);
        const semanticCount = this.search(agentId, undefined, "semantic").length;
        const episodicCount = this.search(agentId, undefined, "episodic").length;
        let out = `🧠 Agent Memory Summary\n`;
        out += `Total: ${total} (${semanticCount} semantic, ${episodicCount} episodic)\n`;
        if (top5.length > 0) {
          out += `\nTop priorities:\n`;
          out += top5.map((m) => `  ${"★".repeat(m.importance)} ${m.content.slice(0, 80)}`).join("\n");
        }
        return out;
      },
    });
  }
}

export const agentMemory = new AgentMemoryManager();
