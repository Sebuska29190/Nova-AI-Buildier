/**
 * Polymarket Prediction Tools
 */
import { registerTool } from "../../plugin/tools";
import { polymarketClient } from "./client";
import { polymarketAnalyzer } from "./analyzer";

registerTool({
  name: "polymarket_markets",
  description: "List or search Polymarket prediction markets",
  parameters: {
    type: "object",
    properties: {
      search: { type: "string", description: "Search query (e.g. 'Trump', 'Bitcoin', 'election')" },
      trending: { type: "boolean", description: "Get trending markets by volume" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
  },
  async execute(args: { search?: string; trending?: boolean; limit?: number }) {
    const limit = args.limit || 10;

    let markets;
    if (args.search) {
      markets = await polymarketClient.searchMarkets(args.search, limit);
    } else if (args.trending) {
      markets = await polymarketClient.getTrendingMarkets(limit);
    } else {
      markets = await polymarketClient.getMarkets({ limit, active: true, closed: false });
    }

    if (!markets.length) return "No markets found";

    return markets.map(m => {
      const prices = JSON.parse(m.outcomePrices || "[]");
      const yesPrice = parseFloat(prices[0] || "0") * 100;
      return `**${m.question.slice(0, 80)}**\n  YES: ${yesPrice.toFixed(1)}% | Volume: $${parseInt(m.volume || "0").toLocaleString()} | Liquidity: $${parseInt(m.liquidity || "0").toLocaleString()}`;
    }).join("\n\n");
  },
});

registerTool({
  name: "polymarket_analysis",
  description: "AI-powered analysis of a Polymarket prediction market",
  parameters: {
    type: "object",
    properties: {
      marketId: { type: "string", description: "Market condition ID" },
      question: { type: "string", description: "Market question (if ID not known)" },
    },
  },
  async execute(args: { marketId?: string; question?: string }) {
    let market;
    if (args.marketId) {
      market = await polymarketClient.getMarket(args.marketId);
    } else if (args.question) {
      const results = await polymarketClient.searchMarkets(args.question, 1);
      if (!results.length) return "No matching market found";
      market = results[0];
    } else {
      return "Provide either marketId or question";
    }

    const analysis = await polymarketAnalyzer.analyzeMarketData(market);

    const lines = [
      `**${analysis.question}**\n`,
      `Market probability: ${analysis.marketProbability}%`,
      `AI probability: ${analysis.aiProbability}%`,
      `Edge: ${analysis.aiProbability - analysis.marketProbability > 0 ? "+" : ""}${analysis.aiProbability - analysis.marketProbability}%`,
      `Confidence: ${analysis.confidence}`,
      `Risk score: ${analysis.riskScore}/100`,
      `Recommendation: **${analysis.recommendation.replace(/_/g, " ").toUpperCase()}**`,
      `\nReasoning: ${analysis.reasoning}`,
    ];

    if (analysis.factors.length > 0) {
      lines.push(`\nKey factors: ${analysis.factors.join(", ")}`);
    }

    return lines.join("\n");
  },
});

registerTool({
  name: "polymarket_opportunities",
  description: "Find mispriced Polymarket markets where AI disagrees with market probability",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max results (default 5)" },
    },
  },
  async execute(args: { limit?: number }) {
    const opportunities = await polymarketAnalyzer.findOpportunities(args.limit || 5);
    if (!opportunities.length) return "No significant opportunities found (all markets fairly priced)";

    return opportunities.map(o => {
      const edge = o.aiProbability - o.marketProbability;
      return `**${o.question.slice(0, 80)}**\n  Market: ${o.marketProbability}% | AI: ${o.aiProbability}% | Edge: ${edge > 0 ? "+" : ""}${edge}%\n  ${o.recommendation.replace(/_/g, " ").toUpperCase()} (${o.confidence} confidence)`;
    }).join("\n\n");
  },
});

console.log("[polymarket] Registered 3 prediction tools");
