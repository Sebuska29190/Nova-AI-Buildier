/**
 * PortfolioChart — Portfolio value visualization
 * Chain breakdown bar chart + token holdings table
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { GlassCard } from "../ui/GlassCard";
import { GlassBadge } from "../ui/GlassBadge";
import { CHAIN_NAMES } from "../../config/reown";

interface PortfolioData {
  totalValue: number;
  change24h: number;
  chains: Array<{
    chainId: number;
    chainName: string;
    value: number;
    percentage: number;
    color: string;
    icon: string;
  }>;
  tokens: Array<{
    symbol: string;
    name: string;
    chainId: number;
    chainName: string;
    balance: string;
    value: number;
    change24h: number;
    icon: string;
  }>;
}

interface PortfolioChartProps {
  data: PortfolioData;
  loading?: boolean;
}

const CHAIN_COLORS: Record<number, string> = {
  1: "#627EEA",
  8453: "#0052FF",
  42161: "#28A0F0",
  137: "#8247E5",
  56: "#F0B90B",
};

export function PortfolioChart({ data, loading }: PortfolioChartProps) {
  if (loading) {
    return (
      <GlassCard padding="lg">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-[rgba(255,255,255,0.04)] rounded w-1/3" />
          <div className="h-8 bg-[rgba(255,255,255,0.04)] rounded w-1/2" />
          <div className="h-32 bg-[rgba(255,255,255,0.04)] rounded" />
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <GlassCard padding="lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#475569] uppercase tracking-wider">Total Portfolio</span>
          <GlassBadge variant={data.change24h >= 0 ? "success" : "error"}>
            {data.change24h >= 0 ? "+" : ""}{data.change24h.toFixed(2)}%
          </GlassBadge>
        </div>
        <p className="text-3xl font-bold text-white font-mono">${data.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </GlassCard>

      {/* Chain Breakdown Chart */}
      {data.chains.length > 0 && (
        <GlassCard padding="md">
          <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">By Chain</h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chains} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="chainName" width={80} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", fontSize: 11 }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {data.chains.map((entry, i) => (
                    <Cell key={i} fill={entry.color || CHAIN_COLORS[entry.chainId] || "#666"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Token Holdings */}
      {data.tokens.length > 0 && (
        <GlassCard padding="md">
          <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">Holdings</h3>
          <div className="space-y-2">
            {data.tokens.sort((a, b) => b.value - a.value).map((token, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{token.icon}</span>
                  <div>
                    <p className="text-xs text-white font-medium">{token.symbol}</p>
                    <p className="text-[10px] text-[#475569]">{token.chainName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white font-mono">${token.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className={`text-[10px] font-mono ${token.change24h >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                    {token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(2)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
