import type { RawArticle } from "./types.ts";

const SOURCES = [
  { id: "coindesk", name: "CoinDesk", url: "https://www.coindesk.com/headlines", selector: "h2 a" },
  { id: "cointelegraph", name: "CoinTelegraph", url: "https://cointelegraph.com/latest", selector: "article h2 a" },
  { id: "theblock", name: "The Block", url: "https://www.theblock.co/latest", selector: "h3 a" },
  { id: "decrypt", name: "Decrypt", url: "https://decrypt.co/news", selector: "h3 a" },
  { id: "cryptoslate", name: "CryptoSlate", url: "https://cryptoslate.com/latest", selector: "h3 a" },
] as const;

// ─── Cache dedup ─────────────────────────────────────────────────
const CACHE_PATH = process.env.NOVA_CRYPTO_CACHE || join(process.cwd(), "data", "crypto_cache.json");
const CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48h
const MAX_CACHE = 500;

import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

interface CacheEntry {
  hash: string;
  title: string;
  source: string;
  seen: number;
  firstSeen: number;
}

function loadCache(): CacheEntry[] {
  try {
    if (!existsSync(CACHE_PATH)) return [];
    const raw = readFileSync(CACHE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch { return []; }
}

function saveCache(entries: CacheEntry[]): void {
  try {
    const dir = CACHE_PATH.substring(0, CACHE_PATH.lastIndexOf("\\"));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(entries.slice(0, MAX_CACHE)), "utf-8");
  } catch { /* best-effort */ }
}

function hashArticle(title: string, source: string): string {
  let h = 0;
  const s = title + source;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return h.toString(36);
}

function pruneCache(cache: CacheEntry[]): CacheEntry[] {
  const now = Date.now();
  return cache.filter((e) => now - e.firstSeen < CACHE_TTL_MS);
}

export function isDuplicate(title: string, source: string): boolean {
  const cache = loadCache();
  const h = hashArticle(title, source);
  return cache.some((e) => e.hash === h);
}

export function markSeen(articles: RawArticle[]): void {
  const cache = pruneCache(loadCache());
  const existing = new Set(cache.map((e) => e.hash));
  for (const a of articles) {
    const h = hashArticle(a.title, a.source);
    if (existing.has(h)) {
      const entry = cache.find((e) => e.hash === h);
      if (entry) entry.seen++;
    } else {
      cache.push({ hash: h, title: a.title, source: a.source, seen: 1, firstSeen: Date.now() });
      existing.add(h);
    }
  }
  saveCache(cache);
}

// ─── Scraper ──────────────────────────────────────────────────────
export async function scrapeSource(source: typeof SOURCES[number]): Promise<RawArticle[]> {
  try {
    const res = await fetch(source.url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Nova-CryptoBot/1.0" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseHtmlArticles(html, source);
  } catch {
    return [];
  }
}

function parseHtmlArticles(html: string, source: typeof SOURCES[number]): RawArticle[] {
  const articles: RawArticle[] = [];
  // Simple HTML parsing — extract <a> tags with text
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const titleRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  const titleTexts = new Set<string>();

  // Extract titles from headings
  let m;
  while ((m = titleRegex.exec(html)) !== null) {
    const text = stripHtml(m[1]).trim();
    if (text.length > 10) titleTexts.add(text);
  }

  // Match with links
  while ((m = linkRegex.exec(html)) !== null) {
    let href = m[1];
    const linkText = stripHtml(m[2]).trim();
    if (linkText.length < 10) continue;

    // Find matching title
    let title = "";
    for (const t of titleTexts) {
      if (linkText.includes(t) || t.includes(linkText)) {
        title = t;
        break;
      }
    }
    if (!title) title = linkText;

    // Normalize URL
    if (href.startsWith("/")) href = `https://${new URL(source.url).hostname}${href}`;
    else if (!href.startsWith("http")) href = `${new URL(source.url).origin}/${href}`;

    articles.push({
      title: title.slice(0, 200),
      url: href,
      source: source.name,
      summary: "",
      publishedAt: new Date().toISOString(),
    });
  }

  // Dedup by title within batch
  const seen = new Set<string>();
  return articles.filter((a) => {
    const key = a.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 15);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
}

// ─── Batch fetch — uruchamia wszystkie źródła równolegle ──────────
export async function batchFetchAll(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(SOURCES.map((s) => scrapeSource(s)));
  const all: RawArticle[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return all;
}

// ─── CoinGecko price ──────────────────────────────────────────────
export async function fetchCoinGeckoPrices(): Promise<{ symbol: string; price: number; change24h: number; change1h: number }[]> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_1hr_change=true",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return [
      { symbol: "BTC", price: data.bitcoin?.usd || 0, change24h: data.bitcoin?.usd_24h_change || 0, change1h: data.bitcoin?.usd_1h_change || 0 },
      { symbol: "ETH", price: data.ethereum?.usd || 0, change24h: data.ethereum?.usd_24h_change || 0, change1h: data.ethereum?.usd_1h_change || 0 },
      { symbol: "SOL", price: data.solana?.usd || 0, change24h: data.solana?.usd_24h_change || 0, change1h: data.solana?.usd_1h_change || 0 },
    ];
  } catch { return []; }
}
