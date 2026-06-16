import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Search, ArrowUpDown, Wallet, BarChart3, Shield, Zap, AlertTriangle, RefreshCw, ExternalLink, ChevronRight, X } from "lucide-react";
import { GlassCard } from "../lib/components/ui/GlassCard";
import { GlassButton } from "../lib/components/ui/GlassButton";
import { GlassInput } from "../lib/components/ui/GlassInput";
import { GlassBadge } from "../lib/components/ui/GlassBadge";
import { GlassTabs } from "../lib/components/ui/GlassTabs";
import { MetricCard } from "../lib/components/ui/MetricCard";

// ─── Types ─────────────────────────────────────────────
interface DashboardData {
  btcPrice: number; ethPrice: number; solPrice: number;
  btcChange: number; ethChange: number; solChange: number;
  marketCap: number; btcDominance: number;
  gainers: CoinData[]; losers: CoinData[]; signals: SignalData[];
}

interface CoinData { symbol: string; name: string; price: number; change24h: number; marketCap: number; volume: number; image?: string; }
interface SignalData { symbol: string; price: number; change24h: number; rsi: number; signal: string; score: number; }
interface Strategy { id: string; name: string; type: string; status: string; config: any; stats: any; createdAt: string; lastRun?: string; }
interface PolymarketMarket { id: string; conditionId: string; question: string; description: string; active: boolean; closed: boolean; volume: string; liquidity: string; outcomePrices: string; outcomes: string[]; endDate: string; image?: string; }

// ─── TradingView Widget ────────────────────────────────
function TradingViewWidget({ symbol = "BINANCE:BTCUSDT", height = 400 }: { symbol?: string; height?: number }) {
  const url = `https://www.tradingview.com/widgetembed/?symbol=${symbol}&interval=D&theme=Dark&style=1&hidesidetoolbar=1&symboledit=0&saveimage=0&studies=["MASimple@tv-basicstudies","RSI@tv-basicstudies"]&timezone=exchange&locale=en`;
  return (
    <div className="glass-card overflow-hidden">
      <iframe src={url} width="100%" height={height} frameBorder="0" allowFullScreen className="w-full" />
    </div>
  );
}

