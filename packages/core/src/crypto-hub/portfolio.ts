// Portfolio tracker with local storage
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PortfolioPosition, PortfolioSnapshot, Transaction } from "./types.ts";
import type { PriceSnapshot } from "./types.ts";

const DATA_DIR = join(process.cwd(), "data", "crypto-hub");
const PORTFOLIO_PATH = join(DATA_DIR, "portfolio.json");
const TX_PATH = join(DATA_DIR, "transactions.json");

function ensureDir() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }

// ─── Portfolio Positions ──────────────────────────────────────────────────────

export function getPortfolio(): PortfolioPosition[] {
  ensureDir();
  try {
    if (!existsSync(PORTFOLIO_PATH)) return [];
    return JSON.parse(readFileSync(PORTFOLIO_PATH, "utf-8"));
  } catch { return []; }
}

export function savePortfolio(positions: PortfolioPosition[]): void {
  ensureDir();
  writeFileSync(PORTFOLIO_PATH, JSON.stringify(positions, null, 2), "utf-8");
}

export function addPosition(symbol: string, name: string, amount: number, buyPrice: number, note?: string): PortfolioPosition[] {
  const positions = getPortfolio();
  const existing = positions.find(p => p.symbol.toUpperCase() === symbol.toUpperCase());
  if (existing) {
    const totalAmount = existing.amount + amount;
    existing.avgBuyPrice = ((existing.avgBuyPrice * existing.amount) + (buyPrice * amount)) / totalAmount;
    existing.amount = totalAmount;
  } else {
    positions.push({
      symbol: symbol.toUpperCase(),
      name,
      amount,
      avgBuyPrice: buyPrice,
      currentPrice: buyPrice,
      value: amount * buyPrice,
      pnl: 0,
      pnlPercent: 0,
      allocation: 0,
      addedAt: new Date().toISOString(),
    });
  }

  // Record transaction
  addTransaction({
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    symbol: symbol.toUpperCase(),
    type: "buy",
    amount,
    price: buyPrice,
    total: amount * buyPrice,
    timestamp: new Date().toISOString(),
    note,
  });

  savePortfolio(positions);
  return positions;
}

export function removePosition(symbol: string, amount: number, sellPrice: number): PortfolioPosition[] {
  let positions = getPortfolio();
  const idx = positions.findIndex(p => p.symbol.toUpperCase() === symbol.toUpperCase());
  if (idx < 0) return positions;

  const pos = positions[idx];
  const sellAmount = Math.min(amount, pos.amount);
  const pnl = (sellPrice - pos.avgBuyPrice) * sellAmount;

  addTransaction({
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    symbol: symbol.toUpperCase(),
    type: "sell",
    amount: sellAmount,
    price: sellPrice,
    total: sellAmount * sellPrice,
    fee: 0,
    timestamp: new Date().toISOString(),
    note: `PnL: $${pnl.toFixed(2)}`,
  });

  pos.amount -= sellAmount;
  if (pos.amount <= 0.00001) {
    positions = positions.filter(p => p.symbol.toUpperCase() !== symbol.toUpperCase());
  }

  savePortfolio(positions);
  return positions;
}

// ─── Valuation ────────────────────────────────────────────────────────────────

export function getPortfolioSnapshot(prices: PriceSnapshot[]): PortfolioSnapshot {
  const positions = getPortfolio();
  const priceMap = new Map(prices.map(p => [p.symbol.toUpperCase(), p.price]));

  let totalValue = 0, totalInvested = 0;

  for (const pos of positions) {
    pos.currentPrice = priceMap.get(pos.symbol) ?? pos.avgBuyPrice;
    pos.value = pos.amount * pos.currentPrice;
    pos.pnl = (pos.currentPrice - pos.avgBuyPrice) * pos.amount;
    pos.pnlPercent = pos.avgBuyPrice > 0 ? ((pos.currentPrice - pos.avgBuyPrice) / pos.avgBuyPrice) * 100 : 0;
    totalValue += pos.value;
    totalInvested += pos.amount * pos.avgBuyPrice;
  }

  for (const pos of positions) {
    pos.allocation = totalValue > 0 ? (pos.value / totalValue) * 100 : 0;
  }

  const sortedByPnl = [...positions].sort((a, b) => b.pnlPercent - a.pnlPercent);

  return {
    positions,
    totalValue,
    totalInvested,
    totalPnl: totalValue - totalInvested,
    totalPnlPercent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
    bestPerformer: sortedByPnl[0]?.symbol ?? "",
    worstPerformer: sortedByPnl[sortedByPnl.length - 1]?.symbol ?? "",
    timestamp: Date.now(),
  };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function getTransactions(): Transaction[] {
  ensureDir();
  try {
    if (!existsSync(TX_PATH)) return [];
    return JSON.parse(readFileSync(TX_PATH, "utf-8"));
  } catch { return []; }
}

function addTransaction(tx: Transaction): void {
  const txs = getTransactions();
  txs.unshift(tx);
  writeFileSync(TX_PATH, JSON.stringify(txs.slice(0, 500), null, 2), "utf-8");
}
