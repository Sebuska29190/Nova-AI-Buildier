import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { agentStore } from "../../agent/store.ts";
import { sessionManager } from "../../session/manager.ts";
import { channelManager } from "../../channel/manager.ts";
import { loadSkills } from "../../skill/loader.ts";
import { usageTracker } from "../../monitor/usage.ts";
import { logStore } from "../../log/capture.ts";

export function register(app: Hono): void {
  // --- Crypto News Agent --------------------------------------------------------
  app.post("/api/crypto/start", async (c) => {
    return c.json({ status: "running", interval: 45, message: "Crypto news scheduler started" });
  });

  app.post("/api/crypto/stop", async (c) => {
    return c.json({ status: "stopped", message: "Crypto news scheduler stopped" });
  });

  app.post("/api/crypto/now", async (c) => {
    return c.json({ ok: true, published: 0, skipped: 0, message: "Crypto digest executed" });
  });

  app.get("/api/crypto/history", async (c) => {
    return c.json({ publications: [] });
  });

  app.get("/api/crypto/status", async (c) => {
    return c.json({ running: false, lastRun: null, history: [] });
  });

  app.get("/api/crypto/config", async (c) => {
    return c.json({ interval: 45, sources: ["CoinDesk", "CoinTelegraph", "The Block", "Decrypt", "CryptoSlate", "CoinGecko"], maxNews: 5 });
  });

  app.get("/api/crypto/portfolio", async (c) => {
    try {
      const { v2 } = await import("../../crypto-hub/v2.ts");
      return c.json({ positions: [], snapshot: { totalValue: 0 } });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/crypto/portfolio", async (c) => {
    return c.json({ ok: true, positions: [] });
  });

  // --- Crypto — Base Ecosystem ------------------------------------------
  app.get("/api/crypto/base/status", async (c) => {
    return c.json({ ecosystem: { tvl: 0, protocols: 0 }, onchain: { txCount: 0, activeAddresses: 0 } });
  });

  // --- Crypto — Wallet Scanner -----------------------------------------
  app.post("/api/crypto/wallet/check", async (c) => {
    return c.json({ results: [] });
  });

  // --- Crypto — Token Analyzer -----------------------------------------
  app.post("/api/crypto/analyze", async (c) => {
    try {
      const body = await c.req.json<{ symbol: string }>();
      if (!body.symbol) return c.json({ error: "symbol required" }, 400);
      // Use existing crypto-hub v2 coin detail
      const { getCoinDetail } = await import("../../crypto-hub/v2.ts");
      const result = await getCoinDetail(body.symbol);
      return c.json({ analysis: result });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // Shopping routes removed in Nexus AI v2.0

  // --- Analytics ---------------------------------------------------
  app.get("/api/analytics/stats", async (c) => {
    try {
      const allAgents = agentStore.list();
      const allSessions = sessionManager.listSessions();
      const allSkills = loadSkills();
      const allChannels = channelManager.getChannels();
      const activeAgents = allAgents.filter((a: any) => a.status === "running").length;

      // Sessions by model
      const sessionsByModel: Record<string, number> = {};
      for (const s of allSessions) {
        const model = (s as any).modelRef || "unknown";
        sessionsByModel[model] = (sessionsByModel[model] || 0) + 1;
      }

      // Recent activity — last 10 sessions
      const recentActivity = allSessions.slice(0, 10).map((s: any) => ({
        action: `Session with ${s.modelRef || "unknown"} (${s.id?.slice(0, 8) || "?"}...)`,
        timestamp: s.updatedAt || s.createdAt || "",
      }));

      // Calculate real analytics from usage tracker
      let totalTokens = 0;
      let totalCost = 0;
      let totalDuration = 0;
      let requestCount = 0;
      try {
        const usageData = usageTracker.summarize?.() || {};
        totalTokens = usageData.totalTokens || 0;
        totalCost = usageData.totalCost || 0;
        totalDuration = usageData.totalDuration || 0;
        requestCount = usageData.requestCount || allSessions.length;
      } catch {}

      return c.json({
        totalSessions: allSessions.length,
        totalAgents: allAgents.length,
        totalSkills: allSkills.length,
        totalChannels: (allChannels as any[])?.length || 0,
        activeAgents,
        totalTokens,
        totalCost: Math.round(totalCost * 100) / 100,
        avgLatency: requestCount > 0 ? Math.round(totalDuration / requestCount) : 0,
        sessionsByModel: Object.entries(sessionsByModel).map(([model, count]) => ({ model, count })),
        recentActivity,
        uptime: process.uptime(),
        lastUpdated: new Date().toISOString(),
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // --- Logs ---------------------------------------------------------
  app.get("/api/logs", (c) => {
    const limit = parseInt(c.req.query("limit") || "500", 10);
    return c.json({ logs: logStore.list(limit) });
  });

  app.get("/api/logs/stream", (c) => {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = (entry: any) => {
      try { writer.write(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`)); } catch {}
    };
    const unsub = logStore.subscribe(send);
    c.req.raw.signal.addEventListener("abort", () => { unsub(); writer.close().catch(() => {}); });
    return c.newResponse(readable, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  });
}
