// Crypto News Aggregator with AI Sentiment Analysis
import type { RawArticle, CuratedNews, NewsDigest } from "./types.ts";

const SOURCES = [
  { id: "coindesk", name: "CoinDesk", rss: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { id: "cointelegraph", name: "CoinTelegraph", rss: "https://cointelegraph.com/rss" },
  { id: "theblock", name: "The Block", rss: "https://www.theblock.co/rss.xml" },
  { id: "decrypt", name: "Decrypt", rss: "https://decrypt.co/feed" },
  { id: "cointelegraph-latest", name: "CoinTelegraph", rss: "https://cointelegraph.com/rss/tag/bitcoin" },
  { id: "bitcoinmagazine", name: "Bitcoin Magazine", rss: "https://bitcoinmagazine.com/.rss/full/" },
  { id: "cryptoslate", name: "CryptoSlate", rss: "https://cryptoslate.com/feed/" },
  { id: "beincrypto", name: "BeInCrypto", rss: "https://beincrypto.com/feed/" },
  { id: "newsbtc", name: "NewsBTC", rss: "https://www.newsbtc.com/feed/" },
  { id: "ambcrypto", name: "AMB Crypto", rss: "https://ambcrypto.com/feed/" },
  { id: "zycrypto", name: "ZyCrypto", rss: "https://zycrypto.com/feed/" },
  { id: "cryptobriefing", name: "Crypto Briefing", rss: "https://cryptobriefing.com/feed/" },
  { id: "dailyhodl", name: "The Daily Hodl", rss: "https://dailyhodl.com/feed/" },
  { id: "cryptopotato", name: "Crypto Potato", rss: "https://cryptopotato.com/feed/" },
];

// Cache last 100 articles for dedup
let articleCache: { title: string; url: string; timestamp: number }[] = [];
const MAX_CACHE = 200;

function isDuplicate(title: string, url: string): boolean {
  return articleCache.some(a => a.url === url || (a.title.toLowerCase().trim() === title.toLowerCase().trim()));
}

function addToCache(title: string, url: string) {
  articleCache.unshift({ title, url, timestamp: Date.now() });
  if (articleCache.length > MAX_CACHE) articleCache = articleCache.slice(0, MAX_CACHE);
}

// ─── RSS Parser ───────────────────────────────────────────────────────────────

async function fetchRSS(url: string): Promise<RawArticle[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Nova/1.0 (Crypto News Aggregator)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Simple XML parsing for RSS
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    const articles: RawArticle[] = [];

    for (const item of items.slice(0, 10)) {
      const title = (item.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title[^>]*>([\s\S]*?)<\/title>/))?.[1]?.trim() || "";
      const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/))?.[1]?.trim() || "";
      const desc = (item.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description[^>]*>([\s\S]*?)<\/description>/))?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
      const date = (item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || item.match(/<published[^>]*>([\s\S]*?)<\/published>/))?.[1]?.trim() || new Date().toISOString();

      if (!title || !link) continue;
      if (isDuplicate(title, link)) continue;

      addToCache(title, link);
      articles.push({ title, url: link, source: url, summary: desc.slice(0, 200), publishedAt: date });
    }

    return articles;
  } catch {
    return [];
  }
}

// ─── Scrape multiple sources ──────────────────────────────────────────────────

export async function scrapeAllSources(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(SOURCES.map(s => fetchRSS(s.rss)));
  const articles: RawArticle[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") articles.push(...r.value);
  }
  return articles.slice(0, 50);
}

// ─── AI Sentiment Analysis ────────────────────────────────────────────────────

export async function analyzeSentiment(articles: RawArticle[]): Promise<CuratedNews[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || articles.length === 0) {
    return articles.map((a, i) => ({
      ...a,
      analysis: a.summary,
      sentiment: "neutral" as const,
      sentimentScore: 5,
      priceImpact: 3,
      rank: 3,
    }));
  }

  // Batch analyze: 5 articles per LLM call
  const curated: CuratedNews[] = [];
  const batchSize = 5;

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    const prompt = `Analyze these crypto news headlines for sentiment and price impact. For each, return JSON:

${batch.map((a, j) => `[${j}] ${a.title}`).join("\n")}

Return a JSON object: {"articles":[{"sentiment":"bullish"|"bearish"|"neutral","sentimentScore":1-10,"priceImpact":1-10,"analysis":"1 sentence analysis","rank":1-5}]}

Only return valid JSON.`;

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data: any = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;

      const json = JSON.parse(content.replace(/```json|```/g, "").trim());
      for (let j = 0; j < batch.length; j++) {
        const ai = json.articles?.[j];
        curated.push({
          ...batch[j],
          analysis: ai?.analysis || batch[j].summary,
          sentiment: ai?.sentiment || "neutral",
          sentimentScore: ai?.sentimentScore || 5,
          priceImpact: ai?.priceImpact || 3,
          rank: ai?.rank || 3,
        });
      }
    } catch {
      // AI fail → neutral
      for (const a of batch) {
        curated.push({ ...a, analysis: a.summary, sentiment: "neutral", sentimentScore: 5, priceImpact: 3, rank: 3 });
      }
    }
    await sleep(500);
  }

  return curated.sort((a, b) => b.rank - a.rank);
}

// ─── Full digest ──────────────────────────────────────────────────────────────

export async function generateNewsDigest(): Promise<NewsDigest> {
  const raw = await scrapeAllSources();
  const articles = await analyzeSentiment(raw);

  const moodBreakdown = { bullish: 0, bearish: 0, neutral: 0 };
  for (const a of articles) moodBreakdown[a.sentiment]++;

  let marketMood: "bullish" | "bearish" | "neutral" = "neutral";
  if (moodBreakdown.bullish > moodBreakdown.bearish + 2) marketMood = "bullish";
  else if (moodBreakdown.bearish > moodBreakdown.bullish + 2) marketMood = "bearish";

  return {
    articles,
    marketMood,
    moodBreakdown,
    topPrices: [], // filled by hub coordinator
    generatedAt: new Date().toISOString(),
  };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
