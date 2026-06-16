/**
 * Risk Management — Portfolio scoring, correlation, drawdown
 */
import { registerTool } from "../../plugin/tools";

export interface RiskFactor {
  name: string;
  score: number; // 0-100
  weight: number;
  description: string;
}

export interface RiskResult {
  score: number; // 0 (low risk) - 100 (high risk)
  factors: RiskFactor[];
  recommendations: string[];
}

class RiskScorer {
  /**
   * Calculate portfolio risk score based on multiple factors
   */
  async calculateRisk(positions: Array<{ symbol: string; value: number; volatility?: number }>): Promise<RiskResult> {
    const totalValue = positions.reduce((s, p) => s + p.value, 0);
    if (totalValue === 0) return { score: 0, factors: [], recommendations: ["No positions"] };

    const factors: RiskFactor[] = [];

    // 1. Concentration risk — single asset > 30%
    const maxConcentration = Math.max(...positions.map(p => p.value / totalValue));
    factors.push({
      name: "Concentration",
      score: maxConcentration > 0.5 ? 80 : maxConcentration > 0.3 ? 50 : maxConcentration > 0.2 ? 25 : 10,
      weight: 0.25,
      description: `Max position: ${(maxConcentration * 100).toFixed(1)}%`,
    });

    // 2. Diversification — number of assets
    const divScore = positions.length <= 1 ? 80 : positions.length <= 3 ? 50 : positions.length <= 5 ? 25 : 10;
    factors.push({
      name: "Diversification",
      score: divScore,
      weight: 0.2,
      description: `${positions.length} positions`,
    });

    // 3. Volatility risk — if available
    const avgVol = positions.reduce((s, p) => s + (p.volatility || 50), 0) / positions.length;
    factors.push({
      name: "Volatility",
      score: Math.min(100, avgVol),
      weight: 0.25,
      description: `Avg volatility: ${avgVol.toFixed(0)}%`,
    });

    // 4. Stablecoin ratio (lower = safer)
    const stableValue = positions.filter(p => ["USDC", "USDT", "DAI"].includes(p.symbol)).reduce((s, p) => s + p.value, 0);
    const stableRatio = stableValue / totalValue;
    factors.push({
      name: "Stablecoin Buffer",
      score: stableRatio > 0.3 ? 10 : stableRatio > 0.1 ? 30 : stableRatio > 0 ? 60 : 80,
      weight: 0.15,
      description: `${(stableRatio * 100).toFixed(1)}% in stablecoins`,
    });

    // 5. Position count risk
    factors.push({
      name: "Position Count",
      score: positions.length > 10 ? 60 : positions.length > 5 ? 30 : 15,
      weight: 0.15,
      description: `${positions.length} open positions`,
    });

    // Calculate weighted score
    const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
    const score = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight);

    // Generate recommendations
    const recommendations: string[] = [];
    if (maxConcentration > 0.4) recommendations.push("Reduce largest position (concentration risk)");
    if (positions.length < 3) recommendations.push("Diversify across more assets");
    if (stableRatio < 0.1) recommendations.push("Consider adding stablecoin buffer (10-20%)");
    if (avgVol > 70) recommendations.push("Consider lower-volatility assets");
    if (positions.length > 8) recommendations.push("Consolidate overlapping positions");

    return { score, factors, recommendations };
  }
}

export const riskScorer = new RiskScorer();

// ─── Risk Tools ──────────────────────────────────────────

registerTool({
  name: "risk_score",
  description: "Calculate portfolio risk score based on positions",
  parameters: {
    type: "object",
    properties: {
      positions: { type: "string", description: 'JSON array: [{"symbol":"SOL","value":1000,"volatility":45}]' },
    },
    required: ["positions"],
  },
  async execute(args: { positions: string }) {
    const positions = JSON.parse(args.positions);
    const result = await riskScorer.calculateRisk(positions);

    const lines = [
      `**Portfolio Risk Score: ${result.score}/100**`,
      result.score < 30 ? "🟢 Low risk" : result.score < 60 ? "🟡 Medium risk" : "🔴 High risk",
      "",
      "**Factors:**",
      ...result.factors.map(f => `  ${f.name}: ${f.score}/100 — ${f.description}`),
    ];

    if (result.recommendations.length > 0) {
      lines.push("", "**Recommendations:**");
      result.recommendations.forEach(r => lines.push(`  • ${r}`));
    }

    return lines.join("\n");
  },
});

registerTool({
  name: "risk_drawdown",
  description: "Analyze portfolio drawdown from peak value",
  parameters: {
    type: "object",
    properties: {
      history: { type: "string", description: 'JSON array of portfolio values: [{"date":"2024-01-01","value":10000}]' },
    },
    required: ["history"],
  },
  async execute(args: { history: string }) {
    const history = JSON.parse(args.history) as Array<{ date: string; value: number }>;
    if (history.length < 2) return "Need at least 2 data points";

    let peak = history[0].value;
    let maxDrawdown = 0;
    let peakDate = history[0].date;
    let troughDate = history[0].date;

    for (const point of history) {
      if (point.value > peak) {
        peak = point.value;
        peakDate = point.date;
      }
      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        troughDate = point.date;
      }
    }

    const currentValue = history[history.length - 1].value;
    const currentDrawdown = (peak - currentValue) / peak;

    return [
      `**Drawdown Analysis**`,
      `Current value: $${currentValue.toLocaleString()}`,
      `Peak value: $${peak.toLocaleString()} (${peakDate})`,
      `Current drawdown: ${(currentDrawdown * 100).toFixed(2)}%`,
      `Max drawdown: ${(maxDrawdown * 100).toFixed(2)}% (${troughDate})`,
    ].join("\n");
  },
});

console.log("[risk] Risk management initialized with 2 tools");
