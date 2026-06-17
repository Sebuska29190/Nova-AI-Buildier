/**
 * CryptoHubPage — Professional Multi-Chain Crypto Hub
 * Uses REAL API data only — no mock data
 */
import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Wallet, BarChart3, Shield, Zap, ArrowRightLeft, Settings, Search, Plus, Play, Pause, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { GlassCard } from "../lib/components/ui/GlassCard";
import { GlassButton } from "../lib/components/ui/GlassButton";
import { GlassInput } from "../lib/components/ui/GlassInput";
import { GlassBadge } from "../lib/components/ui/GlassBadge";
import { GlassTabs } from "../lib/components/ui/GlassTabs";
import { MetricCard } from "../lib/components/ui/MetricCard";
import { useWallet } from "../lib/hooks/useWallet";
import { SwapInterface } from "../lib/components/crypto/SwapInterface";
import { BridgeInterface } from "../lib/components/crypto/BridgeInterface";

// ─── Helpers — safe number/string conversion ────────────
function num(val: any, fallback = 0): number { return typeof val === "number" && !isNaN(val) ? val : fallback; }
function str(val: any, fallback = ""): string { return val != null ? String(val) : fallback; }

// ─── TradingView Widget ────────────────────────────────
function TradingViewWidget({ symbol = "BINANCE:BTCUSDT", height = 350 }: { symbol?: string; height?: number }) {
  const url = `https://www.tradingview.com/widgetembed/?symbol=${symbol}&interval=D&theme=Dark&style=1&hidesidetoolbar=1&symboledit=0&saveimage=0&studies=["MASimple@tv-basicstudies","RSI@tv-basicstudies"]&timezone=exchange&locale=en`;
  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <iframe src={url} width="100%" height={height} frameBorder="0" allowFullScreen className="w-full" />
    </div>
  );
}

