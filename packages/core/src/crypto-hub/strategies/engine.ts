/**
 * Strategy Engine — Automated trading strategies
 */

import { randomUUID } from "node:crypto";
import { Database } from "bun:sqlite";
import { registerTool } from "../../plugin/tools";

const db = new Database("nova.db");
db.run("PRAGMA journal_mode = WAL");
db.run(`CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'paused',
  config TEXT NOT NULL,
  stats TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  last_run TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS strategy_trades (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  action TEXT NOT NULL,
  token TEXT NOT NULL,
  amount REAL NOT NULL,
  price REAL,
  tx_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (strategy_id) REFERENCES strategies(id)
)`);

export interface Strategy {
  id: string;
  name: string;
  type: "dca" | "grid" | "stop_loss" | "take_profit";
  status: "active" | "paused" | "completed" | "error";
  config: Record<string, any>;
  stats: { totalTrades: number; totalSpent: number; totalReceived: number; pnl: number };
  createdAt: string;
  lastRun?: string;
}

class StrategyEngine {
  private activeIntervals: Map<string, NodeJS.Timeout> = new Map();

  createStrategy(type: string, name: string, config: Record<string, any>): Strategy {
    const id = randomUUID().slice(0, 12);
    const now = new Date().toISOString();
    const strategy: Strategy = {
      id, name, type: type as any, status: "paused",
      config, stats: { totalTrades: 0, totalSpent: 0, totalReceived: 0, pnl: 0 },
      createdAt: now,
    };
    db.run("INSERT INTO strategies (id, name, type, config, created_at) VALUES (?,?,?,?,?)",
      [id, name, type, JSON.stringify(config), now]);
    return strategy;
  }

  getStrategy(id: string): Strategy | null {
    const row = db.query("SELECT * FROM strategies WHERE id = ?").get(id) as any;
    if (!row) return null;
    return {
      id: row.id, name: row.name, type: row.type, status: row.status,
      config: JSON.parse(row.config), stats: JSON.parse(row.stats || "{}"),
      createdAt: row.created_at, lastRun: row.last_run,
    };
  }

  listStrategies(): Strategy[] {
    const rows = db.query("SELECT * FROM strategies ORDER BY created_at DESC").all() as any[];
    return rows.map(r => ({
      id: r.id, name: r.name, type: r.type, status: r.status,
      config: JSON.parse(r.config), stats: JSON.parse(r.stats || "{}"),
      createdAt: r.created_at, lastRun: r.last_run,
    }));
  }

  deleteStrategy(id: string): boolean {
    this.pauseStrategy(id); // stop interval
    db.run("DELETE FROM strategy_trades WHERE strategy_id = ?", [id]);
    const result = db.run("DELETE FROM strategies WHERE id = ?", [id]);
    return (result.changes ?? 0) > 0;
  }

  startStrategy(id: string): void {
    const strategy = this.getStrategy(id);
    if (!strategy) return;

    db.run("UPDATE strategies SET status = 'active' WHERE id = ?", [id]);

    // Set up interval based on type
    const intervalMs = this.getIntervalMs(strategy.config.frequency || "1d");

    const interval = setInterval(async () => {
      try {
        await this.executeStep(id);
      } catch (e) {
        console.error(`[strategy] Error executing ${id}: ${e}`);
      }
    }, intervalMs);

    this.activeIntervals.set(id, interval);
  }

  pauseStrategy(id: string): void {
    const interval = this.activeIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.activeIntervals.delete(id);
    }
    db.run("UPDATE strategies SET status = 'paused' WHERE id = ?", [id]);
  }

  async executeStep(id: string): Promise<string> {
    const strategy = this.getStrategy(id);
    if (!strategy || strategy.status !== "active") return "Strategy not active";

    db.run("UPDATE strategies SET last_run = ? WHERE id = ?", [new Date().toISOString(), id]);

    let result = "";
    switch (strategy.type) {
      case "dca":
        result = await this.executeDCA(strategy);
        break;
      case "grid":
        result = await this.executeGrid(strategy);
        break;
      case "stop_loss":
      case "take_profit":
        result = await this.executeThreshold(strategy);
        break;
    }

    // Log trade
    db.run("INSERT INTO strategy_trades (id, strategy_id, action, token, amount, created_at) VALUES (?,?,?,?,?,?)",
      [randomUUID().slice(0, 12), id, "execute", strategy.config.token || "SOL", 0, new Date().toISOString()]);

    return result;
  }

  private async executeDCA(strategy: Strategy): Promise<string> {
    const config = strategy.config;
    // DCA: Buy fixed amount at each interval
    return `[DCA SIMULATION] Would buy ${config.amount || 0} ${config.token || "SOL"} for ~${config.usdAmount || 0} USDC. Connect a wallet and enable live trading to execute.`;
  }

  private async executeGrid(strategy: Strategy): Promise<string> {
    const config = strategy.config;
    return `[GRID SIMULATION] Would check price levels for ${config.token || "SOL"} between ${config.lowerPrice || 0} - ${config.upperPrice || 0}. Connect a wallet and enable live trading to execute.`;
  }

  private async executeThreshold(strategy: Strategy): Promise<string> {
    const config = strategy.config;
    return `[${strategy.type.toUpperCase()} SIMULATION] Monitoring ${config.token || "SOL"} at threshold ${config.threshold || 0}. Connect a wallet and enable live trading to execute.`;
  }

  private getIntervalMs(frequency: string): number {
    const map: Record<string, number> = {
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "4h": 4 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
      "1w": 7 * 24 * 60 * 60 * 1000,
    };
    return map[frequency] || map["1d"];
  }

  getTradeHistory(strategyId: string, limit: number = 20): any[] {
    return db.query("SELECT * FROM strategy_trades WHERE strategy_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(strategyId, limit);
  }
}

