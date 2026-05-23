import type { PortfolioPosition, PortfolioSnapshot, PriceSnapshot } from "./types.ts";
import { fetchCoinGeckoPrices } from "./scraper.ts";
import { publishPortfolioAlert } from "./telegram-formatter.ts";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const POSITIONS_PATH = join(process.cwd(), "data", "crypto_portfolio.json");
const PRICE_HISTORY_PATH = join(process.cwd(), "data", "crypto_price_history.json");
const ALERT_THRESHOLD_PERCENT = 10; // alert if position drops >10%

// ID mapping: symbol -> CoinGecko ID
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDC: "usdc",
  USDT: "tether",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  DOGE: "dogecoin",
};

// ─── Positions ───────────────────────────────────────────────────
export function loadPositions(): PortfolioPosition[] {
  try {
    if (!existsSync(POSITIONS_PATH)) return [];
    return JSON.parse(readFileSync(POSITIONS_PATH, "utf-8"));
  } catch { return []; }
}

export function savePositions(positions: PortfolioPosition[]): void {
  try {
    const dir = POSITIONS_PATH.substring(0, POSITIONS_PATH.lastIndexOf("\\"));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(POSITIONS_PATH, JSON.stringify(positions, null, 2), "utf-8");
  } catch { /* best-effort */ }
}

function loadPriceHistory(): Record<string, { price: number; timestamp: number }> {
  try {
    if (!existsSync(PRICE_HISTORY_PATH)) return {};
    return JSON.parse(readFileSync(PRICE_HISTORY_PATH, "utf-8"));
  } catch { return {}; }
}

function savePriceHistory(history: Record<string, { price: number; timestamp: number }>): void {
  try {
    writeFileSync(PRICE_HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");
  } catch { /* best-effort */ }
}

// ─── Portfolio calculation ────────────────────────────────────────
export async function calculatePortfolio(): Promise<PortfolioSnapshot | null> {
  const positions = loadPositions();
  if (positions.length === 0) return null;

  const prices = await fetchCoinGeckoPrices();
  const priceMap: Record<string, number> = {};
  for (const p of prices) priceMap[p.symbol] = p.price;

  // Stablecoins always $1
  priceMap["USDC"] = 1;
  priceMap["USDT"] = 1;

  let totalValue = 0;
  let totalCost = 0;
  const updatedPositions: PortfolioPosition[] = [];

  for (const pos of positions) {
    const currentPrice = priceMap[pos.symbol];
    if (!currentPrice) {
      updatedPositions.push(pos);
      continue;
    }
    const value = pos.amount * currentPrice;
    totalValue += value;
    totalCost += pos.amount * (pos.entryPrice || currentPrice);
    updatedPositions.push({ ...pos, entryPrice: pos.entryPrice || currentPrice });
  }

  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  return {
    positions: updatedPositions,
    totalValue,
    totalPnl,
    totalPnlPercent,
    timestamp: Date.now(),
  };
}

// ─── Alert check ─────────────────────────────────────────────────
export async function checkPortfolioAlerts(): Promise<void> {
  const history = loadPriceHistory();
  const positions = loadPositions();
  if (positions.length === 0) return;

  const prices = await fetchCoinGeckoPrices();
  const priceMap: Record<string, number> = {};
  for (const p of prices) priceMap[p.symbol] = p.price;
  priceMap["USDC"] = 1;
  priceMap["USDT"] = 1;

  for (const pos of positions) {
    const currentPrice = priceMap[pos.symbol];
    if (!currentPrice) continue;

    const previous = history[pos.symbol];
    if (previous && previous.price > 0) {
      const changePercent = ((currentPrice - previous.price) / previous.price) * 100;
      const valueChange = pos.amount * (currentPrice - previous.price);
      const oldValue = pos.amount * previous.price;
      const newValue = pos.amount * currentPrice;

      if (Math.abs(changePercent) >= ALERT_THRESHOLD_PERCENT) {
        await publishPortfolioAlert(
          `${pos.amount} ${pos.symbol}`,
          changePercent,
          valueChange,
          oldValue,
          newValue,
        );
      }
    }
  }

  // Update price history
  for (const pos of positions) {
    const p = priceMap[pos.symbol];
    if (p) history[pos.symbol] = { price: p, timestamp: Date.now() };
  }
  savePriceHistory(history);
}

// ─── Daily P&L report ────────────────────────────────────────────
export function formatPnLReport(snapshot: PortfolioSnapshot): string {
  const date = new Date(snapshot.timestamp).toLocaleDateString("pl-PL", {
    day: "numeric", month: "long", year: "numeric",
  });
  const sign = snapshot.totalPnl >= 0 ? "+" : "";
  const emoji = snapshot.totalPnlPercent >= 0 ? "\u{1F4C8}" : "\u{1F4C9}";

  const lines = [
    `${emoji} *Portfolio P&L* \u2014 ${date}`,
    "",
    `Total Value: $${snapshot.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `P&L: ${sign}$${snapshot.totalPnl.toFixed(2)} (${sign}${snapshot.totalPnlPercent.toFixed(2)}%)`,
    "",
    "Breakdown:",
  ];

  for (const pos of snapshot.positions) {
    const pnl = pos.entryPrice ? (snapshot.totalPnl / snapshot.totalValue) * 100 : 0;
    lines.push(`  \u2022 ${pos.amount} ${pos.symbol} — $${(pos.amount * (snapshot.totalValue / snapshot.positions.length)).toFixed(0)}`);
  }

  return lines.join("\n");
}
