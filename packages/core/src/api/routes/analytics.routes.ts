import { Hono } from "hono";
import { agentAnalytics } from "../../monitor/agent-analytics.ts";

export function register(app: Hono): void {
  // Per-agent stats
  app.get("/api/analytics/agent/:id", (c) => {
    const agentId = c.req.param("id");
    const since = c.req.query("since") || undefined;
    const stats = agentAnalytics.getAgentStats(agentId, since);
    return c.json({ stats });
  });

  // Agent time series (daily)
  app.get("/api/analytics/agent/:id/timeseries", (c) => {
    const agentId = c.req.param("id");
    const days = parseInt(c.req.query("days") || "7", 10);
    const series = agentAnalytics.getTimeSeries(agentId, days);
    return c.json({ series, agentId, days });
  });

  // Global tool breakdown
  app.get("/api/analytics/tools", (c) => {
    const since = c.req.query("since") || undefined;
    const breakdown = agentAnalytics.getToolBreakdown(since);
    return c.json({ breakdown, count: breakdown.length });
  });

  // Leaderboard — all agents ranked by cost
  app.get("/api/analytics/leaderboard", (c) => {
    const limit = parseInt(c.req.query("limit") || "10", 10);
    const since = c.req.query("since") || undefined;
    const leaderboard = agentAnalytics.getLeaderboard(limit, since);
    return c.json({ leaderboard, count: leaderboard.length });
  });

  // System-wide stats
  app.get("/api/analytics/system", (c) => {
    const since = c.req.query("since") || undefined;
    const stats = agentAnalytics.getSystemStats(since);
    return c.json({ stats });
  });
}
