// Crypto & Trading Hub — main coordinator
import type { CryptoHubState, PriceSnapshot, TradingSignal, MarketScreener, WhaleAlert, OnChainMetrics, WatchlistEntry } from "./types.ts";
import * as cg from "./coingecko.ts";
import * as ai from "./ai-analyzer.ts";
import * as pf from "./portfolio.ts";
import * as news from "./news.ts";
import * as whales from "./whales.ts";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data", "crypto-hub");
const WATCHLIST_PATH = join(DATA_DIR, "watchlist.json");
const STATE_PATH = join(DATA_DIR, "state.json");
const CACHE_TTL = 60_000; // 1 min cache

let _coinsCache: { data: any[]; ts: number } = { data: [], ts: 0 };
let _trendingCache: { data: any[]; ts: number } = { data: [], ts: 0 };

function ensureDir() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }

async function getCachedTopCoins(count: number) {
  const now = Date.now();
  if (_coinsCache.data.length >= count && now - _coinsCache.ts < CACHE_TTL) return _coinsCache.data.slice(0, count);
  const coins = await cg.getTopCoins(250);
  _coinsCache = { data: coins, ts: now };
  return coins.slice(0, count);
}

async function getCachedTrending() {
  const now = Date.now();
  if (_trendingCache.data.length > 0 && now - _trendingCache.ts < CACHE_TTL) return _trendingCache.data;
  const trending = await cg.getTrending();
  _trendingCache = { data: trending, ts: now };
  return trending;
}

// ─── State ───────────────────────────────────────────────────────────────────

let state: CryptoHubState = {
  screener: null,
  portfolio: null,
  watchlist: [],
  news: null,
  whales: [],
  onChain: {},
  selectedSymbol: null,
  selectedPriceHistory: null,
  lastUpdated: 0,
};

function loadState() {
  ensureDir();
  try {
    if (existsSync(STATE_PATH)) state = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
  } catch {}
}

