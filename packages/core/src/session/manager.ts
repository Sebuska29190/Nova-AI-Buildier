import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { emitEvent } from "../event-bus/index.ts";
import { knowledgeBase } from "../knowledge/store.ts";

export interface SessionRow {
  id: string; createdAt: string; updatedAt: string;
  agentId?: string; channelId?: string;
  modelRef: string; thinkingLevel?: string;
  systemPrompt?: string;
  usageInput: number; usageOutput: number;
}

export interface TranscriptRow {
  id: number; sessionId: string;
  role: string; content: string;
  toolCallId?: string; toolName?: string;
  createdAt: string;
}

class SessionManager {
  private db!: Database;

  init(dbPath?: string): void {
    const path = dbPath ?? join(process.cwd(), "nova.db");
    if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      agent_id TEXT, channel_id TEXT, model_ref TEXT NOT NULL DEFAULT 'deepseek/deepseek-chat',
      thinking_level TEXT, system_prompt TEXT,
      usage_input INTEGER DEFAULT 0, usage_output INTEGER DEFAULT 0
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
      tool_call_id TEXT, tool_name TEXT, created_at TEXT NOT NULL
    )`);
    this.db.run("CREATE INDEX IF NOT EXISTS idx_tx_session ON transcripts(session_id, id)");

    // FTS5 full-text search index for transcript content
    this.db.run("CREATE VIRTUAL TABLE IF NOT EXISTS transcripts_fts USING fts5(content, role, content=transcripts, content_rowid=id)");
    // Triggers to keep FTS in sync
    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS transcripts_ai AFTER INSERT ON transcripts BEGIN
        INSERT INTO transcripts_fts(rowid, content, role) VALUES (new.id, new.content, new.role);
      END;
    `.trim());
    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS transcripts_ad AFTER DELETE ON transcripts BEGIN
        INSERT INTO transcripts_fts(transcripts_fts, rowid, content, role) VALUES('delete', old.id, old.content, old.role);
      END;
    `.trim());
    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS transcripts_au AFTER UPDATE ON transcripts BEGIN
        INSERT INTO transcripts_fts(transcripts_fts, rowid, content, role) VALUES('delete', old.id, old.content, old.role);
        INSERT INTO transcripts_fts(rowid, content, role) VALUES (new.id, new.content, new.role);
      END;
    `.trim());
  }

  createSession(modelRef: string, opts?: { agentId?: string; channelId?: string; systemPrompt?: string; thinkingLevel?: string }): SessionRow {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.run("INSERT INTO sessions (id,created_at,updated_at,agent_id,channel_id,model_ref,system_prompt,thinking_level) VALUES (?,?,?,?,?,?,?,?)",
      [id, now, now, opts?.agentId ?? null, opts?.channelId ?? null, modelRef, opts?.systemPrompt ?? null, opts?.thinkingLevel ?? null]);
    const row = this.getSession(id)!;
    emitEvent({ type: "event", kind: "session", sessionId: id, data: { action: "created", modelRef } });
    return row;
  }

  getSession(id: string): SessionRow | undefined {
    const r = this.db.query("SELECT * FROM sessions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!r) return undefined;
    return {
      id: r.id as string, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
      agentId: r.agent_id as string, channelId: r.channel_id as string,
      modelRef: r.model_ref as string, thinkingLevel: r.thinking_level as string,
      systemPrompt: r.system_prompt as string,
      usageInput: (r.usage_input as number) ?? 0, usageOutput: (r.usage_output as number) ?? 0,
    };
  }

  append(sessionId: string, role: string, content: string, toolCallId?: string, toolName?: string): TranscriptRow {
    const now = new Date().toISOString();
    const result = this.db.run("INSERT INTO transcripts (session_id,role,content,tool_call_id,tool_name,created_at) VALUES (?,?,?,?,?,?)",
      [sessionId, role, content, toolCallId ?? null, toolName ?? null, now]);
    this.db.run("UPDATE sessions SET updated_at = ? WHERE id = ?", [now, sessionId]);
    return { id: result.lastInsertRowid as number, sessionId, role, content, toolCallId, toolName, createdAt: now };
  }

  getTranscript(sessionId: string): TranscriptRow[] {
    return this.db.query("SELECT * FROM transcripts WHERE session_id = ? ORDER BY id").all(sessionId) as TranscriptRow[];
  }

  /**
   * Full-text search across all session transcripts.
   * Returns matching sessions with relevance scores and snippet previews.
   */
  searchTranscripts(query: string, limit = 10): Array<{
    sessionId: string;
    role: string;
    snippet: string;
    rank: number;
  }> {
    if (!query.trim()) return [];
    const rows = this.db.query(`
      SELECT t.session_id, tfts.role,
             snippet(transcripts_fts, 1, '<b>', '</b>', '...', 40) as snippet,
             rank
      FROM transcripts_fts AS tfts
      JOIN transcripts AS t ON t.id = tfts.rowid
      WHERE transcripts_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      sessionId: r.session_id as string,
      role: r.role as string,
      snippet: (r.snippet as string).replace(/<b>/g, "**").replace(/<\/b>/g, "**"),
      rank: r.rank as number,
    }));
  }

  listSessions(limit = 50): SessionRow[] {
    return this.db.query(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM transcripts WHERE session_id = s.id) as message_count
      FROM sessions s 
      ORDER BY updated_at DESC LIMIT ?
    `).all(limit).map((r: any) => ({
      id: r.id,
      modelRef: r.model_ref,
      agentId: r.agent_id,
      thinkingLevel: r.thinking_level,
      systemPrompt: r.system_prompt,
      usageInput: r.usage_input,
      usageOutput: r.usage_output,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      messageCount: r.message_count || 0,
    }));
  }

  deleteSession(id: string): boolean {
    const result = this.db.run("DELETE FROM sessions WHERE id = ?", [id]);
    emitEvent({ type: "event", kind: "session", sessionId: id, data: { action: "deleted" } });
    return (result.changes ?? 0) > 0;
  }

  updateUsage(sessionId: string, input: number, output: number): void {
    this.db.run("UPDATE sessions SET usage_input = usage_input + ?, usage_output = usage_output + ? WHERE id = ?", [input, output, sessionId]);
  }

  /**
   * Auto-save session transcript to knowledge base
   */
  saveToKnowledge(sessionId: string): void {
    try {
      const session = this.getSession(sessionId);
      if (!session) return;
      const messages = this.getTranscript(sessionId);
      if (messages.length === 0) return;
      knowledgeBase.saveSession(sessionId, messages, session.modelRef);
    } catch (e) {
      // Silent fail — knowledge base is non-critical
    }
  }

  close(): void { this.db?.close(); }
}

export const sessionManager = new SessionManager();
