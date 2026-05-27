import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  modelRef: string;
  systemPrompt?: string;
  thinkingLevel?: string;
  skills?: string[];
  emoji?: string;
  avatar?: string;
  workspace?: string;
  status: "ready" | "active" | "error";
  createdAt: string;
  updatedAt: string;
}

export interface AgentFile {
  name: string;
  path: string;
  content: string;
  size?: number;
  updatedAtMs?: number;
}

const AGENT_WORKSPACE_FILES = ["AGENTS.md", "SOUL.md", "IDENTITY.md", "TOOLS.md", "MEMORY.md", "HEARTBEAT.md"];

class AgentStore {
  private db!: Database;
  private baseDir = "";

  init(dbPath?: string): void {
    const path = dbPath ?? join(process.cwd(), "nova.db");
    this.baseDir = join(process.cwd(), "agents");
    mkdirSync(this.baseDir, { recursive: true });

    this.db = new Database(path);
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run(`CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      model_ref TEXT NOT NULL DEFAULT 'deepseek/deepseek-chat',
      system_prompt TEXT DEFAULT '',
      thinking_level TEXT DEFAULT '',
      skills TEXT DEFAULT '[]',
      emoji TEXT DEFAULT '🤖',
      avatar TEXT DEFAULT '',
      workspace TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ready',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
  }

  private agentDir(id: string): string {
    return join(this.baseDir, id);
  }

  list(): AgentConfig[] {
    return this.db.query("SELECT * FROM agents ORDER BY name ASC").all().map((r: any) => this.rowToAgent(r));
  }

  get(id: string): AgentConfig | undefined {
    const r = this.db.query("SELECT * FROM agents WHERE id = ?").get(id) as any;
    return r ? this.rowToAgent(r) : undefined;
  }

  create(params: { name: string; description?: string; modelRef?: string; systemPrompt?: string; emoji?: string; skills?: string[] }): AgentConfig {
    const id = params.name.toLowerCase().replace(/[^a-z0-9-]/g, "-") || randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    this.db.run(
      "INSERT INTO agents (id, name, description, model_ref, system_prompt, emoji, skills, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)",
      [id, params.name, params.description ?? "", params.modelRef ?? "deepseek/deepseek-chat", params.systemPrompt ?? "", params.emoji ?? "🤖", JSON.stringify(params.skills ?? []), now, now],
    );
    this.ensureWorkspace(id, params.systemPrompt);
    const agent = this.get(id)!;
    console.log(`  ✓ Agent created: ${agent.name} (${id})`);
    return agent;
  }

  update(id: string, params: Partial<Pick<AgentConfig, "name" | "description" | "modelRef" | "systemPrompt" | "thinkingLevel" | "skills" | "emoji" | "status">>): AgentConfig | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;

    const merged = { ...existing, ...params };
    const now = new Date().toISOString();
    this.db.run(
      "UPDATE agents SET name=?, description=?, model_ref=?, system_prompt=?, thinking_level=?, skills=?, emoji=?, status=?, updated_at=? WHERE id=?",
      [merged.name ?? "", merged.description ?? "", merged.modelRef ?? "", merged.systemPrompt ?? "", merged.thinkingLevel ?? "", JSON.stringify(merged.skills ?? []), merged.emoji ?? "", merged.status ?? "ready", now, id],
    );

    if (params.systemPrompt !== undefined) {
      this.ensureWorkspace(id, merged.systemPrompt);
    }

    return this.get(id);
  }

  delete(id: string): boolean {
    const existing = this.get(id);
    if (!existing) return false;
    this.db.run("DELETE FROM agents WHERE id = ?", [id]);
    return true;
  }

  /**
   * Sync skills for an existing agent. Only updates if the agent has empty or different skills.
   */
  syncSkills(id: string, skills: string[]): boolean {
    const agent = this.get(id);
    if (!agent) return false;
    const current = agent.skills ?? [];
    const needsUpdate = current.length !== skills.length ||
      !skills.every(s => current.includes(s)) ||
      !current.every(s => skills.includes(s));
    if (!needsUpdate) return false;
    this.update(id, { skills });
    console.log(`  ∼ Synced skills for ${agent.name} (${id}): ${skills.length} tools`);
    return true;
  }

  // Workspace files
  listFiles(id: string): AgentFile[] {
    const dir = this.agentDir(id);
    return AGENT_WORKSPACE_FILES.map((name) => {
      const filePath = join(dir, name);
      if (existsSync(filePath)) {
        const stat = readFileSync(filePath);
        return { name, path: filePath, content: stat.toString(), size: stat.length, updatedAtMs: Date.now() };
      }
      return { name, path: filePath, content: "", missing: true } as any;
    });
  }

  getFile(id: string, fileName: string): AgentFile | undefined {
    const dir = this.agentDir(id);
    const filePath = join(dir, fileName);
    if (!existsSync(filePath)) { return { name: fileName, path: filePath, content: "", missing: true } as any; }
    const content = readFileSync(filePath, "utf-8");
    return { name: fileName, path: filePath, content, size: content.length, updatedAtMs: Date.now() };
  }

  setFile(id: string, fileName: string, content: string): void {
    const dir = this.agentDir(id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, fileName), content, "utf-8");
  }

  private ensureWorkspace(id: string, systemPrompt?: string): void {
    const dir = this.agentDir(id);
    mkdirSync(dir, { recursive: true });

    const files: Record<string, string> = {
      "AGENTS.md": `# ${this.get(id)?.name || id}\n\nAgent workspace for Nova AI Platform.`,
      "SOUL.md": systemPrompt || `You are a helpful AI assistant.`,
      "IDENTITY.md": `# Identity\n\nName: ${this.get(id)?.name || id}\n`,
    };

    for (const [name, content] of Object.entries(files)) {
      const p = join(dir, name);
      if (!existsSync(p)) writeFileSync(p, content, "utf-8");
    }
  }

  private rowToAgent(r: any): AgentConfig {
    return {
      id: r.id, name: r.name, description: r.description || undefined,
      modelRef: r.model_ref, systemPrompt: r.system_prompt || undefined,
      thinkingLevel: r.thinking_level || undefined,
      skills: JSON.parse(r.skills || "[]"), emoji: r.emoji || "🤖",
      avatar: r.avatar || undefined, workspace: r.workspace || undefined,
      status: r.status || "ready", createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
}

export const agentStore = new AgentStore();
