// AI Trading Signal Generator — uses available LLM providers to analyze markets
import type { TradingSignal, PriceSnapshot, TechnicalIndicators } from "./types.ts";

// ─── Technical Indicators (calculated locally) ────────────────────────────────

export function calculateIndicators(prices: number[], volumes?: number[]): TechnicalIndicators {
  const last = prices[prices.length - 1] || 0;
  const n = prices.length;

  // RSI (14)
  let gains = 0, losses = 0;
  const rsiPeriod = Math.min(14, n - 1);
  for (let i = n - rsiPeriod; i < n; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / rsiPeriod;
  const avgLoss = losses / rsiPeriod;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  // EMA
  function ema(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  const ema20 = ema(prices, 20);
  const ema50 = ema(prices, Math.min(50, n));
  const ema200 = ema(prices, Math.min(200, n));

  // Bollinger Bands (20)
  const bbPeriod = Math.min(20, n);
  const bbSlice = prices.slice(-bbPeriod);
  const bbMean = bbSlice.reduce((a, b) => a + b, 0) / bbSlice.length;
  const bbStd = Math.sqrt(bbSlice.reduce((a, b) => a + (b - bbMean) ** 2, 0) / bbSlice.length);
  const bbUpper = bbMean + 2 * bbStd;
  const bbLower = bbMean - 2 * bbStd;

  // MACD (12, 26, 9)
  const ema12 = ema(prices, Math.min(12, n));
  const ema26 = ema(prices, Math.min(26, n));
  const macdLine = ema12 - ema26;
  const macdSignal = ema([macdLine], Math.min(9, Math.max(1, n - 26)));

  // Volatility (24h: std of returns)
  const returns = prices.slice(-24).map((p, i, arr) => i > 0 ? (p - arr[i - 1]) / arr[i - 1] : 0).slice(1);
  const vol24h = Math.sqrt(returns.reduce((a, b) => a + b ** 2, 0) / returns.length) * Math.sqrt(365);

  // Volume
  const volSum = volumes?.slice(-24).reduce((a, b) => a + b, 0) ?? 0;

  return {
    rsi: Math.round(rsi * 100) / 100,
    macd: Math.round(macdLine * 10000) / 10000,
    macdSignal: Math.round(macdSignal * 10000) / 10000,
    ema20: Math.round(ema20 * 100) / 100,
    ema50: Math.round(ema50 * 100) / 100,
    ema200: Math.round(ema200 * 100) / 100,
    bollingerUpper: Math.round(bbUpper * 100) / 100,
    bollingerLower: Math.round(bbLower * 100) / 100,
    volume24h: Math.round(volSum),
    volatility24h: Math.round(vol24h * 10000) / 100,
  };
}

// ─── Signal logic (rule-based, no LLM call needed for basics) ──────────────────

function generateSignalFromIndicators(
  symbol: string,
  price: number,
  ind: TechnicalIndicators,
  sentiment: "bullish" | "bearish" | "neutral" = "neutral",
): TradingSignal {
  let score = 50; // start neutral

  // RSI
  if (ind.rsi < 30) score += 20;       // oversold → bullish
  else if (ind.rsi < 40) score += 10;
  else if (ind.rsi > 70) score -= 20;  // overbought → bearish
  else if (ind.rsi > 60) score -= 10;

  // MACD
  if (ind.macd > ind.macdSignal) score += 10;
  else score -= 10;

  // EMA alignment
  if (ind.ema20 > ind.ema50) score += 5;
  else score -= 5;
  if (ind.ema50 > ind.ema200) score += 5;
  else score -= 5;

  // Bollinger Bands
  const bbRange = ind.bollingerUpper - ind.bollingerLower;
  if (bbRange > 0) {
    const bbPos = (price - ind.bollingerLower) / bbRange;
    if (bbPos < 0.2) score += 10;      // near lower band
    else if (bbPos > 0.8) score -= 10; // near upper band
  }

  // Sentiment boost
  if (sentiment === "bullish") score += 10;
  else if (sentiment === "bearish") score -= 10;

  score = Math.max(0, Math.min(100, score));

  let signal: TradingSignal["signal"];
  if (score >= 80) signal = "STRONG_BUY";
  else if (score >= 60) signal = "BUY";
  else if (score >= 40) signal = "HOLD";
  else if (score >= 20) signal = "SELL";
  else signal = "STRONG_SELL";

  const reasons: string[] = [];
  if (ind.rsi < 35) reasons.push(`RSI(${ind.rsi.toFixed(1)}) oversold`);
  if (ind.rsi > 65) reasons.push(`RSI(${ind.rsi.toFixed(1)}) overbought`);
  if (ind.macd > ind.macdSignal) reasons.push("MACD bullish crossover");
  else if (ind.macd < ind.macdSignal) reasons.push("MACD bearish");
  if (price < ind.ema20) reasons.push("below EMA20");
  if (price > ind.ema20) reasons.push("above EMA20");

  return {
    symbol,
    price,
    signal,
    confidence: score,
    reasoning: reasons.join("; ") || "Mixed signals",
    indicators: ind,
    sentiment,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Main analyzer — combines on-chain data + price + LLM for best signals ────

export async function analyzeSymbol(
  symbol: string,
  priceSnapshot: PriceSnapshot,
  indicators: TechnicalIndicators,
  newsImpact?: "bullish" | "bearish" | "neutral",
  whaleActivity?: "accumulating" | "distributing" | "neutral",
): Promise<TradingSignal> {
  // Blend sentiment signals
  let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
  const signals: number[] = [];

  if (newsImpact === "bullish") signals.push(1);
  else if (newsImpact === "bearish") signals.push(-1);
  if (whaleActivity === "accumulating") signals.push(1);
  else if (whaleActivity === "distributing") signals.push(-1);
  if (priceSnapshot.changePercent24h > 5) signals.push(1);
  else if (priceSnapshot.changePercent24h < -5) signals.push(-1);

  const net = signals.reduce((a, b) => a + b, 0);
  if (net > 0) sentiment = "bullish";
  else if (net < 0) sentiment = "bearish";

  // Try LLM-enhanced analysis if API key available
  try {
    const llmSignal = await llmAnalyze(symbol, priceSnapshot, indicators, newsImpact, whaleActivity);
    if (llmSignal) return llmSignal;
  } catch {}

  return generateSignalFromIndicators(symbol, priceSnapshot.price, indicators, sentiment);
}

async function llmAnalyze(
  symbol: string,
  snap: PriceSnapshot,
  ind: TechnicalIndicators,
  newsImpact?: string,
  whaleActivity?: string,
): Promise<TradingSignal | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const provider = process.env.OPENAI_API_KEY ? "openai" : "anthropic";
  const endpoint = provider === "openai"
    ? "https://api.openai.com/v1/chat/completions"
    : "https://api.anthropic.com/v1/messages";
  const model = provider === "openai" ? "gpt-4o-mini" : "claude-3-5-haiku-latest";

  const prompt = `Analyze ${symbol} crypto trading signal:

Price: $${snap.price}
24h Change: ${snap.changePercent24h.toFixed(2)}%
Market Cap: $${(snap.marketCap / 1e9).toFixed(2)}B
Volume 24h: $${(snap.volume24h / 1e9).toFixed(2)}B

Technical Indicators:
- RSI(14): ${ind.rsi.toFixed(1)}
- MACD: ${ind.macd} (signal: ${ind.macdSignal})
- EMA20: ${ind.ema20}, EMA50: ${ind.ema50}, EMA200: ${ind.ema200}
- Bollinger: ${ind.bollingerLower} - ${ind.bollingerUpper}
- Volatility 24h: ${(ind.volatility24h * 100).toFixed(2)}%

News Sentiment: ${newsImpact || "N/A"}
Whale Activity: ${whaleActivity || "N/A"}

Return ONLY a JSON object: {"signal":"BUY"|"SELL"|"HOLD","confidence":0-100,"reasoning":"short explanation"}`;

  try {
    const body = provider === "openai"
      ? { model, messages: [{ role: "user", content: prompt }], temperature: 0.3, max_tokens: 200 }
      : { model, messages: [{ role: "user", content: prompt }], max_tokens: 200, temperature: 0.3 };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      [provider === "openai" ? "Authorization" : "x-api-key"]: `Bearer ${apiKey}`,
    };
    if (provider === "anthropic") headers["anthropic-version"] = "2023-06-01";

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data: any = await res.json();
    const content = provider === "openai"
      ? data.choices?.[0]?.message?.content
      : data.content?.[0]?.text;
    if (!content) return null;

    const json = JSON.parse(content.replace(/```json|```/g, "").trim());
    const signalMap: Record<string, TradingSignal["signal"]> = {
      BUY: "BUY", SELL: "SELL", HOLD: "HOLD",
      STRONG_BUY: "STRONG_BUY", STRONG_SELL: "STRONG_SELL",
    };
    return {
      symbol,
      price: snap.price,
      signal: signalMap[json.signal] || "HOLD",
      confidence: json.confidence ?? 50,
      reasoning: json.reasoning || "LLM analysis",
      indicators: ind,
      sentiment: json.signal?.includes("BUY") ? "bullish" : json.signal?.includes("SELL") ? "bearish" : "neutral",
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function screenMarket(
  coins: PriceSnapshot[],
): Promise<{ topGainers: PriceSnapshot[]; topLosers: PriceSnapshot[]; aiPicks: TradingSignal[] }> {
  const sorted = [...coins].sort((a, b) => b.changePercent24h - a.changePercent24h);

  // AI picks: analyze top 20 by market cap for best signals
  const top20 = coins.slice(0, 20);
  const aiPicks: TradingSignal[] = [];
  for (const coin of top20.slice(0, 10)) {
    const ind = calculateIndicators(coin.sparkline7d || [coin.price]);
    const signal = generateSignalFromIndicators(coin.symbol, coin.price, ind);
    aiPicks.push(signal);
  }
  aiPicks.sort((a, b) => b.confidence - a.confidence);

  return {
    topGainers: sorted.slice(0, 10),
    topLosers: sorted.slice(-10).reverse(),
    aiPicks: aiPicks.slice(0, 5),
  };
}
