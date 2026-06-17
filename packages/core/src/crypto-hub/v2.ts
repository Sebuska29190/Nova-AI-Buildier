/**
 * Crypto Hub V2 — Quick Dashboard + Signals + Alerts + Portfolio
 *
 * Designed for speed: single API call returns everything needed.
 * SSE for live updates. Signals based on RSI/MACD/SMA.
 */
import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { registerTool } from "../plugin/tools.ts";
import { safeMessage } from "../errors.ts";
import { emitEvent } from "../event-bus/index.ts";

const db = new Database("nova.db");
db.run("PRAGMA journal_mode = WAL");
db.run(`CREATE TABLE IF NOT EXISTS crypto_alerts (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,       -- "above" | "below" | "rsi_above" | "rsi_below" | "volume_spike"
  value REAL NOT NULL,
  message TEXT,
  channel TEXT,             -- "discord" | "telegram" | "slack" | "webhook"
  channel_config TEXT,      -- JSON with webhook URL etc.
  enabled INTEGER DEFAULT 1,
  triggered INTEGER DEFAULT 0,
  last_triggered TEXT,
  created_at TEXT NOT NULL
)`);
db.run(`CREATE TABLE IF NOT EXISTS crypto_portfolio (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  amount REAL NOT NULL,
  buy_price REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
)`);
db.run(`CREATE TABLE IF NOT EXISTS crypto_prices (
  symbol TEXT PRIMARY KEY,
  price REAL NOT NULL,
  change_24h REAL,
  volume REAL,
  market_cap REAL,
  rsi REAL,
  updated_at TEXT NOT NULL
)`);

const CACHE_TTL = 30_000; // 30s cache for price data
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

let _marketCache: { data: any; ts: number } = { data: null, ts: 0 };

// ─── Price Helpers ───────────────────────────────────────────

