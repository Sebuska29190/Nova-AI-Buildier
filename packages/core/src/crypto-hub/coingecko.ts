// CoinGecko API client — free tier (30 req/min), no API key needed for basic
import type { PriceSnapshot, PriceHistory } from "./types.ts";

const BASE = "https://api.coingecko.com/api/v3";

// Cache in-memory to avoid rate limits
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 30_000; // 30s for prices, 5min for history

// Global rate limiter: free tier = 30 req/min, we do 1 req per 3s to be safe
let _lastRequest = 0;
async function rateLimit() {
  const now = Date.now();
  const wait = _lastRequest + 3000 - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastRequest = Date.now();
}

function cached(key: string, ttl = CACHE_TTL): any | undefined {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  return undefined;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
  // Prune old entries
  if (cache.size > 200) {
    for (const [k, v] of cache) {
      if (Date.now() - v.ts > 300_000) cache.delete(k);
    }
  }
}

async function fetchJSON(url: string, ttl?: number): Promise<any> {
  const c = cached(url, ttl);
  if (c) return c;
  await rateLimit();
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json();
  setCache(url, data);
  return data;
}

// ─── Coin list (symbol → id mapping) ──────────────────────────────────────────
let coinListCache: Map<string, { id: string; symbol: string; name: string }> | null = null;

async function getCoinList(): Promise<Map<string, { id: string; symbol: string; name: string }>> {
  if (coinListCache) return coinListCache;
  const data = await fetchJSON(`${BASE}/coins/list`, 3600_000); // cache 1h
  coinListCache = new Map();
  for (const c of data) {
    coinListCache.set(c.symbol.toLowerCase(), c);
  }
  return coinListCache;
}

// ─── Top market data ──────────────────────────────────────────────────────────

export async function getTopCoins(limit = 100): Promise<PriceSnapshot[]> {
  const data = await fetchJSON(
    `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=24h`,
    15000,
  );
  return data.map((c: any) => ({
    symbol: c.symbol?.toUpperCase(),
    name: c.name,
    price: c.current_price ?? 0,
    change24h: c.price_change_24h ?? 0,
    changePercent24h: c.price_change_percentage_24h ?? 0,
    marketCap: c.market_cap ?? 0,
    volume24h: c.total_volume ?? 0,
    high24h: c.high_24h ?? 0,
    low24h: c.low_24h ?? 0,
    ath: c.ath ?? 0,
    athDate: c.ath_date ?? "",
    supply: c.circulating_supply ?? 0,
    rank: c.market_cap_rank ?? 0,
    sparkline7d: c.sparkline_in_7d?.price ?? [],
    timestamp: Date.now(),
  }));
}

export async function getTrending(): Promise<PriceSnapshot[]> {
  const data = await fetchJSON(`${BASE}/search/trending`, 60000);
  return (data.coins ?? []).map((c: any) => {
    const item = c.item ?? {};
    return {
      symbol: item.symbol?.toUpperCase(),
      name: item.name,
      price: item.data?.price ?? 0,
      changePercent24h: item.data?.price_change_percentage_24h?.usd ?? 0,
      marketCap: item.data?.market_cap ?? "",
      rank: item.market_cap_rank ?? 0,
      sparkline7d: item.data?.sparkline ?? [],
    } as PriceSnapshot;
  });
}

export async function getGainersLosers(): Promise<{ gainers: PriceSnapshot[]; losers: PriceSnapshot[] }> {
  const coins = await getTopCoins(250);
  const sorted = [...coins].sort((a, b) => b.changePercent24h - a.changePercent24h);
  return {
    gainers: sorted.slice(0, 10),
    losers: sorted.slice(-10).reverse(),
  };
}

// ─── Price History (candles) ──────────────────────────────────────────────────

export async function getPriceHistory(symbol: string, days: number | "max" = 7): Promise<PriceHistory> {
  const list = await getCoinList();
  const id = list.get(symbol.toLowerCase())?.id;
  if (!id) throw new Error(`Unknown symbol: ${symbol}`);

  const data = await fetchJSON(
    `${BASE}/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
    300_000,
  );

  return {
    symbol: symbol.toUpperCase(),
    prices: data.prices ?? [],
    marketCaps: data.market_caps ?? [],
    volumes: data.total_volumes ?? [],
  };
}

export async function getCoinDetails(symbol: string): Promise<PriceSnapshot | null> {
  const list = await getCoinList();
  const id = list.get(symbol.toLowerCase())?.id;
  if (!id) return null;

  const data = await fetchJSON(
    `${BASE}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=true`,
    30000,
  );
  const m = data.market_data ?? {};
  return {
    symbol: data.symbol?.toUpperCase(),
    name: data.name,
    price: m.current_price?.usd ?? 0,
    change24h: m.price_change_24h ?? 0,
    changePercent24h: m.price_change_percentage_24h ?? 0,
    marketCap: m.market_cap?.usd ?? 0,
    volume24h: m.total_volume?.usd ?? 0,
    high24h: m.high_24h?.usd ?? 0,
    low24h: m.low_24h?.usd ?? 0,
    ath: m.ath?.usd ?? 0,
    athDate: m.ath_date?.usd ?? "",
    supply: m.circulating_supply ?? 0,
    rank: data.market_cap_rank ?? 0,
    sparkline7d: m.sparkline_7d?.price ?? [],
    timestamp: Date.now(),
  };
}

export async function searchCoins(query: string): Promise<{ symbol: string; name: string; rank: number }[]> {
  const data = await fetchJSON(`${BASE}/search?query=${encodeURIComponent(query)}`, 30000);
  return (data.coins ?? []).slice(0, 20).map((c: any) => ({
    symbol: c.symbol?.toUpperCase(),
    name: c.name,
    rank: c.market_cap_rank ?? 9999,
  }));
}

// ─── Global stats ─────────────────────────────────────────────────────────────

export async function getGlobalData(): Promise<{
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  activeCoins: number;
  marketCapChange24h: number;
}> {
  const data = await fetchJSON(`${BASE}/global`, 60000);
  const d = data.data ?? {};
  return {
    totalMarketCap: d.total_market_cap?.usd ?? 0,
    totalVolume24h: d.total_volume?.usd ?? 0,
    btcDominance: d.market_cap_percentage?.btc ?? 0,
    ethDominance: d.market_cap_percentage?.eth ?? 0,
    activeCoins: d.active_cryptocurrencies ?? 0,
    marketCapChange24h: d.market_cap_change_percentage_24h_usd ?? 0,
  };
}
