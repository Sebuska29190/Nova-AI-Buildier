/**
 * Polymarket AI Analyzer — LLM-powered market analysis
 */

import { polymarketClient, type PolymarketMarket } from "./client";

export interface MarketAnalysis {
  marketId: string;
  question: string;
  aiProbability: number; // 0-100
  marketProbability: number; // 0-100
  confidence: "high" | "medium" | "low";
  reasoning: string;
  riskScore: number; // 0-100
  recommendation: "strong_buy_yes" | "buy_yes" | "hold" | "buy_no" | "strong_buy_no";
  factors: string[];
}

class PolymarketAnalyzer {
  /**
   * Analyze a prediction market using LLM
   */
  async analyzeMarket(conditionId: string): Promise<MarketAnalysis | null> {
    try {
      const market = await polymarketClient.getMarket(conditionId);
      return this.analyzeMarketData(market);
    } catch {
      return null;
    }
  }

  async analyzeMarketData(market: PolymarketMarket): Promise<MarketAnalysis> {
    const prices = JSON.parse(market.outcomePrices || "[]");
    const yesPrice = parseFloat(prices[0] || "0.5");
    const noPrice = parseFloat(prices[1] || "0.5");
    const marketProb = Math.round(yesPrice * 100);

    // Get order book for depth analysis
    let orderBookData = "";
    try {
      const outcomeTokens = JSON.parse(market.outcomes || "[]");
      if (outcomeTokens.length > 0) {
        const book = await polymarketClient.getOrderBook(market.conditionId);
        const bidDepth = book.bids?.reduce((s, b) => s + parseFloat(b.size || "0"), 0) || 0;
        const askDepth = book.asks?.reduce((s, a) => s + parseFloat(a.size || "0"), 0) || 0;
        orderBookData = `Order book: bid depth $${bidDepth.toFixed(0)}, ask depth $${askDepth.toFixed(0)}, ratio ${(bidDepth / (askDepth || 1)).toFixed(2)}`;
      }
    } catch {}

    // LLM analysis
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return this.fallbackAnalysis(market, marketProb);
    }

    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: `You are a prediction market analyst. Analyze the given Polymarket prediction and provide:
1. Your estimated probability (0-100) that the outcome will be YES
2. Confidence level (high/medium/low)
3. Brief reasoning (2-3 sentences)
4. Risk score (0-100, higher = riskier)
5. Recommendation: strong_buy_yes, buy_yes, hold, buy_no, strong_buy_no
6. Key factors to consider

Return ONLY valid JSON: {"probability": number, "confidence": "...", "reasoning": "...", "riskScore": number, "recommendation": "...", "factors": ["..."]}` },
            { role: "user", content: `Market: ${market.question}\nDescription: ${market.description || "N/A"}\nMarket probability (YES): ${marketProb}%\nVolume: $${market.volume || "0"}\nLiquidity: $${market.liquidity || "0"}\nEnd date: ${market.endDate || "N/A"}\n${orderBookData}` },
          ],
          max_tokens: 300,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) return this.fallbackAnalysis(market, marketProb);

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.fallbackAnalysis(market, marketProb);

      const llm = JSON.parse(jsonMatch[0]);

      // Calculate edge (AI probability vs market)
      const edge = llm.probability - marketProb;

      let recommendation: MarketAnalysis["recommendation"] = "hold";
      if (edge > 15) recommendation = "strong_buy_yes";
      else if (edge > 5) recommendation = "buy_yes";
      else if (edge < -15) recommendation = "strong_buy_no";
      else if (edge < -5) recommendation = "buy_no";

      return {
        marketId: market.conditionId,
        question: market.question,
        aiProbability: llm.probability || marketProb,
        marketProbability: marketProb,
        confidence: llm.confidence || "low",
        reasoning: llm.reasoning || "No analysis available",
        riskScore: llm.riskScore || 50,
        recommendation,
        factors: llm.factors || [],
      };
    } catch {
      return this.fallbackAnalysis(market, marketProb);
    }
  }

  private fallbackAnalysis(market: PolymarketMarket, marketProb: number): MarketAnalysis {
    return {
      marketId: market.conditionId,
      question: market.question,
      aiProbability: marketProb,
      marketProbability: marketProb,
      confidence: "low",
      reasoning: "LLM analysis unavailable. Showing market probability only.",
      riskScore: 50,
      recommendation: "hold",
      factors: ["Volume analysis", "Liquidity depth"],
    };
  }

  /**
   * Find mispriced markets (AI probability significantly different from market)
   */
  async findOpportunities(limit: number = 10): Promise<MarketAnalysis[]> {
    const markets = await polymarketClient.getTrendingMarkets(30);
    const analyses: MarketAnalysis[] = [];

    for (const market of markets.slice(0, 15)) {
      try {
        const analysis = await this.analyzeMarketData(market);
        // Only include if AI sees an edge > 5%
        if (Math.abs(analysis.aiProbability - analysis.marketProbability) > 5) {
          analyses.push(analysis);
        }
      } catch {}
    }

    // Sort by edge size
    return analyses
      .sort((a, b) => Math.abs(b.aiProbability - b.marketProbability) - Math.abs(a.aiProbability - a.marketProbability))
      .slice(0, limit);
  }
}

export const polymarketAnalyzer = new PolymarketAnalyzer();