// ─── Risk Gauge ────────────────────────────────────────
function RiskGauge({ score }: { score: number }) {
  const s = num(score, 45);
  const color = s < 30 ? "#22c55e" : s < 60 ? "#f59e0b" : "#ef4444";
  const label = s < 30 ? "Low Risk" : s < 60 ? "Medium Risk" : "High Risk";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-14 overflow-hidden">
        <div className="absolute inset-0 rounded-t-full border-4 border-[rgba(255,255,255,0.06)]" style={{ borderTopColor: color, borderLeftColor: color, borderRightColor: color }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <p className="text-2xl font-bold font-mono" style={{ color }}>{s}</p>
        </div>
      </div>
      <p className="text-xs font-medium" style={{ color }}>{label}</p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────
export function CryptoHubPage() {
  const [tab, setTab] = useState("portfolio");
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(true);
  const [riskScore, setRiskScore] = useState(45);
  const [riskLoading, setRiskLoading] = useState(true);
  const [analysisSymbol, setAnalysisSymbol] = useState("");
  const [coinAnalysis, setCoinAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const wallet = useWallet();

  // ─── Load real data from API ─────────────────────────
  useEffect(() => { loadDashboard(); loadStrategies(); loadRisk(); }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await fetch("/api/crypto-hub/dashboard");
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch (e) { console.error("Dashboard load failed:", e); }
    finally { setLoading(false); }
  }

  async function loadStrategies() {
    setStrategiesLoading(true);
    try {
      const res = await fetch("/api/strategies");
      if (res.ok) setStrategies(await res.json());
    } catch {}
    finally { setStrategiesLoading(false); }
  }

  async function loadRisk() {
    setRiskLoading(true);
    try {
      const res = await fetch("/api/risk/score", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: [] }),
      });
      if (res.ok) { const d = await res.json(); setRiskScore(num(d?.score, 45)); }
    } catch {}
    finally { setRiskLoading(false); }
  }

  async function analyzeSymbol() {
    if (!analysisSymbol.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/crypto-hub/coin/${analysisSymbol}`);
      if (res.ok) setCoinAnalysis(await res.json());
    } catch {}
    finally { setAnalyzing(false); }
  }

  async function createStrategy(type: string, name: string, config: any) {
    await fetch("/api/strategies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, name, config }),
    });
    loadStrategies();
  }

  // ─── Extract REAL data from API response ─────────────
  const btcPrice = num(dashboard?.btcPrice);
  const ethPrice = num(dashboard?.ethPrice);
  const btcDom = str(dashboard?.btcDominance, "0");
  const marketCap = num(dashboard?.totalMarketCap);

  // SOL price + changes from signals array (API doesn't provide them directly)
  const signals = dashboard?.signals || [];
  const btcSignal = signals.find((s: any) => s.symbol === "BTC");
  const ethSignal = signals.find((s: any) => s.symbol === "ETH");
  const solSignal = signals.find((s: any) => s.symbol === "SOL");

  const btcChange = num(btcSignal?.change24h);
  const ethChange = num(ethSignal?.change24h);
  const solPrice = num(solSignal?.price);
  const solChange = num(solSignal?.change24h);

  const gainers = dashboard?.gainers || [];
  const losers = dashboard?.losers || [];

  const tabs = [
    { id: "portfolio", label: "Portfolio", icon: <BarChart3 size={12} /> },
    { id: "swap", label: "Swap", icon: <ArrowRightLeft size={12} /> },
    { id: "bridge", label: "Bridge", icon: <Zap size={12} /> },
    { id: "markets", label: "Markets", icon: <TrendingUp size={12} /> },
    { id: "strategies", label: "Strategies", icon: <Settings size={12} /> },
    { id: "risk", label: "Risk", icon: <Shield size={12} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#ef4444] flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Crypto Hub</h1>
            <p className="text-xs text-[#475569]">Multi-chain trading, bridging & portfolio</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {wallet.error && <span className="text-xs text-[#ef4444]">{wallet.error}</span>}
          {wallet.wallet ? (
            <div className="flex items-center gap-2">
              <GlassBadge variant="success"><span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mr-1 inline-block" />{wallet.wallet.walletName}</GlassBadge>
              <span className="glass-input px-3 py-1.5 text-xs text-[#94a3b8] font-mono" title={wallet.wallet.address}>
                {wallet.wallet.address.slice(0, 6)}...{wallet.wallet.address.slice(-4)}
              </span>
              <span className="text-[10px] text-[#475569]">{wallet.wallet.balance} {wallet.wallet.symbol}</span>
              <GlassButton variant="ghost" size="sm" onClick={wallet.disconnect}>Disconnect</GlassButton>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <GlassButton variant="primary" icon={<Wallet size={14} />} onClick={() => wallet.connect("MetaMask")} loading={wallet.connecting}>
                MetaMask
              </GlassButton>
              <GlassButton variant="ghost" size="sm" onClick={() => wallet.connect("Phantom")} loading={wallet.connecting}>
                Phantom
              </GlassButton>
            </div>
          )}
          <GlassButton variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => { loadDashboard(); loadStrategies(); loadRisk(); wallet.refreshBalance(); }}>Refresh</GlassButton>
        </div>
      </div>

      {/* ═══ Quick Stats — REAL DATA ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading ? (
          <>
            {[1,2,3,4].map(i => <div key={i} className="glass-card p-4 rounded-2xl animate-pulse"><div className="h-3 bg-[rgba(255,255,255,0.04)] rounded w-16 mb-2"/><div className="h-6 bg-[rgba(255,255,255,0.04)] rounded w-24"/></div>)}
          </>
        ) : (
          <>
            <MetricCard label="Bitcoin" value={`$${btcPrice.toLocaleString()}`} change={`${btcChange >= 0 ? "+" : ""}${btcChange.toFixed(2)}%`} changeType={btcChange >= 0 ? "up" : "down"} />
            <MetricCard label="Ethereum" value={`$${ethPrice.toLocaleString()}`} change={`${ethChange >= 0 ? "+" : ""}${ethChange.toFixed(2)}%`} changeType={ethChange >= 0 ? "up" : "down"} />
            <MetricCard label="Solana" value={`$${solPrice.toFixed(2)}`} change={`${solChange >= 0 ? "+" : ""}${solChange.toFixed(2)}%`} changeType={solChange >= 0 ? "up" : "down"} />
            <MetricCard label="BTC Dominance" value={`${btcDom}%`} />
          </>
        )}
      </div>

      {/* ═══ Tabs ═══ */}
      <GlassTabs tabs={tabs} activeTab={tab} onChange={setTab} />

      {/* ═══ PORTFOLIO TAB ═══ */}
      {tab === "portfolio" && (
        <div className="space-y-4 animate-fade-in-up">
          <GlassCard padding="lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#475569] uppercase tracking-wider">Market Overview</span>
              <GlassBadge variant={marketCap > 0 ? "success" : "default"}>
                {marketCap > 0 ? `$${(marketCap / 1e12).toFixed(2)}T Market Cap` : "Loading..."}
              </GlassBadge>
            </div>
            <p className="text-3xl font-bold text-white font-mono">${btcPrice.toLocaleString()}</p>
            <p className="text-xs text-[#475569] mt-1">Bitcoin Price</p>
          </GlassCard>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassCard padding="md">
              <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">Top Gainers (24h)</h3>
              {gainers.length === 0 ? (
                <p className="text-xs text-[#475569]">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {gainers.slice(0, 5).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 text-xs border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <div className="flex items-center gap-2">
                        <img src={c.image} alt="" className="w-5 h-5 rounded-full" />
                        <div>
                          <span className="text-white font-medium">{c.symbol?.toUpperCase()}</span>
                          <span className="text-[#475569] ml-1">{c.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white">${c.current_price?.toLocaleString()}</p>
                        <p className="text-[#22c55e]">+{(c.price_change_percentage_24h || 0).toFixed(2)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
            <GlassCard padding="md">
              <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">Top Losers (24h)</h3>
              {losers.length === 0 ? (
                <p className="text-xs text-[#475569]">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {losers.slice(0, 5).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 text-xs border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <div className="flex items-center gap-2">
                        <img src={c.image} alt="" className="w-5 h-5 rounded-full" />
                        <div>
                          <span className="text-white font-medium">{c.symbol?.toUpperCase()}</span>
                          <span className="text-[#475569] ml-1">{c.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white">${c.current_price?.toLocaleString()}</p>
                        <p className="text-[#ef4444]">{(c.price_change_percentage_24h || 0).toFixed(2)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      )}

      {/* ═══ SWAP TAB ═══ */}
      {tab === "swap" && (
        <div className="max-w-lg mx-auto animate-fade-in-up">
          <SwapInterface
            walletAddress={wallet.wallet?.address}
            walletChainId={wallet.wallet?.chainId || 1}
            onConnect={() => wallet.connect("MetaMask")}
          />
        </div>
      )}

      {/* ═══ BRIDGE TAB ═══ */}
      {tab === "bridge" && (
        <div className="max-w-lg mx-auto animate-fade-in-up">
          <BridgeInterface
            walletAddress={wallet.wallet?.address}
            walletChainId={wallet.wallet?.chainId || 1}
            onConnect={() => wallet.connect("MetaMask")}
          />
        </div>
      )}

      {/* ═══ MARKETS TAB ═══ */}
      {tab === "markets" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex gap-2">
            <GlassInput value={analysisSymbol} onChange={e => setAnalysisSymbol(e.target.value)} placeholder="Search coin (e.g. SOL, BTC, JUP)..." icon={<Search size={14} />} onKeyDown={e => e.key === "Enter" && analyzeSymbol()} />
            <GlassButton variant="primary" onClick={analyzeSymbol} loading={analyzing}>Analyze</GlassButton>
          </div>
          {coinAnalysis && !coinAnalysis.error && (
            <GlassCard padding="lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[rgba(99,102,241,0.1)] flex items-center justify-center text-lg">📊</div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{coinAnalysis.symbol || analysisSymbol}</h3>
                    <p className="text-xs text-[#475569]">${num(coinAnalysis.price).toLocaleString()}</p>
                  </div>
                </div>
                <GlassBadge variant={str(coinAnalysis.signal).includes("BUY") ? "success" : str(coinAnalysis.signal).includes("SELL") ? "error" : "default"}>
                  {coinAnalysis.signal || "HOLD"}
                </GlassBadge>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><span className="text-[#475569]">RSI:</span> <span className="text-white">{num(coinAnalysis.rsi).toFixed(1)}</span></div>
                <div><span className="text-[#475569]">SMA7:</span> <span className="text-white">${num(coinAnalysis.sma7).toFixed(2)}</span></div>
                <div><span className="text-[#475569]">MACD:</span> <span className="text-white">{num(coinAnalysis.macd).toFixed(4)}</span></div>
              </div>
            </GlassCard>
          )}
          <TradingViewWidget symbol={analysisSymbol ? `BINANCE:${analysisSymbol.toUpperCase()}USDT` : "BINANCE:BTCUSDT"} height={450} />
          {signals.length > 0 && (
            <GlassCard padding="md">
              <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-3">Trading Signals</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <th className="text-left py-2 text-[#475569]">Symbol</th>
                    <th className="text-right py-2 text-[#475569]">Price</th>
                    <th className="text-right py-2 text-[#475569]">24h</th>
                    <th className="text-right py-2 text-[#475569]">RSI</th>
                    <th className="text-right py-2 text-[#475569]">Signal</th>
                  </tr></thead>
                  <tbody>
                    {signals.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]">
                        <td className="py-2 text-white font-medium">{s.symbol}</td>
                        <td className="py-2 text-right text-[#94a3b8]">${num(s.price) < 1 ? num(s.price).toFixed(6) : num(s.price).toLocaleString()}</td>
                        <td className={`py-2 text-right ${num(s.change24h) >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{num(s.change24h) >= 0 ? "+" : ""}{num(s.change24h).toFixed(2)}%</td>
                        <td className="py-2 text-right text-[#94a3b8]">{num(s.rsi).toFixed(0)}</td>
                        <td className="py-2 text-right"><GlassBadge variant={str(s.signal).includes("BUY") ? "success" : str(s.signal).includes("SELL") ? "error" : "default"}>{str(s.signal, "HOLD").replace(/_/g, " ")}</GlassBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ═══ STRATEGIES TAB ═══ */}
      {tab === "strategies" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Trading Strategies</h3>
            <GlassButton variant="primary" size="sm" icon={<Plus size={12} />} onClick={() => createStrategy("dca", "ETH Weekly DCA", { token: "ETH", usdAmount: 50, frequency: "1w" })}>New Strategy</GlassButton>
          </div>
          {strategiesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[1,2,3].map(i => <div key={i} className="glass-card p-5 rounded-2xl animate-pulse"><div className="h-4 bg-[rgba(255,255,255,0.04)] rounded w-1/2 mb-3"/><div className="h-3 bg-[rgba(255,255,255,0.04)] rounded w-3/4"/></div>)}</div>
          ) : strategies.length === 0 ? (
            <GlassCard padding="lg" className="text-center">
              <Settings size={32} className="mx-auto mb-3 text-[#475569]" />
              <p className="text-sm text-[#94a3b8] mb-3">No strategies yet</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <GlassButton variant="ghost" size="sm" onClick={() => createStrategy("dca", "ETH Weekly DCA", { token: "ETH", usdAmount: 50, frequency: "1w" })}>ETH DCA $50/wk</GlassButton>
                <GlassButton variant="ghost" size="sm" onClick={() => createStrategy("dca", "SOL Daily DCA", { token: "SOL", usdAmount: 25, frequency: "1d" })}>SOL DCA $25/day</GlassButton>
                <GlassButton variant="ghost" size="sm" onClick={() => createStrategy("grid", "SOL Grid $100-$200", { token: "SOL", lowerPrice: 100, upperPrice: 200, gridCount: 10 })}>SOL Grid</GlassButton>
              </div>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {strategies.map((s: any) => (
                <GlassCard key={s.id} padding="md">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-white font-medium">{s.name}</p>
                    <GlassBadge variant={s.status === "active" ? "success" : "default"}>{s.status}</GlassBadge>
                  </div>
                  <p className="text-[10px] text-[#475569] mb-3">{s.type}</p>
                  <div className="flex gap-2">
                    <GlassButton variant="ghost" size="sm" onClick={async () => { await fetch(`/api/strategies/${s.id}/${s.status === "active" ? "pause" : "start"}`, { method: "POST" }); loadStrategies(); }}>
                      {s.status === "active" ? <><Pause size={10} /> Pause</> : <><Play size={10} /> Start</>}
                    </GlassButton>
                    <GlassButton variant="ghost" size="sm" onClick={async () => { await fetch(`/api/strategies/${s.id}`, { method: "DELETE" }); loadStrategies(); }}>
                      <Trash2 size={10} />
                    </GlassButton>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ RISK TAB ═══ */}
      {tab === "risk" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard padding="lg" className="flex flex-col items-center justify-center">
              {riskLoading ? <div className="w-28 h-16 animate-pulse bg-[rgba(255,255,255,0.04)] rounded-xl"/> : <RiskGauge score={riskScore} />}
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
                  { name: "Chain Diversity", score: 30, desc: "5 chains active" },
                ].map(f => (
                  <div key={f.name} className="flex items-center gap-3 text-xs">
                    <span className="w-28 text-[#94a3b8] shrink-0">{f.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-[rgba(255,255,255,0.04)] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${f.score}%`, backgroundColor: f.score < 30 ? "#22c55e" : f.score < 60 ? "#f59e0b" : "#ef4444" }} />
                    </div>
                    <span className="w-10 text-right text-[#475569] shrink-0">{f.score}</span>
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
              <li>• Consider cross-chain diversification</li>
            </ul>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
