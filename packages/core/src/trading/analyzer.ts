// Trading module — market analysis with AI-powered insights, watchlist, and historical data
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Analysis {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  recommendation: "BUY" | "HOLD" | "SELL";
  reason: string;
  summary?: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  signals?: Array<{ direction: "bullish" | "bearish"; text: string }>;
  technical?: string;
  fundamental?: string;
  historical?: PricePoint[];
}

export interface PricePoint {
  date: string;
  close: number;
  volume?: number;
}

export interface WatchlistEntry {
  symbol: string;
  addedAt: string;
  note?: string;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), "data");
const WATCHLIST_PATH = join(DATA_DIR, "trading-watchlist.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadWatchlist(): WatchlistEntry[] {
  try {
    if (existsSync(WATCHLIST_PATH)) {
      return JSON.parse(readFileSync(WATCHLIST_PATH, "utf-8")) as WatchlistEntry[];
    }
  } catch {}
  return [];
}

function saveWatchlist(list: WatchlistEntry[]): void {
  ensureDataDir();
  writeFileSync(WATCHLIST_PATH, JSON.stringify(list, null, 2), "utf-8");
}

// ─── Watchlist API ───────────────────────────────────────────────────────────

export function getWatchlist(): WatchlistEntry[] {
  return loadWatchlist();
}

export function addToWatchlist(symbol: string, note?: string): WatchlistEntry {
  const list = loadWatchlist();
  const existing = list.find((e) => e.symbol.toUpperCase() === symbol.toUpperCase());
  if (existing) return existing;
  const entry: WatchlistEntry = { symbol: symbol.toUpperCase(), addedAt: new Date().toISOString(), note };
  list.push(entry);
  saveWatchlist(list);
  return entry;
}

export function removeFromWatchlist(symbol: string): boolean {
  const list = loadWatchlist();
  const idx = list.findIndex((e) => e.symbol.toUpperCase() === symbol.toUpperCase());
  if (idx === -1) return false;
  list.splice(idx, 1);
  saveWatchlist(list);
  return true;
}

// ─── Historical Data ─────────────────────────────────────────────────────────

