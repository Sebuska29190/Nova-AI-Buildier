/**
 * Usage Tracker — monitor API calls, tool usage, costs per agent/session
 */
import { Database } from "bun:sqlite";
import { join } from "node:path";

interface UsageRecord {
  id: string;
  agentId?: string;
  sessionId?: string;
  modelRef?: string;
  action: string;        // "api_call" | "tool_call" | "agent_run"
  tokensInput?: number;
  tokensOutput?: number;
  cost?: number;
  durationMs?: number;
  createdAt: string;
}

class UsageTracker {
  private db!: Database;
  private initd = false;

  init(dbPath?: string) {
    if (this.initd) return;
    const path = dbPath ?? join(process.cwd(), "nova.db");
    this.db = new Database(path);
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run(`CREATE TABLE IF NOT EXISTS usage_log (
      id TEXT PRIMARY KEY, agent_id TEXT, session_id TEXT,
      model_ref TEXT, action TEXT NOT NULL,
      tokens_input INTEGER DEFAULT 0, tokens_output INTEGER DEFAULT 0,
      cost REAL DEFAULT 0, duration_ms INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_usage_log_agent ON usage_log(agent_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_usage_log_created ON usage_log(created_at)`);
    this.initd = true;
  }

  log(entry: Omit<UsageRecord, "id" | "createdAt">) {
    const id = crypto.randomUUID().slice(0, 12);
    const now = new Date().toISOString();
    this.db.run("INSERT INTO usage_log (id, agent_id, session_id, model_ref, action, tokens_input, tokens_output, cost, duration_ms, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [id, entry.agentId || null, entry.sessionId || null, entry.modelRef || null, entry.action,
       entry.tokensInput || 0, entry.tokensOutput || 0, entry.cost || 0, entry.durationMs || 0, now]);
  }

  summarize(since?: string, agentId?: string): { totalApiCalls: number; totalToolCalls: number; totalAgentRuns: number; totalCost: number; totalTokens: number; topAgents: { agentId: string; cost: number; calls: number }[] } {
    const sinceClause = since ? ` AND created_at >= '${since}'` : "";
    const agentClause = agentId ? ` AND agent_id = '${agentId}'` : "";
    const total = this.db.query(`SELECT action, COUNT(*) as c, SUM(cost) as cost, SUM(tokens_input + tokens_output) as tokens FROM usage_log WHERE 1=1${sinceClause}${agentClause} GROUP BY action`).all() as any[];
    const top = this.db.query(`SELECT agent_id, SUM(cost) as cost, COUNT(*) as calls FROM usage_log WHERE agent_id IS NOT NULL${sinceClause} GROUP BY agent_id ORDER BY cost DESC LIMIT 5`).all() as any[];
    return {
      totalApiCalls: total.find((r: any) => r.action === "api_call")?.c ?? 0,
      totalToolCalls: total.find((r: any) => r.action === "tool_call")?.c ?? 0,
      totalAgentRuns: total.find((r: any) => r.action === "agent_run")?.c ?? 0,
      totalCost: total.reduce((s: number, r: any) => s + (r.cost || 0), 0),
      totalTokens: total.reduce((s: number, r: any) => s + (r.tokens || 0), 0),
      topAgents: top.map((r: any) => ({ agentId: r.agent_id, cost: r.cost || 0, calls: r.calls || 0 })),
    };
  }
}

export const usageTracker = new UsageTracker();