export const strategyEngine = new StrategyEngine();

// ─── Strategy Tools ──────────────────────────────────────

const STRATEGY_TEMPLATES = [
  { name: "BTC Weekly DCA", type: "dca", config: { token: "BTC", usdAmount: 50, frequency: "1w" } },
  { name: "SOL Daily DCA", type: "dca", config: { token: "SOL", usdAmount: 25, frequency: "1d" } },
  { name: "SOL Grid $100-$200", type: "grid", config: { token: "SOL", lowerPrice: 100, upperPrice: 200, gridCount: 10, amountPerGrid: 25 } },
  { name: "ETH Stop-Loss 10%", type: "stop_loss", config: { token: "ETH", threshold: 0.9, description: "Sell if drops 10% from entry" } },
  { name: "JUP Take-Profit 50%", type: "take_profit", config: { token: "JUP", threshold: 1.5, description: "Sell if rises 50% from entry" } },
];

registerTool({
  name: "strategy_create",
  description: "Create an automated trading strategy (DCA, grid, stop-loss, take-profit)",
  parameters: {
    type: "object",
    properties: {
      type: { type: "string", description: "Strategy type: dca, grid, stop_loss, take_profit" },
      name: { type: "string", description: "Strategy name" },
      token: { type: "string", description: "Token symbol (e.g. SOL, BTC)" },
      config: { type: "string", description: "JSON config: {amount, usdAmount, frequency, lowerPrice, upperPrice, threshold}" },
    },
    required: ["type", "name"],
  },
  async execute(args: { type: string; name: string; token?: string; config?: string }) {
    const config = args.config ? JSON.parse(args.config) : {};
    if (args.token) config.token = args.token;
    const strategy = strategyEngine.createStrategy(args.type, args.name, config);
    return `Created strategy: ${strategy.name} (${strategy.type}) [${strategy.id}]`;
  },
});

registerTool({
  name: "strategy_list",
  description: "List all trading strategies",
  parameters: { type: "object", properties: {} },
  async execute() {
    const strategies = strategyEngine.listStrategies();
    if (!strategies.length) return "No strategies. Use strategy_create to add one.";
    return strategies.map(s =>
      `- **${s.name}** (${s.type}) [${s.status}] — trades: ${s.stats.totalTrades}, PnL: $${s.stats.pnl.toFixed(2)}`
    ).join("\n");
  },
});

registerTool({
  name: "strategy_start",
  description: "Start/resume a trading strategy",
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "Strategy ID" } },
    required: ["id"],
  },
  async execute(args: { id: string }) {
    strategyEngine.startStrategy(args.id);
    return `Strategy ${args.id} started`;
  },
});

registerTool({
  name: "strategy_status",
  description: "Get strategy status and trade history",
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "Strategy ID" } },
    required: ["id"],
  },
  async execute(args: { id: string }) {
    const s = strategyEngine.getStrategy(args.id);
    if (!s) return "Strategy not found";
    const trades = strategyEngine.getTradeHistory(args.id, 5);
    const lines = [
      `**${s.name}** (${s.type}) — ${s.status}`,
      `Config: ${JSON.stringify(s.config)}`,
      `Stats: ${s.stats.totalTrades} trades, $${s.stats.pnl.toFixed(2)} PnL`,
      `Created: ${s.createdAt}`,
      `Last run: ${s.lastRun || "never"}`,
    ];
    if (trades.length > 0) {
      lines.push("\nRecent trades:");
      trades.forEach(t => lines.push(`  ${t.action} ${t.amount} ${t.token} @ ${t.price || "?"} — ${t.created_at}`));
    }
    return lines.join("\n");
  },
});

registerTool({
  name: "strategy_templates",
  description: "List predefined strategy templates",
  parameters: { type: "object", properties: {} },
  async execute() {
    return STRATEGY_TEMPLATES.map(t =>
      `- **${t.name}** (${t.type}): ${JSON.stringify(t.config)}`
    ).join("\n");
  },
});

console.log("[strategies] Strategy engine initialized with 5 tools");
