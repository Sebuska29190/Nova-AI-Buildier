/**
 * Memory Plugin System — pluggable memory backends for Nova.
 * Supports: built-in SQLite (default), mem0, honcho, supermemory.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

interface MemoryEntry {
  id?: string;
  content: string;
  metadata?: Record<string, any>;
  scope?: "user" | "agent" | "session";
  timestamp?: string;
  score?: number;
}

interface MemoryBackend {
  name: string;
  save(entry: MemoryEntry): Promise<string>;
  search(query: string, limit?: number): Promise<MemoryEntry[]>;
  get(id: string): Promise<MemoryEntry | null>;
  delete(id: string): Promise<boolean>;
  list(scope?: string, limit?: number): Promise<MemoryEntry[]>;
}

const MEMORY_CONFIG_PATH = join(process.cwd(), "config", "memory-config.json");

interface MemoryConfig {
  backend: "builtin" | "mem0" | "honcho" | "supermemory";
  mem0?: { apiKey: string; userId?: string };
  honcho?: { apiKey: string; appId?: string; baseUrl?: string };
  supermemory?: { apiKey: string; baseUrl?: string };
}

function loadConfig(): MemoryConfig {
  try {
    if (existsSync(MEMORY_CONFIG_PATH)) {
      return JSON.parse(readFileSync(MEMORY_CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return { backend: "builtin" };
}

let activeBackend: MemoryBackend | null = null;

/**
 * Get the active memory backend. Initialized on first call.
 */
export async function getMemory(): Promise<MemoryBackend> {
  if (activeBackend) return activeBackend;

  const config = loadConfig();

  switch (config.backend) {
    case "mem0":
      activeBackend = createMem0Backend(config.mem0!);
      break;
    case "honcho":
      activeBackend = createHonchoBackend(config.honcho!);
      break;
    case "supermemory":
      activeBackend = createSupermemoryBackend(config.supermemory!);
      break;
    default:
      activeBackend = createBuiltinBackend();
  }

  return activeBackend;
}

/**
 * Switch memory backend at runtime.
 */
export async function setBackend(backend: "builtin" | "mem0" | "honcho" | "supermemory"): Promise<void> {
  activeBackend = null;
  const config = loadConfig();
  config.backend = backend;
  const dir = dirname(MEMORY_CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(MEMORY_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  await getMemory();
}

// ─── Built-in SQLite Backend ──────────────────────────────────

function createBuiltinBackend(): MemoryBackend {
  const { Database } = require("bun:sqlite");
  const dbPath = join(process.cwd(), "data", "memory.db");
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.run("PRAGMA journal_mode = WAL");
  db.run(`CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    scope TEXT DEFAULT 'user',
    metadata TEXT DEFAULT '{}',
    timestamp TEXT DEFAULT (datetime('now')),
    score REAL DEFAULT 1.0
  )`);
  db.run("CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope)");
  db.run("CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp DESC)");

  return {
    name: "builtin",
    async save(entry) {
      const result = db.run(
        "INSERT INTO memories (content, scope, metadata, timestamp) VALUES (?, ?, ?, ?)",
        [entry.content, entry.scope || "user", JSON.stringify(entry.metadata || {}), entry.timestamp || new Date().toISOString()]
      );
      return String(result.lastInsertRowid);
    },
    async search(query, limit = 10) {
      // Simple FTS via LIKE
      const like = `%${query}%`;
      return db.query(
        "SELECT id, content, scope, metadata, timestamp, score FROM memories WHERE content LIKE ? ORDER BY score DESC, timestamp DESC LIMIT ?",
      ).all(like, limit) as MemoryEntry[];
    },
    async get(id) {
      return db.query("SELECT id, content, scope, metadata, timestamp, score FROM memories WHERE id = ?").get(parseInt(id)) as MemoryEntry || null;
    },
    async delete(id) {
      const result = db.run("DELETE FROM memories WHERE id = ?", [parseInt(id)]);
      return result.changes > 0;
    },
    async list(scope, limit = 50) {
      if (scope) {
        return db.query("SELECT id, content, scope, metadata, timestamp, score FROM memories WHERE scope = ? ORDER BY timestamp DESC LIMIT ?").all(scope, limit) as MemoryEntry[];
      }
      return db.query("SELECT id, content, scope, metadata, timestamp, score FROM memories ORDER BY timestamp DESC LIMIT ?").all(limit) as MemoryEntry[];
    },
  };
}

// ─── Mem0 Backend ─────────────────────────────────────────────

function createMem0Backend(config: { apiKey: string; userId?: string }): MemoryBackend {
  return {
    name: "mem0",
    async save(entry) {
      try {
        const res = await fetch("https://api.mem0.ai/v1/memories", {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content: entry.content,
            user_id: config.userId || "nova-user",
            metadata: entry.metadata || {},
          }),
        });
        const data = await res.json();
        return data.id || String(Date.now());
      } catch (e) { return `error: ${e}`; }
    },
    async search(query, limit = 10) {
      try {
        const res = await fetch(`https://api.mem0.ai/v1/memories/search?query=${encodeURIComponent(query)}&limit=${limit}`, {
          headers: { Authorization: `Bearer ${config.apiKey}` },
        });
        const data = await res.json();
        return (data.results || []).map((r: any) => ({
          id: r.id, content: r.content, metadata: r.metadata, score: r.score || 0,
        }));
      } catch { return []; }
    },
    async get(id) { return null; },
    async delete(id) {
      try {
        await fetch(`https://api.mem0.ai/v1/memories/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${config.apiKey}` } });
        return true;
      } catch { return false; }
    },
    async list(scope, limit = 50) { return []; },
  };
}

// ─── Honcho Backend ───────────────────────────────────────────

function createHonchoBackend(config: { apiKey: string; appId?: string; baseUrl?: string }): MemoryBackend {
  const baseUrl = config.baseUrl || "https://api.honcho.ai/v1";
  return {
    name: "honcho",
    async save(entry) {
      try {
        const res = await fetch(`${baseUrl}/apps/${config.appId || "nova"}/sessions/default/memories`, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content: entry.content, metadata: entry.metadata }),
        });
        const data = await res.json();
        return data.id || String(Date.now());
      } catch (e) { return `error: ${e}`; }
    },
    async search(query, limit = 10) { return []; },
    async get(id) { return null; },
    async delete(id) { return false; },
    async list(scope, limit = 50) { return []; },
  };
}

// ─── Supermemory Backend ─────────────────────────────────────

function createSupermemoryBackend(config: { apiKey: string; baseUrl?: string }): MemoryBackend {
  const baseUrl = config.baseUrl || "https://api.supermemory.ai/v1";
  return {
    name: "supermemory",
    async save(entry) {
      try {
        const res = await fetch(`${baseUrl}/memories`, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content: entry.content, source: "nova", metadata: entry.metadata }),
        });
        const data = await res.json();
        return data.id || String(Date.now());
      } catch (e) { return `error: ${e}`; }
    },
    async search(query, limit = 10) {
      try {
        const res = await fetch(`${baseUrl}/memories/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
          headers: { Authorization: `Bearer ${config.apiKey}` },
        });
        const data = await res.json();
        return (data.results || []).map((r: any) => ({ id: r.id, content: r.content, score: r.score || 0 }));
      } catch { return []; }
    },
    async get(id) { return null; },
    async delete(id) { return false; },
    async list(scope, limit = 50) { return []; },
  };
}