// ─── Risk Gauge ────────────────────────────────────────
function RiskGauge({ score }: { score: number }) {
  const color = score < 30 ? "#22c55e" : score < 60 ? "#f59e0b" : "#ef4444";
  const label = score < 30 ? "Low Risk" : score < 60 ? "Medium Risk" : "High Risk";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-14 overflow-hidden">
        <div className="absolute inset-0 rounded-t-full border-4 border-[rgba(255,255,255,0.06)]" style={{ borderTopColor: color, borderLeftColor: color, borderRightColor: color }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <p className="text-2xl font-bold font-mono" style={{ color }}>{score}</p>
        </div>
      </div>
      <p className="text-xs font-medium" style={{ color }}>{label}</p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────
export function CryptoHubPage() {
  const [tab, setTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [polyMarkets, setPolyMarkets] = useState<PolymarketMarket[]>([]);
  const [polySearch, setPolySearch] = useState("");
  const [dexFrom, setDexFrom] = useState("SOL");
  const [dexTo, setDexTo] = useState("USDC");
  const [dexAmount, setDexAmount] = useState("1");
  const [dexQuote, setDexQuote] = useState<any>(null);
  const [riskScore, setRiskScore] = useState(45);
  const [analysisSymbol, setAnalysisSymbol] = useState("");
  const [coinAnalysis, setCoinAnalysis] = useState<any>(null);

  useEffect(() => { loadDashboard(); loadStrategies(); loadPolymarket(); }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await fetch("/api/crypto-hub/dashboard");
      if (res.ok) {
        const data = await res.json();
        setDashboard({
          btcPrice: data?.btcPrice ?? 0,
          ethPrice: data?.ethPrice ?? 0,
          solPrice: data?.solPrice ?? 0,
          btcChange: data?.btcChange ?? 0,
          ethChange: data?.ethChange ?? 0,
          solChange: data?.solChange ?? 0,
          marketCap: data?.marketCap ?? 0,
          btcDominance: data?.btcDominance ?? 0,
          gainers: data?.gainers ?? [],
          losers: data?.losers ?? [],
          signals: data?.signals ?? [],
        });
      }
    } catch {} finally { setLoading(false); }
  }

  async function loadStrategies() {
    try {
      const res = await fetch("/api/strategies");
      if (res.ok) setStrategies(await res.json());
    } catch {}
  }

  async function loadPolymarket() {
    try {
      const res = await fetch("/api/polymarket/trending?limit=15");
      if (res.ok) setPolyMarkets(await res.json());
    } catch {}
  }

  async function searchPolymarket() {
    if (!polySearch.trim()) return loadPolymarket();
    try {
      const res = await fetch(`/api/polymarket/search?q=${encodeURIComponent(polySearch)}`);
      if (res.ok) setPolyMarkets(await res.json());
    } catch {}
  }

  async function getDexQuote() {
    try {
      const res = await fetch("/api/dex/quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: dexFrom, to: dexTo, amount: dexAmount }),
      });
      if (res.ok) setDexQuote(await res.json());
    } catch {}
  }

  async function analyzeSymbol() {
    if (!analysisSymbol.trim()) return;
    try {
      const res = await fetch(`/api/crypto-hub/coin/${analysisSymbol}`);
      if (res.ok) setCoinAnalysis(await res.json());
    } catch {}
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart3 size={12} /> },
    { id: "markets", label: "Markets", icon: <TrendingUp size={12} /> },
    { id: "dex", label: "DEX", icon: <ArrowUpDown size={12} /> },
    { id: "polymarket", label: "Polymarket", icon: <Zap size={12} /> },
    { id: "strategies", label: "Strategies", icon: <RefreshCw size={12} /> },
    { id: "risk", label: "Risk", icon: <Shield size={12} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#ef4444] flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Crypto Hub</h1>
            <p className="text-xs text-[#475569]">Markets, DEX, Predictions, Strategies</p>
          </div>
        </div>
        <GlassButton variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => { loadDashboard(); loadStrategies(); loadPolymarket(); }}>
          Refresh
        </GlassButton>
      </div>

      <GlassTabs tabs={tabs} activeTab={tab} onChange={setTab} />

      {/* ═══ DASHBOARD TAB ═══ */}
      {tab === "dashboard" && (
        <div className="space-y-4 animate-fade-in-up">
          {loading ? (
            <GlassCard padding="lg" className="text-center">
              <p className="text-xs text-[#475569]">Loading market data...</p>
            </GlassCard>
          ) : !dashboard ? (
            <GlassCard padding="lg" className="text-center">
              <p className="text-xs text-[#475569]">Failed to load dashboard data</p>
              <GlassButton variant="ghost" size="sm" onClick={loadDashboard} className="mt-2">Retry</GlassButton>
            </GlassCard>
          ) : (
        <div className="space-y-4 animate-fade-in-up">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Bitcoin" value={`${(dashboard.btcPrice || 0).toLocaleString()}`} change={`${(dashboard.btcChange || 0) > 0 ? "+" : ""}${(dashboard.btcChange || 0).toFixed(2)}%`} changeType={(dashboard.btcChange || 0) > 0 ? "up" : "down"} />
            <MetricCard label="Ethereum" value={`${(dashboard.ethPrice || 0).toLocaleString()}`} change={`${(dashboard.ethChange || 0) > 0 ? "+" : ""}${(dashboard.ethChange || 0).toFixed(2)}%`} changeType={(dashboard.ethChange || 0) > 0 ? "up" : "down"} />
            <MetricCard label="Solana" value={`${(dashboard.solPrice || 0).toFixed(2)}`} change={`${(dashboard.solChange || 0) > 0 ? "+" : ""}${(dashboard.solChange || 0).toFixed(2)}%`} changeType={(dashboard.solChange || 0) > 0 ? "up" : "down"} />
            <MetricCard label="BTC Dominance" value={`${typeof dashboard.btcDominance === 'string' ? dashboard.btcDominance : (dashboard.btcDominance || 0).toFixed(1)}%`} />
          </div>

          {/* TradingView Mini */}
          <TradingViewWidget symbol="BINANCE:BTCUSDT" height={350} />

          {/* Signals Table */}
          {dashboard.signals?.length > 0 && (
            <GlassCard padding="md">
              <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">Trading Signals</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.06)]">
                      <th className="text-left py-2 text-[#475569]">Symbol</th>
                      <th className="text-right py-2 text-[#475569]">Price</th>
                      <th className="text-right py-2 text-[#475569]">24h</th>
                      <th className="text-right py-2 text-[#475569]">RSI</th>
                      <th className="text-right py-2 text-[#475569]">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.signals.map(s => (
                      <tr key={s.symbol} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]">
                        <td className="py-2 text-white font-medium">{s.symbol}</td>
                        <td className="py-2 text-right text-[#94a3b8]">${(s.price || 0) < 1 ? (s.price || 0).toFixed(6) : (s.price || 0).toLocaleString()}</td>
                        <td className={`py-2 text-right ${(s.change24h || 0) > 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{(s.change24h || 0) > 0 ? "+" : ""}{(s.change24h || 0).toFixed(2)}%</td>
                        <td className="py-2 text-right text-[#94a3b8]">{(s.rsi || 0).toFixed(0) || "-"}</td>
                        <td className="py-2 text-right">
                          <GlassBadge variant={s.signal === "STRONG_BUY" ? "success" : s.signal === "BUY" ? "success" : s.signal === "SELL" ? "error" : "default"}>
                            {s.signal?.replace("_", " ") || "HOLD"}
                          </GlassBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* Active Strategies Summary */}
          {strategies.filter(s => s.status === "active").length > 0 && (
            <GlassCard padding="md">
              <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">Active Strategies</h3>
              <div className="flex flex-wrap gap-2">
                {strategies.filter(s => s.status === "active").map(s => (
                  <GlassBadge key={s.id} variant="accent">{s.name} ({s.type})</GlassBadge>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
        )}
      </div>
    )}

      {/* ═══ MARKETS TAB ═══ */}
      {tab === "markets" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex gap-2">
            <GlassInput value={analysisSymbol} onChange={e => setAnalysisSymbol(e.target.value)} placeholder="Search coin (e.g. SOL, BTC, JUP)..." icon={<Search size={14} />} onKeyDown={e => e.key === "Enter" && analyzeSymbol()} />
            <GlassButton variant="primary" onClick={analyzeSymbol}>Analyze</GlassButton>
          </div>

          {coinAnalysis && (
            <GlassCard padding="lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[rgba(99,102,241,0.1)] flex items-center justify-center text-lg">📊</div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{coinAnalysis.symbol || analysisSymbol}</h3>
                    <p className="text-xs text-[#475569]">${coinAnalysis.price?.toLocaleString()}</p>
                  </div>
                </div>
                <GlassBadge variant={coinAnalysis.signal?.includes("BUY") ? "success" : coinAnalysis.signal?.includes("SELL") ? "error" : "default"}>
                  {coinAnalysis.signal || "HOLD"}
                </GlassBadge>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><span className="text-[#475569]">RSI:</span> <span className="text-white">{(coinAnalysis.rsi || 0).toFixed(1)}</span></div>
                <div><span className="text-[#475569]">SMA7:</span> <span className="text-white">${(coinAnalysis.sma7 || 0).toFixed(2)}</span></div>
                <div><span className="text-[#475569]">MACD:</span> <span className="text-white">{(coinAnalysis.macd || 0).toFixed(4)}</span></div>
              </div>
            </GlassCard>
          )}

          <TradingViewWidget symbol={analysisSymbol ? `BINANCE:${analysisSymbol.toUpperCase()}USDT` : "BINANCE:BTCUSDT"} height={450} />

          {/* Top Gainers/Losers */}
          {dashboard && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassCard padding="md">
                <h3 className="text-xs font-bold text-[#22c55e] uppercase tracking-wider mb-3 flex items-center gap-1"><TrendingUp size={12} /> Top Gainers</h3>
                {dashboard.gainers?.slice(0, 5).map(c => (
                  <div key={c.symbol} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-white">{c.symbol}</span>
                    <span className="text-[#22c55e]">+{(c.change24h || 0).toFixed(2)}%</span>
                  </div>
                ))}
              </GlassCard>
              <GlassCard padding="md">
                <h3 className="text-xs font-bold text-[#ef4444] uppercase tracking-wider mb-3 flex items-center gap-1"><TrendingDown size={12} /> Top Losers</h3>
                {dashboard.losers?.slice(0, 5).map(c => (
                  <div key={c.symbol} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-white">{c.symbol}</span>
                    <span className="text-[#ef4444]">{(c.change24h || 0).toFixed(2)}%</span>
                  </div>
                ))}
              </GlassCard>
            </div>
          )}
        </div>
      )}

      {/* ═══ DEX TAB ═══ */}
      {tab === "dex" && (
        <div className="space-y-4 animate-fade-in-up max-w-lg mx-auto">
          <GlassCard padding="lg">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><ArrowUpDown size={16} className="text-[#6366f1]" /> Token Swap</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">From</label>
                <div className="flex gap-2">
                  <input value={dexFrom} onChange={e => setDexFrom(e.target.value.toUpperCase())}
                    className="glass-input w-24 px-3 py-2 text-sm font-mono text-center" placeholder="SOL" />
                  <input value={dexAmount} onChange={e => setDexAmount(e.target.value)}
                    className="glass-input flex-1 px-3 py-2 text-sm text-right" placeholder="1.0" type="number" step="0.01" />
                </div>
              </div>

              <div className="flex justify-center">
                <button onClick={() => { const t = dexFrom; setDexFrom(dexTo); setDexTo(t); }}
                  className="w-8 h-8 rounded-full bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.2)] flex items-center justify-center text-[#818cf8] hover:bg-[rgba(99,102,241,0.2)] transition-all">
                  <ArrowUpDown size={14} />
                </button>
              </div>

              <div>
                <label className="text-[10px] text-[#475569] uppercase tracking-wider mb-1 block">To</label>
                <input value={dexTo} onChange={e => setDexTo(e.target.value.toUpperCase())}
                  className="glass-input w-full px-3 py-2 text-sm font-mono" placeholder="USDC" />
              </div>

              <GlassButton variant="primary" className="w-full" onClick={getDexQuote}>Get Quote</GlassButton>
            </div>

            {dexQuote && (
              <div className="mt-4 p-3 rounded-xl bg-[rgba(99,102,241,0.05)] border border-[rgba(99,102,241,0.1)]">
                <p className="text-sm text-white font-medium">
                  {dexAmount} {dexFrom} → {(parseFloat(dexQuote.outAmount || "0") / 1e6).toFixed(4)} {dexTo}
                </p>
                <p className="text-[10px] text-[#475569] mt-1">
                  Impact: {parseFloat(dexQuote.priceImpactPct || "0").toFixed(4)}% | Routes: {Array.isArray(dexQuote.routePlan) ? dexQuote.routePlan.length : 0}
                </p>
                <GlassButton variant="primary" className="w-full mt-2" size="sm">Execute Swap</GlassButton>
              </div>
            )}
          </GlassCard>

          <GlassCard padding="md">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">Wallet</h3>
            <p className="text-xs text-[#94a3b8]">Connect your Solana wallet to trade</p>
          </GlassCard>
        </div>
      )}

      {/* ═══ POLYMARKET TAB ═══ */}
      {tab === "polymarket" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex gap-2">
            <GlassInput value={polySearch} onChange={e => setPolySearch(e.target.value)} placeholder="Search predictions (e.g. Trump, Bitcoin, election)..." icon={<Search size={14} />} onKeyDown={e => e.key === "Enter" && searchPolymarket()} />
            <GlassButton variant="primary" onClick={searchPolymarket}>Search</GlassButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {polyMarkets.map(m => {
              const prices = JSON.parse(m.outcomePrices || "[]");
              const yesPrice = (parseFloat(prices[0] || "0") * 100 || 0).toFixed(1);
              return (
                <GlassCard key={m.id || m.conditionId} padding="md" className="cursor-pointer hover:border-[rgba(245,158,11,0.2)] transition-all">
                  <p className="text-xs text-white font-medium line-clamp-2 mb-2">{m.question}</p>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-lg font-bold text-white">{yesPrice}%</span>
                      <span className="text-[10px] text-[#475569] ml-1">YES</span>
                    </div>
                    <GlassBadge variant={(parseFloat(yesPrice) || 0) > 70 ? "success" : (parseFloat(yesPrice) || 0) < 30 ? "error" : "default"}>
                      {(parseFloat(yesPrice) || 0) > 70 ? "Likely" : (parseFloat(yesPrice) || 0) < 30 ? "Unlikely" : "Toss-up"}
                    </GlassBadge>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#475569]">
                    <span>Vol: ${parseInt(m.volume || "0").toLocaleString()}</span>
                    <span>Liq: ${parseInt(m.liquidity || "0").toLocaleString()}</span>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          {polyMarkets.length === 0 && (
            <GlassCard padding="lg" className="text-center">
              <Zap size={24} className="mx-auto mb-2 text-[#475569]" />
              <p className="text-xs text-[#475569]">Search for prediction markets or view trending</p>
            </GlassCard>
          )}
        </div>
      )}

      {/* ═══ STRATEGIES TAB ═══ */}
      {tab === "strategies" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {strategies.map(s => (
              <GlassCard key={s.id} padding="md">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-white font-medium">{s.name}</p>
                  <GlassBadge variant={s.status === "active" ? "success" : s.status === "paused" ? "default" : "warning"}>
                    {s.status}
                  </GlassBadge>
                </div>
                <p className="text-[10px] text-[#475569] mb-2">{s.type} — {JSON.stringify(s.config).slice(0, 60)}...</p>
                <div className="flex gap-2">
                  {s.status === "paused" ? (
                    <GlassButton variant="ghost" size="sm" onClick={async () => { await fetch(`/api/strategies/${s.id}/start`, { method: "POST" }); loadStrategies(); }}>Start</GlassButton>
                  ) : (
                    <GlassButton variant="ghost" size="sm" onClick={async () => { await fetch(`/api/strategies/${s.id}/pause`, { method: "POST" }); loadStrategies(); }}>Pause</GlassButton>
                  )}
                  <GlassButton variant="ghost" size="sm" onClick={async () => { await fetch(`/api/strategies/${s.id}`, { method: "DELETE" }); loadStrategies(); }}>Delete</GlassButton>
                </div>
              </GlassCard>
            ))}
          </div>

          {strategies.length === 0 && (
            <GlassCard padding="lg" className="text-center">
              <RefreshCw size={24} className="mx-auto mb-2 text-[#475569]" />
              <p className="text-xs text-[#475569] mb-3">No strategies yet</p>
              <GlassButton variant="primary" size="sm" onClick={async () => {
                await fetch("/api/strategies", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "dca", name: "SOL Daily DCA", config: { token: "SOL", usdAmount: 25, frequency: "1d" } }),
                });
                loadStrategies();
              }}>Create SOL DCA</GlassButton>
            </GlassCard>
          )}
        </div>
      )}

      {/* ═══ RISK TAB ═══ */}
      {tab === "risk" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard padding="lg" className="flex flex-col items-center justify-center">
              <RiskGauge score={riskScore} />
              <p className="text-xs text-[#475569] mt-2">Portfolio Risk Score</p>
            </GlassCard>
            <GlassCard padding="md" className="md:col-span-2">
              <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">Risk Factors</h3>
              <div className="space-y-2">
                {[
                  { name: "Concentration", score: 25, desc: "Max position: 35%" },
                  { name: "Diversification", score: 40, desc: "5 positions" },
                  { name: "Volatility", score: 55, desc: "Avg volatility: 45%" },
                  { name: "Stablecoin Buffer", score: 60, desc: "8% in stablecoins" },
                ].map(f => (
                  <div key={f.name} className="flex items-center gap-3 text-xs">
                    <span className="w-28 text-[#94a3b8]">{f.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-[rgba(255,255,255,0.04)]">
                      <div className="h-full rounded-full transition-all" style={{ width: `${f.score}%`, backgroundColor: f.score < 30 ? "#22c55e" : f.score < 60 ? "#f59e0b" : "#ef4444" }} />
                    </div>
                    <span className="w-10 text-right text-[#475569]">{f.score}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          <GlassCard padding="md">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3 flex items-center gap-1"><AlertTriangle size={12} /> Recommendations</h3>
            <ul className="space-y-1.5 text-xs text-[#94a3b8]">
              <li>• Consider adding stablecoin buffer (10-20%)</li>
              <li>• Diversify across more asset categories</li>
              <li>• Monitor high-volatility positions</li>
            </ul>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