function saveState() {
  ensureDir();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

// ─── Watchlist ───────────────────────────────────────────────────────────────

function loadWatchlist(): WatchlistEntry[] {
  ensureDir();
  try {
    if (existsSync(WATCHLIST_PATH)) return JSON.parse(readFileSync(WATCHLIST_PATH, "utf-8"));
  } catch {}
  return [];
}

function saveWatchlist(wl: WatchlistEntry[]) {
  ensureDir();
  writeFileSync(WATCHLIST_PATH, JSON.stringify(wl, null, 2), "utf-8");
}

// ─── Hub API ─────────────────────────────────────────────────────────────────

export async function refreshMarket(): Promise<MarketScreener> {
  const [coins, trending] = await Promise.all([
    getCachedTopCoins(100),
    getCachedTrending(),
  ]);

  const { topGainers, topLosers, aiPicks } = await ai.screenMarket(coins);

  const screener: MarketScreener = {
    topGainers,
    topLosers,
    mostVolume: coins.sort((a, b) => b.volume24h - a.volume24h).slice(0, 10),
    trendingTokens: trending.slice(0, 10),
    aiPicks,
    updatedAt: new Date().toISOString(),
  };

  state.screener = screener;
  state.lastUpdated = Date.now();
  saveState();
  return screener;
}

export async function refreshPortfolio(): Promise<any> {
  const coins = await getCachedTopCoins(250);
  const snapshot = pf.getPortfolioSnapshot(coins);
  state.portfolio = snapshot;
  saveState();
  return snapshot;
}

export async function refreshNews(): Promise<any> {
  const digest = await news.generateNewsDigest();
  // Add top prices
  try {
    const coins = await getCachedTopCoins(5);
    digest.topPrices = coins.map(c => ({ symbol: c.symbol, price: c.price, change24h: c.changePercent24h }));
  } catch {}
  state.news = digest;
  saveState();
  return digest;
}

export async function refreshWhales(): Promise<WhaleAlert[]> {
  let alerts: WhaleAlert[] = [];
  try {
    alerts = await whales.getLargeTransactions(1_000_000);
  } catch {}
  if (alerts.length === 0) {
    try {
      alerts = await whales.getWhaleAlerts(500_000);
    } catch {}
  }
  state.whales = alerts;
  saveState();
  return alerts;
}

export async function refreshAll(): Promise<CryptoHubState> {
  loadState();
  await Promise.allSettled([
    refreshMarket(),
    refreshPortfolio(),
    refreshNews(),
    refreshWhales(),
  ]);
  return state;
}

export function getState(): CryptoHubState {
  loadState();
  return state;
}

export async function getCoinDetails(symbol: string): Promise<PriceSnapshot | null> {
  return cg.getCoinDetails(symbol);
}

export async function getPriceHistory(symbol: string, days: number | "max" = 7): Promise<any> {
  const history = await cg.getPriceHistory(symbol, days);
  state.selectedSymbol = symbol;
  state.selectedPriceHistory = history;
  saveState();
  return history;
}

export async function searchCoins(query: string): Promise<any[]> {
  return cg.searchCoins(query);
}

export async function getGlobalData(): Promise<any> {
  return cg.getGlobalData();
}

export async function analyzeSymbol(symbol: string): Promise<TradingSignal> {
  const snap = await cg.getCoinDetails(symbol);
  if (!snap) throw new Error(`Could not fetch ${symbol}`);

  const history = await cg.getPriceHistory(symbol, 30);
  const prices = history.prices.map(([, p]) => p);
  const volumes = history.volumes.map(([, v]) => v);
  const ind = ai.calculateIndicators(prices, volumes);

  // Get on-chain data
  let onChain: OnChainMetrics | null = null;
  try { onChain = await whales.getOnChainMetrics(symbol); } catch {}

  const signal = await ai.analyzeSymbol(symbol, snap, ind);
  state.onChain[symbol] = onChain || {} as any;
  saveState();
  return signal;
}

// ─── Watchlist ops ───────────────────────────────────────────────────────────

export async function addToWatchlist(symbol: string): Promise<WatchlistEntry[]> {
  let wl = loadWatchlist();
  if (wl.some(w => w.symbol.toUpperCase() === symbol.toUpperCase())) return wl;

  let name = symbol;
  let price = 0;
  try {
    const details = await cg.getCoinDetails(symbol);
    if (details) { name = details.name; price = details.price; }
  } catch {}

  wl.push({ symbol: symbol.toUpperCase(), name, price, change24h: 0, addedAt: new Date().toISOString() });
  saveWatchlist(wl);
  state.watchlist = wl;
  saveState();
  return wl;
}

export async function removeFromWatchlist(symbol: string): Promise<WatchlistEntry[]> {
  let wl = loadWatchlist();
  wl = wl.filter(w => w.symbol.toUpperCase() !== symbol.toUpperCase());
  saveWatchlist(wl);
  state.watchlist = wl;
  saveState();
  return wl;
}

export async function getWatchlist(): Promise<WatchlistEntry[]> {
  const wl = loadWatchlist();
  if (wl.length === 0) return [];

  // Update prices
  try {
    const ids = wl.map(w => w.symbol.toLowerCase()).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(5000) },
    );
    const data: any = await res.json();

    // CoinGecko simple/price doesn't support multiple custom IDs well.
    // Instead update using top coins list
    const coins = await getCachedTopCoins(250);
    const priceMap = new Map(coins.map(c => [c.symbol.toUpperCase(), c]));

    for (const w of wl) {
      const p = priceMap.get(w.symbol.toUpperCase());
      if (p) { w.price = p.price; w.change24h = p.changePercent24h; }
    }
  } catch {}

  saveWatchlist(wl);
  state.watchlist = wl;
  saveState();
  return wl;
}

// ─── Portfolio ops (delegates) ───────────────────────────────────────────────

export { addPosition, removePosition, getPortfolioSnapshot, getTransactions } from "./portfolio.ts";

// ─── Export for direct access ─────────────────────────────────────────────────
export * from "./types.ts";
export { calculateIndicators, screenMarket } from "./ai-analyzer.ts";
export * as coingecko from "./coingecko.ts";
