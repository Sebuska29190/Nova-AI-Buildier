// Agent Analytics — per-agent performance, tool usage, cost tracking
import { Database } from "bun:sqlite";
import { join } from "node:path";

export interface AgentStats {
  agentId: string;
  totalRuns: number;
  totalToolCalls: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCost: number;
  avgDurationMs: number;
  successRate: number;
  topTools: { tool: string; count: number; avgDurationMs: number }[];
  sessions: number;
  lastActive: string;
}

export interface TimeSeriesPoint {
  date: string;
  runs: number;
  toolCalls: number;
  cost: number;
  tokens: number;
}

export interface ToolBreakdown {
  tool: string;
  calls: number;
  success: number;
  failed: number;
  avgDurationMs: number;
  totalDurationMs: number;
}

class AgentAnalytics {
  private db!: Database;
  private initd = false;

  init(dbPath?: string) {
    if (this.initd) return;
    const path = dbPath ?? join(process.cwd(), "nova.db");
    this.db = new Database(path);
    this.initd = true;
  }

  /**
   * Get comprehensive stats for a single agent.
   */
  getAgentStats(agentId: string, since?: string): AgentStats {
    this.init();
    const sinceClause = since ? ` AND created_at >= '${since}'` : "";

    // Usage stats from usage_log
    const usageRow = this.db.query(`
      SELECT
        COUNT(CASE WHEN action = 'agent_run' THEN 1 END) as total_runs,
        COUNT(CASE WHEN action = 'tool_call' THEN 1 END) as total_tool_calls,
        COALESCE(SUM(tokens_input), 0) as tokens_input,
        COALESCE(SUM(tokens_output), 0) as tokens_output,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(AVG(CASE WHEN action = 'agent_run' THEN duration_ms END), 0) as avg_duration
      FROM usage_log WHERE agent_id = ?${sinceClause}
    `).get(agentId) as Record<string, number> || {};

    // Success rate from ledger
    const ledgerRow = this.db.query(`
      SELECT
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(*) as total
      FROM ledger WHERE agent_id = ?${sinceClause}
    `).get(agentId) as Record<string, number> || {};

    // Tool breakdown from tool_activity_log
    const toolRows = this.db.query(`
      SELECT
        tool_name as tool,
        COUNT(*) as count,
        AVG(duration_ms) as avg_duration
      FROM tool_activity_log WHERE agent_id = ?${sinceClause}
      GROUP BY tool_name ORDER BY count DESC LIMIT 10
    `).all(agentId) as Record<string, unknown>[];

    // Session count
    const sessionRow = this.db.query(`
      SELECT COUNT(DISTINCT session_id) as count
      FROM usage_log WHERE agent_id = ?${sinceClause}
    `).get(agentId) as Record<string, number> || {};

    // Last active
    const lastRow = this.db.query(`
      SELECT MAX(created_at) as last_active
      FROM usage_log WHERE agent_id = ?${sinceClause}
    `).get(agentId) as Record<string, string> || {};

    return {
      agentId,
      totalRuns: usageRow.total_runs || 0,
      totalToolCalls: usageRow.total_tool_calls || 0,
      totalTokensInput: usageRow.tokens_input || 0,
      totalTokensOutput: usageRow.tokens_output || 0,
      totalCost: usageRow.total_cost || 0,
      avgDurationMs: usageRow.avg_duration || 0,
      successRate: ledgerRow.total ? (ledgerRow.completed / ledgerRow.total) * 100 : 0,
      topTools: toolRows.map((r: any) => ({
        tool: r.tool,
        count: r.count,
        avgDurationMs: Math.round(r.avg_duration || 0),
      })),
      sessions: sessionRow.count || 0,
      lastActive: lastRow.last_active || "",
    };
  }

  /**
   * Get time series data for an agent (daily aggregation).
   */
  getTimeSeries(agentId: string, days = 7): TimeSeriesPoint[] {
    this.init();
    const rows = this.db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(CASE WHEN action = 'agent_run' THEN 1 END) as runs,
        COUNT(CASE WHEN action = 'tool_call' THEN 1 END) as tool_calls,
        COALESCE(SUM(cost), 0) as cost,
        COALESCE(SUM(tokens_input + tokens_output), 0) as tokens
      FROM usage_log
      WHERE agent_id = ? AND created_at >= datetime('now', '-${days} days')
      GROUP BY DATE(created_at) ORDER BY date
    `).all(agentId) as any[];

    return rows.map((r: any) => ({
      date: r.date,
      runs: r.runs || 0,
      toolCalls: r.tool_calls || 0,
      cost: r.cost || 0,
      tokens: r.tokens || 0,
    }));
  }

  /**
   * Get global tool breakdown across all agents.
   */
  getToolBreakdown(since?: string): ToolBreakdown[] {
    this.init();
    const sinceClause = since ? ` WHERE created_at >= '${since}'` : "";
    const rows = this.db.query(`
      SELECT
        tool_name as tool,
        COUNT(*) as calls,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
        AVG(duration_ms) as avg_duration,
        SUM(duration_ms) as total_duration
      FROM tool_activity_log${sinceClause}
      GROUP BY tool_name ORDER BY calls DESC
    `).all() as any[];

    return rows.map((r: any) => ({
      tool: r.tool,
      calls: r.calls || 0,
      success: r.success || 0,
      failed: r.failed || 0,
      avgDurationMs: Math.round(r.avg_duration || 0),
      totalDurationMs: r.total_duration || 0,
    }));
  }

  /**
   * Get leaderboard — all agents ranked by cost/runs.
   */
  getLeaderboard(limit = 10, since?: string): AgentStats[] {
    this.init();
    const sinceClause = since ? ` AND created_at >= '${since}'` : "";
    const agentIds = this.db.query(`
      SELECT DISTINCT agent_id FROM usage_log WHERE agent_id IS NOT NULL${sinceClause}
    `).all() as { agent_id: string }[];

    const stats = agentIds
      .map(r => this.getAgentStats(r.agent_id, since))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, limit);

    return stats;
  }

  /**
   * Get overall system stats.
   */
  getSystemStats(since?: string): {
    totalAgents: number;
    totalRuns: number;
    totalToolCalls: number;
    totalCost: number;
    totalTokens: number;
    avgRunsPerAgent: number;
  } {
    this.init();
    const sinceClause = since ? ` AND created_at >= '${since}'` : "";
    const row = this.db.query(`
      SELECT
        COUNT(DISTINCT agent_id) as agents,
        COUNT(CASE WHEN action = 'agent_run' THEN 1 END) as runs,
        COUNT(CASE WHEN action = 'tool_call' THEN 1 END) as tool_calls,
        COALESCE(SUM(cost), 0) as cost,
        COALESCE(SUM(tokens_input + tokens_output), 0) as tokens
      FROM usage_log WHERE agent_id IS NOT NULL${sinceClause}
    `).get() as Record<string, number> || {};

    return {
      totalAgents: row.agents || 0,
      totalRuns: row.runs || 0,
      totalToolCalls: row.tool_calls || 0,
      totalCost: row.cost || 0,
      totalTokens: row.tokens || 0,
      avgRunsPerAgent: row.agents ? (row.runs || 0) / row.agents : 0,
    };
  }
}

export const agentAnalytics = new AgentAnalytics();