export async function getHistoricalData(symbol: string, range: "1d" | "5d" | "1mo" | "3mo" | "1y" = "1mo"): Promise<PricePoint[]> {
  try {
    const rangeMap: Record<string, string> = { "1d": "1d", "5d": "5d", "1mo": "1mo", "3mo": "3mo", "1y": "1y" };
    const intervalMap: Record<string, string> = { "1d": "5m", "5d": "30m", "1mo": "1d", "3mo": "1d", "1y": "1wk" };
    const r = rangeMap[range] || "1mo";
    const i = intervalMap[range] || "1d";
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${r}&interval=${i}`
    );
    const data: any = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0];
    if (!quotes) return [];

    return timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split("T")[0],
      close: quotes.close?.[i] ?? 0,
      volume: quotes.volume?.[i] ?? 0,
    })).filter((p) => p.close > 0);
  } catch {
    return [];
  }
}

// ─── AI-Powered Analysis ─────────────────────────────────────────────────────

export async function analyzeSymbol(symbol: string): Promise<Analysis> {
  try {
    // Fetch price data
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`);
    const data: any = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const quotes = result?.indicators?.quote?.[0];
    const timestamps: number[] = result?.timestamp || [];

    if (!meta || !quotes) {
      return { symbol, price: 0, change: 0, changePercent: 0, recommendation: "HOLD", reason: "No data available" };
    }

    const price = meta.regularMarketPrice ?? quotes.close?.[quotes.close.length - 1] ?? 0;
    const prevClose = meta.previousClose ?? quotes.close?.[0] ?? price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    // Build historical data
    const historical: PricePoint[] = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split("T")[0],
      close: quotes.close?.[i] ?? 0,
      volume: quotes.volume?.[i] ?? 0,
    })).filter((p) => p.close > 0);

    // Calculate technical indicators
    const closes = historical.map((p) => p.close);
    const sma5 = simpleMovingAverage(closes, 5);
    const sma20 = simpleMovingAverage(closes, 20);
    const latestSma5 = sma5[sma5.length - 1] ?? price;
    const latestSma20 = sma20[sma20.length - 1] ?? price;
    const priceChange5d = closes.length > 5 ? ((price - closes[closes.length - 5]) / closes[closes.length - 5]) * 100 : 0;
    const volatility = calculateVolatility(closes);

    // Generate AI-powered analysis using available provider
    let aiSummary = "";
    let aiSentiment: "bullish" | "bearish" | "neutral" = "neutral";
    let aiSignals: Array<{ direction: "bullish" | "bearish"; text: string }> = [];

    try {
      const { registry } = await import("../plugin/registry.ts");
      const resolved = registry.resolveModel("deepseek/deepseek-chat");
      if (resolved) {
        const prompt = `Analyze ${symbol} stock:
Price: $${price.toFixed(2)}
Change: ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%
5-day SMA: $${latestSma5.toFixed(2)}
20-day SMA: $${latestSma20.toFixed(2)}
5-day change: ${priceChange5d >= 0 ? "+" : ""}${priceChange5d.toFixed(2)}%
Volatility: ${(volatility * 100).toFixed(2)}%

Provide:
1. A 2-3 sentence summary
2. Sentiment (bullish/bearish/neutral)
3. 2-3 specific signals with direction

Format as JSON: { "summary": "...", "sentiment": "...", "signals": [{"direction": "bullish|bearish", "text": "..."}] }`;

        let response = "";
        await resolved.provider.stream({
          model: resolved.model.id,
          messages: [
            { role: "system", content: "You are a financial analyst. Return ONLY valid JSON." },
            { role: "user", content: prompt },
          ],
          onChunk: (chunk) => {
            if (chunk.type === "text") response += chunk.text;
          },
        });

        // Parse AI response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const ai = JSON.parse(jsonMatch[0]);
          aiSummary = ai.summary || "";
          aiSentiment = ai.sentiment || "neutral";
          aiSignals = ai.signals || [];
        }
      }
    } catch {
      // Fallback to rule-based analysis
    }

    // Combine technical + AI analysis for recommendation
    let recommendation: "BUY" | "HOLD" | "SELL" = "HOLD";
    let reason = "Neutral indicators";

    if (price > latestSma5 && latestSma5 > latestSma20 && changePercent > 0) {
      recommendation = "BUY";
      reason = "Price above both SMAs with positive momentum";
    } else if (price < latestSma5 && latestSma5 < latestSma20 && changePercent < 0) {
      recommendation = "SELL";
      reason = "Price below both SMAs with negative momentum";
    } else if (priceChange5d > 5) {
      recommendation = "BUY";
      reason = "Strong 5-day upward momentum";
    } else if (priceChange5d < -5) {
      recommendation = "SELL";
      reason = "Strong 5-day downward momentum";
    }

    // Override with AI sentiment if available
    if (aiSentiment === "bullish" && recommendation === "HOLD") {
      recommendation = "BUY";
      reason = aiSummary || "AI indicates bullish sentiment";
    } else if (aiSentiment === "bearish" && recommendation === "HOLD") {
      recommendation = "SELL";
      reason = aiSummary || "AI indicates bearish sentiment";
    }

    return {
      symbol,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      recommendation,
      reason,
      summary: aiSummary || undefined,
      sentiment: aiSentiment,
      signals: aiSignals.length > 0 ? aiSignals : undefined,
      technical: `Price: $${price.toFixed(2)} | SMA5: $${latestSma5.toFixed(2)} | SMA20: $${latestSma20.toFixed(2)} | 5d Change: ${priceChange5d >= 0 ? "+" : ""}${priceChange5d.toFixed(2)}% | Volatility: ${(volatility * 100).toFixed(2)}%`,
      historical: historical.slice(-30),
    };
  } catch {
    return { symbol, price: 0, change: 0, changePercent: 0, recommendation: "HOLD", reason: "API error" };
  }
}

// ─── Technical Indicators ────────────────────────────────────────────────────

function simpleMovingAverage(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(data[i]); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result.push(sum / period);
  }
  return result;
}

function calculateVolatility(closes: number[]): number {
  if (closes.length < 2) return 0;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}