async function fetchCG(path: string, retries = 2): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${COINGECKO_BASE}/${path}`, {
        headers: { "User-Agent": "Nova/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) { await new Promise(r => setTimeout(r, 1000 * (i + 1))); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { if (i === retries - 1) return null; await new Promise(r => setTimeout(r, 1000)); }
  }
  return null;
}

async function getMarketData(): Promise<any> {
  const now = Date.now();
  if (_marketCache.data && now - _marketCache.ts < CACHE_TTL) return _marketCache.data;

  const [global, top, trending] = await Promise.all([
    fetchCG("global"),
    fetchCG("coins/markets?vs_currency=usd&order=volume_desc&per_page=30&page=1&sparkline=false&price_change_percentage=24h"),
    fetchCG("search/trending"),
  ]);

  const data = { global, top: top || [], trending: trending?.coins?.slice(0, 5).map((c: any) => c.item) || [] };
  _marketCache = { data, ts: now };
  return data;
}

function calcRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = [];
  for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);
  const gains = changes.slice(-period).map(c => c > 0 ? c : 0);
  const losses = changes.slice(-period).map(c => c < 0 ? -c : 0);
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function signalFromRSI(rsi: number): string {
  if (rsi >= 70) return "SELL";
  if (rsi <= 30) return "BUY";
  if (rsi >= 60) return "WEAK_SELL";
  if (rsi <= 40) return "WEAK_BUY";
  return "HOLD";
}

// ─── Quick Dashboard ─────────────────────────────────────────

export async function getDashboard(): Promise<any> {
  const data = await getMarketData();
  if (!data?.top || data.top.length === 0) return { error: "Could not fetch market data" };

  const top = data.top as any[];
  const global = data.global?.data;

  // BTC dominance
  const btc = top.find((c: any) => c.symbol === "btc");
  const eth = top.find((c: any) => c.symbol === "eth");
  const totalMcap = top.reduce((sum: number, c: any) => sum + (c.market_cap || 0), 0);
  const btcDom = btc ? ((btc.market_cap / totalMcap) * 100).toFixed(1) : "?";

  // Top movers
  const gainers = [...top].filter((c: any) => (c.price_change_percentage_24h || 0) > 0).sort((a: any, b: any) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)).slice(0, 5);
  const losers = [...top].filter((c: any) => (c.price_change_percentage_24h || 0) < 0).sort((a: any, b: any) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0)).slice(0, 5);

  // Signals for top 10
  const signals = top.slice(0, 10).map((c: any) => {
    // Simulate RSI from 24h change (simplified - real RSI needs historical data)
    const change = c.price_change_percentage_24h || 0;
    const rsi = Math.round(50 + change * 1.5);
    const clippedRsi = Math.max(10, Math.min(90, rsi));
    return {
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      price: c.current_price,
      change24h: change,
      rsi: clippedRsi,
      signal: signalFromRSI(clippedRsi),
      marketCap: c.market_cap,
      volume: c.total_volume,
      image: c.image,
    };
  });

  return {
    btcPrice: btc?.current_price || 0,
    btcDominance: btcDom,
    ethPrice: eth?.current_price || 0,
    totalMarketCap: global?.total_market_cap?.usd || totalMcap,
    btcVolume24h: btc?.total_volume || 0,
    marketCapChange24h: global?.market_cap_change_percentage_24h_usd || 0,
    gainers,
    losers,
    signals,
    trending: data.trending,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Coin Details + Analysis ─────────────────────────────────

export async function getCoinDetail(symbol: string): Promise<any> {
  // Try to find coin ID from symbol
  const data = await getMarketData();
  const coin = data.top?.find((c: any) => c.symbol === symbol.toLowerCase());
  if (!coin) return { error: `Coin ${symbol} not found` };

  // Get historical data for RSI calculation
  const history = await fetchCG(`coins/${coin.id}/market_chart?vs_currency=usd&days=14`);
  const prices = history?.prices?.map((p: any) => p[1]) || [];

  const rsi = calcRSI(prices);
  const signal = signalFromRSI(rsi);
  const sma7 = prices.length >= 7 ? prices.slice(-7).reduce((a: number, b: number) => a + b, 0) / 7 : null;
  const sma25 = prices.length >= 25 ? prices.slice(-25).reduce((a: number, b: number) => a + b, 0) / 25 : null;
  const macd = sma7 && sma25 ? sma7 - sma25 : null;

  return {
    symbol: symbol.toUpperCase(),
    name: coin.name,
    price: coin.current_price,
    change24h: coin.price_change_percentage_24h,
    high24h: coin.high_24h,
    low24h: coin.low_24h,
    marketCap: coin.market_cap,
    volume: coin.total_volume,
    rsi: Math.round(rsi),
    signal,
    sma7: sma7 ? Math.round(sma7 * 100) / 100 : null,
    sma25: sma25 ? Math.round(sma25 * 100) / 100 : null,
    macd: macd ? Math.round(macd * 100) / 100 : null,
    image: coin.image,
    priceHistory: prices.slice(-100), // last 100 data points
  };
}

// ─── Alerts ──────────────────────────────────────────────────

export function listAlerts(): any[] {
  return db.query("SELECT * FROM crypto_alerts ORDER BY created_at DESC").all() as any[];
}

export function addAlert(symbol: string, type: string, value: number, message?: string, channel?: string, channelConfig?: string): any {
  const id = randomUUID().slice(0, 12);
  const now = new Date().toISOString();
  db.run("INSERT INTO crypto_alerts (id, symbol, type, value, message, channel, channel_config, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [id, symbol.toUpperCase(), type, value, message || null, channel || null, channelConfig || null, now]);
  return { id, symbol: symbol.toUpperCase(), type, value, message, channel, enabled: true, createdAt: now };
}

export function removeAlert(id: string): boolean {
  const r = db.run("DELETE FROM crypto_alerts WHERE id = ?", [id]);
  return (r.changes ?? 0) > 0;
}

export async function checkAlerts(): Promise<string[]> {
  const alerts = db.query("SELECT * FROM crypto_alerts WHERE enabled = 1").all() as any[];
  if (alerts.length === 0) return [];

  const dashboard = await getDashboard();
  const triggered: string[] = [];

  for (const alert of alerts) {
    let shouldTrigger = false;
    let currentPrice = 0;

    // Find current price
    const signal = dashboard.signals?.find((s: any) => s.symbol === alert.symbol);
    if (signal) currentPrice = signal.price;

    if (alert.type === "above" && currentPrice >= alert.value) shouldTrigger = true;
    else if (alert.type === "below" && currentPrice <= alert.value) shouldTrigger = true;
    else if (alert.type === "rsi_above" && signal?.rsi >= alert.value) shouldTrigger = true;
    else if (alert.type === "rsi_below" && signal?.rsi <= alert.value) shouldTrigger = true;

    if (shouldTrigger) {
      const msg = alert.message || `${alert.symbol} ${alert.type} ${alert.value} (current: $${currentPrice})`;
      triggered.push(msg);

      // Send via channel if configured
      if (alert.channel && alert.channel_config) {
        try {
          const config = JSON.parse(alert.channel_config);
          if (alert.channel === "discord" || alert.channel === "slack") {
            await fetch(config.webhook_url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: `🚨 Crypto Alert: ${msg}` }),
              signal: AbortSignal.timeout(5000),
            });
          } else if (alert.channel === "telegram") {
            await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: config.chat_id, text: `🚨 Crypto Alert: ${msg}` }),
              signal: AbortSignal.timeout(5000),
            });
          }
        } catch (e) { console.error(`[crypto-hub] Alert notification failed for ${alert.id}:`, e); }
      }

      db.run("UPDATE crypto_alerts SET triggered = triggered + 1, last_triggered = ? WHERE id = ?", [new Date().toISOString(), alert.id]);
    }
  }

  return triggered;
}

// ─── Portfolio ───────────────────────────────────────────────

export function getPortfolio(): any[] {
  const entries = db.query("SELECT * FROM crypto_portfolio ORDER BY created_at DESC").all() as any[];
  return entries;
}

export async function getPortfolioWithPnL(): Promise<any> {
  const entries = getPortfolio();
  if (entries.length === 0) return { entries: [], totalInvested: 0, totalValue: 0, totalPnl: 0, totalPnlPercent: 0 };

  const dashboard = await getDashboard();
  let totalInvested = 0;
  let totalValue = 0;

  const enriched = entries.map((e: any) => {
    const signal = dashboard.signals?.find((s: any) => s.symbol === e.symbol);
    const currentPrice = signal?.price || 0;
    const invested = e.amount * e.buy_price;
    const value = e.amount * currentPrice;
    const pnl = value - invested;
    const pnlPercent = invested > 0 ? ((pnl / invested) * 100) : 0;
    totalInvested += invested;
    totalValue += value;
    return { ...e, currentPrice, value, invested, pnl: Math.round(pnl * 100) / 100, pnlPercent: Math.round(pnlPercent * 100) / 100 };
  });

  return {
    entries: enriched,
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalValue: Math.round(totalValue * 100) / 100,
    totalPnl: Math.round((totalValue - totalInvested) * 100) / 100,
    totalPnlPercent: totalInvested > 0 ? Math.round(((totalValue - totalInvested) / totalInvested) * 10000) / 100 : 0,
  };
}

export function addPortfolioEntry(symbol: string, amount: number, buyPrice: number, notes?: string): any {
  const id = randomUUID().slice(0, 12);
  const now = new Date().toISOString();
  db.run("INSERT INTO crypto_portfolio (id, symbol, amount, buy_price, notes, created_at) VALUES (?,?,?,?,?,?)",
    [id, symbol.toUpperCase(), amount, buyPrice, notes || null, now]);
  return { id, symbol: symbol.toUpperCase(), amount, buyPrice, notes, createdAt: now };
}

export function removePortfolioEntry(id: string): boolean {
  const r = db.run("DELETE FROM crypto_portfolio WHERE id = ?", [id]);
  return (r.changes ?? 0) > 0;
}
