import { useState, useEffect, useRef } from "react";

export function CryptoHubPage() {
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Market data
  const [screener, setScreener] = useState<any>(null);
  const [globalData, setGlobalData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Portfolio
  const [portfolio, setPortfolio] = useState<any>(null);

  // Analysis
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any>(null);
  const [historyDays, setHistoryDays] = useState(7);

  // News & Whales
  const [newsDigest, setNewsDigest] = useState<any>(null);
  const [whaleAlerts, setWhaleAlerts] = useState<any[]>([]);

  // Watchlist
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [addSymbolInput, setAddSymbolInput] = useState("");

  const refreshTimerRef = useRef<any>(null);

  useEffect(() => {
    refreshAll();
    refreshTimerRef.current = setInterval(refreshAll, 300_000);
    return () => clearInterval(refreshTimerRef.current);
  }, []);

  async function refreshAll() {
    setLoading(true);
    setError("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const [marketRes, portfolioRes, newsRes, whalesRes, watchlistRes] = await Promise.allSettled([
        fetch("/api/crypto-hub/market", { signal: controller.signal }).then(r => r.ok ? r.json() : null),
        fetch("/api/crypto-hub/portfolio", { signal: controller.signal }).then(r => r.ok ? r.json() : null),
        fetch("/api/crypto-hub/news", { signal: controller.signal }).then(r => r.ok ? r.json() : null),
        fetch("/api/crypto-hub/whales", { signal: controller.signal }).then(r => r.ok ? r.json() : null),
        fetch("/api/crypto-hub/watchlist", { signal: controller.signal }).then(r => r.ok ? r.json() : null),
      ]);
      clearTimeout(timeout);
      if (marketRes.status === "fulfilled" && marketRes.value) setScreener(marketRes.value);
      if (portfolioRes.status === "fulfilled" && portfolioRes.value) setPortfolio(portfolioRes.value);
      if (newsRes.status === "fulfilled" && newsRes.value) setNewsDigest(newsRes.value);
      if (whalesRes.status === "fulfilled" && whalesRes.value) setWhaleAlerts(whalesRes.value?.alerts || whalesRes.value || []);
      if (watchlistRes.status === "fulfilled" && watchlistRes.value) setWatchlist(watchlistRes.value?.watchlist || watchlistRes.value || []);

      try {
        const gRes = await fetch("/api/crypto-hub/global");
        if (gRes.ok) setGlobalData(await gRes.json());
      } catch { /* ignore */ }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function analyzeSymbol() {
    if (!selectedSymbol.trim()) return;
    setAnalyzing(true);
    setAnalysis(null);
    setPriceHistory(null);
    try {
      const [aRes, hRes] = await Promise.all([
        fetch(`/api/crypto-hub/analyze/${selectedSymbol.trim().toUpperCase()}`).then(r => r.json()),
        fetch(`/api/crypto-hub/history/${selectedSymbol.trim().toUpperCase()}?days=${historyDays}`).then(r => r.json()),
      ]);
      setAnalysis(aRes.signal || aRes);
      setPriceHistory(hRes);
    } catch (e: any) {
      setError(e.message);
    }
    setAnalyzing(false);
  }

  async function searchCoins() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/crypto-hub/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || data.coins || []);
      }
    } catch { /* ignore */ }
    setSearching(false);
  }

  async function addToWatchlist(symbol: string) {
    try {
      await fetch("/api/crypto-hub/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbol.toUpperCase() }),
      });
      await refreshAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function removeFromWatchlist(symbol: string) {
    try {
      await fetch(`/api/crypto-hub/watchlist/${symbol.toUpperCase()}`, { method: "DELETE" });
      await refreshAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function signalColor(signal: string) {
    switch (signal?.toLowerCase()) {
      case "buy": case "bullish": case "accumulate": return "text-emerald-400";
      case "sell": case "bearish": case "distribute": return "text-red-400";
      case "hold": case "neutral": return "text-amber-400";
      default: return "text-slate-400";
    }
  }

  const tabs = [
    { id: "overview", label: "Market Overview", icon: "📊" },
    { id: "watchlist", label: "Watchlist", icon: "⭐" },
    { id: "analysis", label: "Analysis", icon: "🔬" },
    { id: "portfolio", label: "Portfolio", icon: "💰" },
    { id: "whales", label: "Whale Tracker", icon: "🐋" },
  ];

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Crypto & Trading Hub</h2>
          <p className="text-xs text-slate-400 mt-1">Real-time market data, AI-powered analysis, portfolio tracking, and whale alerts.</p>
        </div>
        <button className="btn-premium px-3 py-1.5 rounded text-xs flex items-center gap-1.5" onClick={refreshAll} disabled={loading}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Global Stats Bar */}
      {globalData && (
        <div className="glass-panel rounded-xl p-3 mb-4 flex items-center justify-around text-xs">
          <span className="text-slate-400">Total Market Cap: <strong className="text-white">${(globalData.totalMarketCap || 0).toLocaleString()}</strong></span>
          <span className="text-slate-400">BTC Dominance: <strong className="text-white">{globalData.btcDominance?.toFixed(1)}%</strong></span>
          <span className="text-slate-400">24h Volume: <strong className="text-white">${(globalData.totalVolume24h || 0).toLocaleString()}</strong></span>
        </div>
      )}

      {error && (
        <div className="glass-panel rounded-xl p-3 mb-4 border border-red-500/30">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800 pb-0 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${tab === t.id ? "border-[#00f2fe] text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="glass-panel rounded-xl p-8 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin"></span>
            <span className="text-xs text-slate-400">Loading market data...</span>
          </div>
        </div>
      )}

      {!loading && tab === "overview" && (
        <>
          {/* Market Screener */}
          <div className="glass-panel rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">📊 Market Screener</h3>
              <div className="flex items-center gap-2">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") searchCoins(); }}
                  placeholder="Search coins..."
                  className="bg-[#020408]/60 border border-slate-800 rounded px-2 py-1 text-[11px] text-white w-40 focus:outline-none focus:border-[#00f2fe]" />
                <button onClick={searchCoins} disabled={searching}
                  className="btn-premium px-2 py-1 rounded text-[10px] disabled:opacity-40">
                  {searching ? "..." : "Search"}
                </button>
              </div>
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-1 mb-4">
                {searchResults.map((coin: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-900/40 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{coin.symbol || coin.id}</span>
                      <span className="text-slate-500">{coin.name}</span>
                    </div>
                    <button onClick={() => addToWatchlist(coin.symbol || coin.id)}
                      className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-400 border border-indigo-900/30">+ Watchlist</button>
                  </div>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="text-left py-2 pr-2">#</th>
                    <th className="text-left py-2 pr-2">Name</th>
                    <th className="text-right py-2 pr-2">Price</th>
                    <th className="text-right py-2 pr-2">24h</th>
                    <th className="text-right py-2 pr-2">7d</th>
                    <th className="text-right py-2 pr-2">Market Cap</th>
                    <th className="text-right py-2 pr-2">Volume 24h</th>
                  </tr>
                </thead>
                <tbody>
                  {(screener?.coins || screener || []).slice(0, 30).map((coin: any, i: number) => (
                    <tr key={coin.id || i} className="border-b border-slate-800/50 hover:bg-slate-900/30 cursor-pointer"
                      onClick={() => { setSelectedSymbol(coin.symbol || coin.id); setTab("analysis"); }}>
                      <td className="py-2 pr-2 text-slate-500">{i + 1}</td>
                      <td className="py-2 pr-2">
                        <span className="text-white font-medium">{coin.symbol || coin.id}</span>
                        {coin.name && <span className="text-slate-500 ml-1">{coin.name}</span>}
                      </td>
                      <td className="py-2 pr-2 text-right text-white">${(coin.price || coin.current_price || 0).toLocaleString()}</td>
                      <td className={`py-2 pr-2 text-right ${(coin.change24h || coin.price_change_percentage_24h || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {(coin.change24h || coin.price_change_percentage_24h || 0).toFixed(2)}%
                      </td>
                      <td className={`py-2 pr-2 text-right ${(coin.change7d || coin.price_change_percentage_7d_in_currency || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {(coin.change7d || coin.price_change_percentage_7d_in_currency || 0).toFixed(2)}%
                      </td>
                      <td className="py-2 pr-2 text-right text-slate-300">${(coin.marketCap || coin.market_cap || 0).toLocaleString()}</td>
                      <td className="py-2 pr-2 text-right text-slate-400">${(coin.volume24h || coin.total_volume || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!screener?.coins && !screener?.length) && (
                <p className="text-center text-slate-500 py-4">No market data available</p>
              )}
            </div>
          </div>

          {/* News & Whales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {newsDigest && (
              <div className="glass-panel rounded-xl p-5">
                <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">📰 News</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {(newsDigest.articles || newsDigest.news || []).slice(0, 10).map((article: any, i: number) => (
                    <div key={i} className="p-2 bg-slate-900/30 rounded-lg">
                      <a href={article.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-white hover:text-[#00f2fe] transition-colors">{article.title}</a>
                      <p className="text-[9px] text-slate-500 mt-0.5">{article.source} · {article.date || ""}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="glass-panel rounded-xl p-5">
              <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">🐋 Whale Alerts</h3>
              {whaleAlerts.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No recent whale movements detected</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {whaleAlerts.slice(0, 15).map((alert: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-900/30 rounded-lg text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{alert.symbol || alert.coin}</span>
                        <span className={`text-[10px] ${(alert.amount || 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {(alert.amount || 0).toFixed(2)} {alert.symbol}
                        </span>
                      </div>
                      <span className="text-slate-500">${(alert.value || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && tab === "watchlist" && (
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">⭐ Watchlist</h3>
            <div className="flex gap-2">
              <input type="text" value={addSymbolInput} onChange={(e) => setAddSymbolInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && addSymbolInput.trim()) { addToWatchlist(addSymbolInput.trim()); setAddSymbolInput(""); } }}
                placeholder="Add symbol..."
                className="bg-[#020408]/60 border border-slate-800 rounded px-2 py-1 text-[11px] text-white w-28 focus:outline-none focus:border-[#00f2fe]" />
              <button onClick={() => { if (addSymbolInput.trim()) { addToWatchlist(addSymbolInput.trim()); setAddSymbolInput(""); } }}
                className="btn-premium px-2 py-1 rounded text-[10px]">+ Add</button>
            </div>
          </div>
          {watchlist.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">Your watchlist is empty. Search for coins and add them here.</p>
          ) : (
            <div className="space-y-2">
              {watchlist.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-white">{item.symbol || item.coin}</span>
                    {item.price && <span className="text-xs text-slate-300">${item.price.toLocaleString()}</span>}
                    {item.change24h !== undefined && (
                      <span className={`text-xs ${item.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {item.change24h.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedSymbol(item.symbol || item.coin); setTab("analysis"); }}
                      className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-400 border border-indigo-900/30">Analyze</button>
                    <button onClick={() => removeFromWatchlist(item.symbol || item.coin)}
                      className="text-[10px] px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/30">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === "analysis" && (
        <>
          <div className="glass-panel rounded-xl p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <input type="text" value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") analyzeSymbol(); }}
                placeholder="e.g. BTC, ETH, SOL..."
                className="bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white w-40 focus:outline-none focus:border-[#00f2fe]" />
              <select value={historyDays} onChange={(e) => setHistoryDays(Number(e.target.value))}
                className="bg-[#020408]/60 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-white">
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
              <button onClick={analyzeSymbol} disabled={analyzing || !selectedSymbol.trim()}
                className="btn-premium px-4 py-1.5 rounded text-xs disabled:opacity-40">
                {analyzing ? "Analyzing..." : "Analyze"}
              </button>
            </div>

            {analyzing && (
              <div className="flex items-center justify-center py-8">
                <span className="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400 ml-3">Analyzing {selectedSymbol}...</span>
              </div>
            )}

            {analysis && !analyzing && (
              <div className="space-y-4">
                <div className={`p-3 rounded-lg border text-xs ${analysis.signal?.toLowerCase() === "buy" || analysis.signal?.toLowerCase() === "bullish" ? "bg-emerald-950/30 border-emerald-800/30" : analysis.signal?.toLowerCase() === "sell" || analysis.signal?.toLowerCase() === "bearish" ? "bg-red-950/30 border-red-800/30" : "bg-amber-950/30 border-amber-800/30"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-bold text-lg ${signalColor(analysis.signal)}`}>{analysis.signal || "NEUTRAL"}</span>
                    <span className="text-slate-500">Signal for {selectedSymbol}</span>
                  </div>
                  {analysis.confidence && <p className="text-slate-400">Confidence: {(analysis.confidence * 100).toFixed(0)}%</p>}
                  {analysis.summary && <p className="text-slate-400 mt-1">{analysis.summary}</p>}
                </div>
                {analysis.indicators && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(analysis.indicators).map(([key, val]) => (
                      <div key={key} className="p-2 bg-slate-900/30 rounded-lg text-xs">
                        <p className="text-slate-500 uppercase text-[9px]">{key}</p>
                        <p className="text-white font-mono mt-0.5">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {analysis.reasoning && (
                  <div className="p-3 bg-slate-900/30 rounded-lg">
                    <p className="text-[9px] text-slate-500 uppercase mb-1">Reasoning</p>
                    <p className="text-xs text-slate-400">{analysis.reasoning}</p>
                  </div>
                )}
              </div>
            )}

            {!analysis && !analyzing && (
              <p className="text-xs text-slate-500 text-center py-8">Enter a symbol and click Analyze to get AI-powered market analysis</p>
            )}
          </div>

          {priceHistory && (
            <div className="glass-panel rounded-xl p-5">
              <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">📈 Price History ({historyDays} days)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800">
                      <th className="text-left py-2 pr-2">Date</th>
                      <th className="text-right py-2 pr-2">Open</th>
                      <th className="text-right py-2 pr-2">High</th>
                      <th className="text-right py-2 pr-2">Low</th>
                      <th className="text-right py-2 pr-2">Close</th>
                      <th className="text-right py-2 pr-2">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(priceHistory.prices || priceHistory.data || []).slice(-30).map((entry: any, i: number) => (
                      <tr key={i} className="border-b border-slate-800/30">
                        <td className="py-1.5 pr-2 text-slate-400">{new Date(entry.date || entry[0] || entry.timestamp).toLocaleDateString()}</td>
                        <td className="py-1.5 pr-2 text-right text-slate-300">${(entry.open || (Array.isArray(entry) ? entry[1] : 0)).toFixed(2)}</td>
                        <td className="py-1.5 pr-2 text-right text-emerald-400">${(entry.high || (Array.isArray(entry) ? entry[2] : 0)).toFixed(2)}</td>
                        <td className="py-1.5 pr-2 text-right text-red-400">${(entry.low || (Array.isArray(entry) ? entry[3] : 0)).toFixed(2)}</td>
                        <td className="py-1.5 pr-2 text-right text-white">${(entry.close || (Array.isArray(entry) ? entry[4] : 0)).toFixed(2)}</td>
                        <td className="py-1.5 pr-2 text-right text-slate-500">${(entry.volume || (Array.isArray(entry) ? entry[5] : 0)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && tab === "portfolio" && (
        <div className="glass-panel rounded-xl p-5">
          <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">💰 Portfolio</h3>
          {portfolio ? (
            <div className="space-y-3">
              {portfolio.totalValue && (
                <div className="p-4 bg-slate-900/30 rounded-lg">
                  <p className="text-xs text-slate-500">Total Portfolio Value</p>
                  <p className="text-2xl font-bold text-white">${portfolio.totalValue.toLocaleString()}</p>
                  {portfolio.change24h !== undefined && (
                    <p className={`text-xs mt-1 ${portfolio.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {portfolio.change24h >= 0 ? "+" : ""}{portfolio.change24h.toFixed(2)}% (24h)
                    </p>
                  )}
                </div>
              )}
              {(portfolio.positions || portfolio.holdings || []).map((pos: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{pos.symbol || pos.coin}</span>
                    <span className="text-slate-500">{pos.amount || pos.quantity} {pos.symbol}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white">${(pos.value || 0).toLocaleString()}</p>
                    {pos.pnl !== undefined && (
                      <p className={`text-[10px] ${pos.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {pos.pnl >= 0 ? "+" : ""}{pos.pnl?.toFixed(2)}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">No portfolio data available. Configure your portfolio in settings.</p>
          )}
        </div>
      )}

      {!loading && tab === "whales" && (
        <div className="glass-panel rounded-xl p-5">
          <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">🐋 Whale Tracker — Large Transactions</h3>
          {whaleAlerts.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">No whale movements detected in the last 24 hours.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="text-left py-2 pr-2">Coin</th>
                    <th className="text-right py-2 pr-2">Amount</th>
                    <th className="text-right py-2 pr-2">Value (USD)</th>
                    <th className="text-right py-2 pr-2">Type</th>
                    <th className="text-right py-2 pr-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {whaleAlerts.map((alert: any, i: number) => (
                    <tr key={i} className="border-b border-slate-800/30">
                      <td className="py-1.5 pr-2 font-bold text-white">{alert.symbol || alert.coin}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-300">{alert.amount?.toFixed(2)}</td>
                      <td className="py-1.5 pr-2 text-right text-white">${(alert.value || 0).toLocaleString()}</td>
                      <td className={`py-1.5 pr-2 text-right ${(alert.type === "buy" || alert.type === "inflow") ? "text-emerald-400" : "text-red-400"}`}>
                        {alert.type || (alert.amount > 0 ? "Buy" : "Sell")}
                      </td>
                      <td className="py-1.5 pr-2 text-right text-slate-500">
                        {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
