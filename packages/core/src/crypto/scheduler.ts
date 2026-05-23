import type { RawArticle, CuratedNews, NewsDigest, PriceSnapshot, PublicationRecord } from "./types.ts";
import { batchFetchAll, fetchCoinGeckoPrices, markSeen, isDuplicate } from "./scraper.ts";
import { publishToTelegram, publishSpikeAlert } from "./telegram-formatter.ts";
import { calculatePortfolio, checkPortfolioAlerts, formatPnLReport, loadPositions } from "./portfolio.ts";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSubAgent } from "../multi-agent/subagent.ts";

// ─── State ────────────────────────────────────────────────────────
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let spikeIntervalHandle: ReturnType<typeof setInterval> | null = null;
let lastPrices: PriceSnapshot[] = [];
let publications: PublicationRecord[] = [];

const HISTORY_PATH = join(process.cwd(), "data", "crypto_history.json");
const INTERVAL_MS = 45 * 60 * 1000; // 45 min
const SPIKE_INTERVAL_MS = 15 * 60 * 1000; // 15 min
const SPIKE_THRESHOLD = 3; // percent

function loadHistory(): PublicationRecord[] {
  try {
    if (!existsSync(HISTORY_PATH)) return [];
    return JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));
  } catch { return []; }
}

function saveHistory(): void {
  try {
    const dir = HISTORY_PATH.substring(0, HISTORY_PATH.lastIndexOf("\\"));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(HISTORY_PATH, JSON.stringify(publications.slice(-50)), "utf-8");
  } catch { /* best-effort */ }
}

// ─── LLM Curation ─────────────────────────────────────────────────
async function curateArticles(articles: RawArticle[]): Promise<CuratedNews[]> {
  if (articles.length === 0) return [];

  const prompt = `You are a crypto news curator. Analyze these articles and return ONLY a valid JSON array.
For each article, provide: title, url, source, summary (1 sentence), analysis (1 sentence why important),
sentiment ("bullish"|"bearish"|"neutral"), sentimentScore (1-10), priceImpact (1-10), rank (1-5).

Articles:
${articles.slice(0, 20).map((a, i) => `${i + 1}. [${a.source}] ${a.title} — ${a.url}`).join("\n")}

Return a JSON array only, no markdown, no explanation. Max 5 articles.`;

  try {
    const result = await spawnSubAgent(
      { id: `crypto-curator-${Date.now()}`, name: "crypto-curator", systemPrompt: "You are a crypto news analyst. Return only valid JSON.", modelRef: "deepseek/deepseek-chat" },
      prompt,
    );
    if (!result) return [];
    const json = extractJson(result);
    if (!json) return fallbackCurate(articles);
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return fallbackCurate(articles);
    return parsed.slice(0, 5);
  } catch {
    return fallbackCurate(articles);
  }
}

function fallbackCurate(articles: RawArticle[]): CuratedNews[] {
  return articles.slice(0, 5).map((a, i) => ({
    title: a.title,
    url: a.url,
    source: a.source,
    summary: a.summary || "No summary available.",
    analysis: "Auto-curated.",
    sentiment: "neutral" as const,
    sentimentScore: 5,
    priceImpact: 5,
    rank: i + 1,
    publishedAt: a.publishedAt,
  }));
}

function extractJson(text: string): string | null {
  const match = text.match(/\[[\s\S]*\]/);
  return match ? match[0] : null;
}

