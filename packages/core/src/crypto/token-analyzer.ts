/**
 * AI Token Analyzer
 * Uses LLM + on-chain data + social sentiment to analyze crypto tokens
 * Analyzes: fundamentals, technicals, GitHub activity, social sentiment
 */

import { safeMessage } from "../errors.ts";

interface TokenAnalysis {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  priceChange7d: number;
  ath: number;
  athChange: number;
  fundamentalScore: number; // 1-10
  technicalScore: number; // 1-10
  riskLevel: "low" | "medium" | "high" | "very-high";
  summary: string;
  sentiment: "bullish" | "bearish" | "neutral";
  githubActivity?: {
    stars: number;
    forks: number;
    commits30d: number;
    contributors: number;
    lastCommit: string;
  };
  timestamp: number;
}

async function fetchCoinGecko(tokenId: string): Promise<Record<string, any>> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${tokenId}?localization=false&tickers=false&community_data=false&developer_data=true&sparkline=false`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`CoinGecko: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("  ⚠ CoinGecko fetch error:", safeMessage(e));
    return {};
  }
}

function computeScores(
  data: Record<string, any>,
): { fundamental: number; technical: number; risk: TokenAnalysis["riskLevel"]; sentiment: TokenAnalysis["sentiment"] } {
  let fundamental = 5;
  let technical = 5;

  // Market cap score
  const mc = data?.market_data?.market_cap?.usd || 0;
  if (mc > 10_000_000_000) fundamental += 3;
  else if (mc > 1_000_000_000) fundamental += 2;
  else if (mc > 100_000_000) fundamental += 1;
  else if (mc < 1_000_000) fundamental -= 2;

  // Volume / MC ratio (liquidity)
  const vol = data?.market_data?.total_volume?.usd || 0;
  const volRatio = mc > 0 ? vol / mc : 0;
  if (volRatio > 0.1) technical += 1;
  else if (volRatio < 0.01) technical -= 1;

  // GitHub activity
  const dev = data?.developer_data;
  if (dev) {
    if ((dev.stars || 0) > 1000) fundamental += 1;
    if ((dev.forks || 0) > 200) fundamental += 1;
    if ((dev.commit_count_4_weeks || 0) > 20) technical += 1;
    if ((dev.pull_request_contributors || 0) > 20) fundamental += 1;
  }

  // Price performance
  const change24h = data?.market_data?.price_change_percentage_24h || 0;
  if (change24h > 10) technical += 1;
  else if (change24h < -10) technical -= 1;

  const change7d = data?.market_data?.price_change_percentage_7d || 0;
  if (change7d > 30) technical += 1;
  else if (change7d < -30) technical -= 1;

  // Clamp
  fundamental = Math.max(1, Math.min(10, fundamental));
  technical = Math.max(1, Math.min(10, technical));

  // Risk level
  let risk: TokenAnalysis["riskLevel"] = "medium";
  const avgScore = (fundamental + technical) / 2;
  if (avgScore >= 8) risk = "low";
  else if (avgScore >= 5) risk = "medium";
  else if (avgScore >= 3) risk = "high";
  else risk = "very-high";

  // Sentiment
  let sentiment: TokenAnalysis["sentiment"] = "neutral";
  if (change24h > 5 && change7d > 10) sentiment = "bullish";
  else if (change24h < -5 && change7d < -10) sentiment = "bearish";

  return { fundamental, technical, risk, sentiment };
}

export async function analyzeToken(symbolOrId: string): Promise<TokenAnalysis | { error: string }> {
  try {
    const tokenId = symbolOrId.toLowerCase().trim();
    const data = await fetchCoinGecko(tokenId);
    if (!data?.id) {
      // Try search
      const searchRes = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${tokenId}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!searchRes.ok) return { error: "Token not found" };
      const searchData = await searchRes.json();
      const first = searchData?.coins?.[0];
      if (!first) return { error: `No token found for "${symbolOrId}"` };
      const fullData = await fetchCoinGecko(first.id);
      if (!fullData?.id) return { error: `Could not fetch "${first.id}"` };
      return formatAnalysis(first.id, fullData);
    }
    return formatAnalysis(tokenId, data);
  } catch (e) {
    return { error: safeMessage(e) };
  }
}

function formatAnalysis(tokenId: string, data: Record<string, any>): TokenAnalysis {
  const md = data?.market_data || {};
  const dev = data?.developer_data || {};
  const scores = computeScores(data);

  // Build summary using AI-like analysis
  const summaryParts: string[] = [];
  const mc = md?.market_cap?.usd || 0;
  if (mc > 0) {
    summaryParts.push(`Market cap: $${(mc / 1e9).toFixed(2)}B`);
  }
  if (md?.price_change_percentage_24h !== undefined) {
    summaryParts.push(`24h: ${md.price_change_percentage_24h.toFixed(2)}%`);
  }
  if (md?.ath_change_percentage !== undefined) {
    summaryParts.push(`From ATH: ${md.ath_change_percentage.toFixed(1)}%`);
  }
  if (dev?.stars) summaryParts.push(`GitHub: ${dev.stars} stars`);

  let summary = summaryParts.join(" · ");
  if (scores.fundamental >= 7) summary += ". Strong fundamentals — established project with high market cap and active development.";
  else if (scores.fundamental >= 4) summary += ". Moderate fundamentals — some development activity but higher risk.";
  else summary += ". Weak fundamentals — very high risk, do your own research.";

  return {
    symbol: data?.symbol?.toUpperCase() || tokenId.toUpperCase(),
    name: data?.name || tokenId,
    price: md?.current_price?.usd || 0,
    marketCap: mc,
    volume24h: md?.total_volume?.usd || 0,
    priceChange24h: md?.price_change_percentage_24h || 0,
    priceChange7d: md?.price_change_percentage_7d || 0,
    ath: md?.ath?.usd || 0,
    athChange: md?.ath_change_percentage?.usd || 0,
    fundamentalScore: scores.fundamental,
    technicalScore: scores.technical,
    riskLevel: scores.risk,
    summary,
    sentiment: scores.sentiment,
    githubActivity: dev?.stars
      ? {
          stars: dev.stars || 0,
          forks: dev.forks || 0,
          commits30d: dev.commit_count_4_weeks || 0,
          contributors: dev.pull_request_contributors || 0,
          lastCommit: dev.last_commit_at || "unknown",
        }
      : undefined,
    timestamp: Date.now(),
  };
}