// ─── Main run ─────────────────────────────────────────────────────
export async function runCryptoDigest(): Promise<{ published: number; skipped: number }> {
  console.log("[crypto] Running news digest...");

  // 1. Fetch
  const articles = await batchFetchAll();
  if (articles.length === 0) {
    console.log("[crypto] No articles fetched");
    return { published: 0, skipped: 0 };
  }

  // 2. Dedup
  const fresh = articles.filter((a) => !isDuplicate(a.title, a.source));
  const skipped = articles.length - fresh.length;
  console.log(`[crypto] Fetched ${articles.length}, new: ${fresh.length}, dupes: ${skipped}`);

  if (fresh.length === 0) {
    console.log("[crypto] No new articles");
    return { published: 0, skipped };
  }

  // 3. Curate
  const curated = await curateArticles(fresh);
  if (curated.length === 0) {
    console.log("[crypto] No articles after curation");
    return { published: 0, skipped };
  }

  // 4. Get prices
  const prices = await fetchCoinGeckoPrices();

  // 5. Build digest
  const moodBreakdown = { bullish: 0, bearish: 0, neutral: 0 };
  for (const c of curated) moodBreakdown[c.sentiment]++;
  const mood = moodBreakdown.bullish > moodBreakdown.bearish ? "bullish" as const
    : moodBreakdown.bearish > moodBreakdown.bullish ? "bearish" as const
    : "neutral" as const;

  const digest: NewsDigest = {
    articles: curated,
    marketMood: mood,
    moodBreakdown,
    topPrices: prices.map((p) => ({ symbol: p.symbol, price: p.price, change24h: p.change24h })),
    generatedAt: new Date().toISOString(),
  };

  // 6. Publish
  const ok = await publishToTelegram(digest);
  if (ok) {
    markSeen(curated);
    console.log("[crypto] Digest published to Telegram");
  } else {
    console.warn("[crypto] Telegram publish failed or no channel configured");
  }

  // 7. Record and update portfolio
  const record: PublicationRecord = {
    id: `pub-${Date.now()}`,
    timestamp: Date.now(),
    articleCount: curated.length,
    skippedCount: skipped,
    digestPreview: curated[0]?.title?.slice(0, 60) || "",
  };
  publications.push(record);
  saveHistory();

  return { published: curated.length, skipped };
}

// ─── Spike check ──────────────────────────────────────────────────
export async function checkPriceSpike(): Promise<void> {
  const prices = await fetchCoinGeckoPrices();
  if (prices.length === 0) return;

  for (const p of prices) {
    if (Math.abs(p.change1h) >= SPIKE_THRESHOLD) {
      console.log(`[crypto] Spike detected: ${p.symbol} ${p.change1h.toFixed(1)}%`);
      await publishSpikeAlert(p.symbol, p.price, p.change1h);
      // Also run a fresh digest
      await runCryptoDigest();
    }
  }

  lastPrices = prices.map((p) => ({ symbol: p.symbol, price: p.price, change24h: p.change24h, change1h: p.change1h, timestamp: Date.now() }));
}

// ─── Daily portfolio report ───────────────────────────────────────
export async function runDailyPortfolioReport(): Promise<void> {
  const snapshot = await calculatePortfolio();
  if (!snapshot) return;
  const report = formatPnLReport(snapshot);

  try {
    const { channelManager } = await import("../channel/manager.ts");
    const channels = await channelManager.list();
    const tgChannel = channels.find((c: any) => c.id === "telegram");
    if (tgChannel) {
      await channelManager.send(tgChannel.id, report);
    }
  } catch { /* ignore */ }
}

// ─── Start / Stop ─────────────────────────────────────────────────
export function startScheduler(): void {
  if (intervalHandle) return;

  console.log("[crypto] Starting scheduler (every 45 min)...");
  publications = loadHistory();

  // Run immediately on start
  runCryptoDigest().catch(console.error);

  // Main interval
  intervalHandle = setInterval(() => {
    runCryptoDigest().catch(console.error);
  }, INTERVAL_MS);

  // Price spike check (every 15 min)
  spikeIntervalHandle = setInterval(() => {
    checkPriceSpike().catch(console.error);
  }, SPIKE_INTERVAL_MS);

  // Portfolio alert check
  spikeIntervalHandle = setInterval(() => {
    checkPortfolioAlerts().catch(console.error);
  }, SPIKE_INTERVAL_MS);

  // Daily portfolio report at 20:00
  scheduleDailyReport();
}

export function stopScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (spikeIntervalHandle) {
    clearInterval(spikeIntervalHandle);
    spikeIntervalHandle = null;
  }
  console.log("[crypto] Scheduler stopped");
}

export function getStatus(): { running: boolean; nextRun: number | null; lastRun: number | null; publishedToday: number } {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const publishedToday = publications.filter((p) => p.timestamp >= todayStart.getTime()).length;
  const lastRun = publications.length > 0 ? publications[publications.length - 1].timestamp : null;
  const nextRun = intervalHandle ? (lastRun || now) + INTERVAL_MS : null;

  return { running: intervalHandle !== null, nextRun, lastRun, publishedToday };
}

export function getHistory(): PublicationRecord[] {
  return publications.slice(-20);
}

// ─── Daily schedule helper ────────────────────────────────────────
function scheduleDailyReport(): void {
  const now = new Date();
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  let msUntil = target.getTime() - now.getTime();
  if (msUntil < 0) msUntil += 24 * 60 * 60 * 1000; // Next day

  setTimeout(() => {
    runDailyPortfolioReport().catch(console.error);
    // Reschedule for next day
    scheduleDailyReport();
  }, msUntil);
}
