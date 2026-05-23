<script lang="ts">
  import PageTemplate from "../lib/components/PageTemplate.svelte";
  import Card from "../lib/components/ui/Card.svelte";
  import Button from "../lib/components/ui/Button.svelte";
  import Badge from "../lib/components/ui/Badge.svelte";

  let symbol = $state("AAPL");
  let loading = $state(false);
  let analysis = $state<any>(null);
  let error = $state("");

  // Watchlist
  let watchlist = $state<Array<{ symbol: string; addedAt: string; note?: string }>>([]);
  let watchlistLoading = $state(false);

  // Historical data
  let historyRange = $state<"1d" | "5d" | "1mo" | "3mo" | "1y">("1mo");
  let historyData = $state<Array<{ date: string; close: number; volume?: number }>>([]);
  let historyLoading = $state(false);

  async function analyze() {
    if (!symbol.trim()) return;
    loading = true;
    error = "";
    analysis = null;
    try {
      const res = await fetch(`/api/trading/${symbol.trim().toUpperCase()}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      analysis = data.analysis;
      // Load historical data after analysis
      await loadHistory();
    } catch (e: any) {
      error = e.message;
    }
    loading = false;
  }

  async function loadHistory() {
    if (!symbol.trim()) return;
    historyLoading = true;
    try {
      const res = await fetch(`/api/trading/${symbol.trim().toUpperCase()}/history?range=${historyRange}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      historyData = data.data || [];
    } catch {}
    historyLoading = false;
  }

  async function loadWatchlist() {
    watchlistLoading = true;
    try {
      const res = await fetch("/api/trading/watchlist");
      if (res.ok) {
        const data = await res.json();
        watchlist = data.watchlist || [];
      }
    } catch {}
    watchlistLoading = false;
  }

  async function addToWatchlist() {
    if (!symbol.trim()) return;
    try {
      await fetch("/api/trading/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbol.trim().toUpperCase() }),
      });
      await loadWatchlist();
    } catch {}
  }

  async function removeFromWatchlist(sym: string) {
    try {
      await fetch(`/api/trading/watchlist/${sym}`, { method: "DELETE" });
      await loadWatchlist();
    } catch {}
  }

  async function selectSymbol(sym: string) {
    symbol = sym;
    await analyze();
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === "Enter") analyze();
  }

  const popularSymbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "BTC-USD", "ETH-USD"];

  // Chart dimensions
  const CHART_W = 600;
  const CHART_H = 200;
  const CHART_PAD = 30;

  function getChartPath(): string {
    if (historyData.length < 2) return "";
    const prices = historyData.map(d => d.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const w = CHART_W - CHART_PAD * 2;
    const h = CHART_H - CHART_PAD * 2;
    const stepX = w / (prices.length - 1);
    const points = prices.map((p, i) => {
      const x = CHART_PAD + i * stepX;
      const y = CHART_PAD + h - ((p - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return points.join(' ');
  }

  function formatPrice(v: number): string {
    return v >= 1000 ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : v.toFixed(2);
  }

  // Init
  $effect(() => { loadWatchlist(); });
</script>

<PageTemplate title="Trading" subtitle="Stock & crypto analysis — powered by Nova AI" icon="📈">
  {#snippet actions()}
    <Button variant="secondary" size="sm" onclick={loadWatchlist} disabled={watchlistLoading}>
      {watchlistLoading ? "..." : "↻ Refresh"}
    </Button>
  {/snippet}

  <div class="layout">
    <!-- Main Content -->
    <div class="main-col">
      <div class="search-bar">
        <input
          type="text"
          value={symbol}
          oninput={(e) => symbol = (e.target as HTMLInputElement).value}
          onkeydown={handleKey}
          placeholder="Enter symbol (e.g., AAPL, BTC-USD, TSLA)"
          disabled={loading}
        />
        <Button variant="primary" onclick={analyze} disabled={loading || !symbol.trim()}>
          {loading ? "Analyzing..." : "Analyze"}
        </Button>
        <Button variant="secondary" onclick={addToWatchlist} disabled={!symbol.trim()}>
          + Watch
        </Button>
      </div>

      <div class="quick-symbols">
        {#each popularSymbols as s}
          <button class="symbol-chip" class:active={symbol === s} onclick={() => selectSymbol(s)}>
            {s}
          </button>
        {/each}
      </div>

      {#if error}
        <Card variant="default" padding="md">
          <div class="error-content">
            <span class="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        </Card>
      {/if}

      {#if analysis}
        <Card variant="default" padding="lg">
          <div class="analysis-header">
            <h2>{analysis.symbol || symbol}</h2>
            {#if analysis.price}
              <span class="price">${formatPrice(analysis.price)}</span>
            {/if}
            {#if analysis.changePercent !== undefined}
              <span class="change" class:positive={analysis.changePercent >= 0} class:negative={analysis.changePercent < 0}>
                {analysis.changePercent >= 0 ? '+' : ''}{analysis.changePercent.toFixed(2)}%
              </span>
            {/if}
            <Badge
              variant={analysis.recommendation === 'BUY' ? 'success' : analysis.recommendation === 'SELL' ? 'error' : 'info'}
              size="sm"
            >
              {analysis.recommendation}
            </Badge>
          </div>

          {#if analysis.summary}
            <div class="analysis-section">
              <h3>AI Summary</h3>
              <p>{analysis.summary}</p>
            </div>
          {/if}

          {#if analysis.sentiment}
            <div class="analysis-section">
              <h3>Sentiment</h3>
              <Badge
                variant={analysis.sentiment === 'bullish' ? 'success' : analysis.sentiment === 'bearish' ? 'error' : 'info'}
                size="sm"
              >
                {analysis.sentiment}
              </Badge>
            </div>
          {/if}

          {#if analysis.signals && analysis.signals.length > 0}
            <div class="analysis-section">
              <h3>Signals</h3>
              <div class="signals-list">
                {#each analysis.signals as signal}
                  <div class="signal-item" class:signal-bullish={signal.direction === 'bullish'} class:signal-bearish={signal.direction === 'bearish'}>
                    <span class="signal-icon">{signal.direction === 'bullish' ? '📈' : '📉'}</span>
                    <span class="signal-text">{signal.text || signal}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if analysis.technical}
            <div class="analysis-section">
              <h3>Technical Analysis</h3>
              <pre class="tech-detail">{analysis.technical}</pre>
            </div>
          {/if}

          {#if analysis.reason}
            <div class="analysis-section">
              <h3>Reason</h3>
              <p>{analysis.reason}</p>
            </div>
          {/if}

          <!-- Historical Chart -->
          {#if historyData.length > 0}
            <div class="analysis-section">
              <div class="chart-header">
                <h3>Price History</h3>
                <div class="range-selector">
                  {#each ["1d", "5d", "1mo", "3mo", "1y"] as range}
                    <button
                      class="range-chip"
                      class:active={historyRange === range}
                      onclick={() => { historyRange = range as any; loadHistory(); }}
                    >
                      {range}
                    </button>
                  {/each}
                </div>
              </div>
              {#if historyLoading}
                <div class="chart-loading">Loading chart...</div>
              {:else}
                <svg viewBox="0 0 {CHART_W} {CHART_H}" class="chart">
                  <!-- Grid lines -->
                  {#each [0, 1, 2, 3] as i}
                    <line
                      x1={CHART_PAD} y1={CHART_PAD + i * ((CHART_H - CHART_PAD * 2) / 3)}
                      x2={CHART_W - CHART_PAD} y2={CHART_PAD + i * ((CHART_H - CHART_PAD * 2) / 3)}
                      stroke="#1e1e2e" stroke-width="1"
                    />
                  {/each}
                  <!-- Price line -->
                  <path d={getChartPath()} fill="none" stroke="#6366f1" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                  <!-- Area fill -->
                  <path d={getChartPath() + ` L${CHART_W - CHART_PAD},${CHART_H - CHART_PAD} L${CHART_PAD},${CHART_H - CHART_PAD} Z`} fill="url(#grad)" opacity="0.15" />
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#6366f1" />
                      <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              {/if}
            </div>
          {/if}
        </Card>
      {:else if !loading}
        <Card variant="glass" padding="lg">
          <div class="empty-state">
            <div class="empty-icon">📈</div>
            <h3>Enter a symbol to analyze</h3>
            <p>Get AI-powered analysis of stocks, crypto, and market trends</p>
          </div>
        </Card>
      {/if}
    </div>

    <!-- Watchlist Sidebar -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h3>Watchlist</h3>
      </div>
      <div class="watchlist-items">
        {#each watchlist as entry}
          <div class="watchlist-item" role="button" tabindex="0" onclick={() => selectSymbol(entry.symbol)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSymbol(entry.symbol); } }}>
            <span class="wl-symbol">{entry.symbol}</span>
            <button class="wl-remove" onclick={(e) => { e.stopPropagation(); removeFromWatchlist(entry.symbol); }} title="Remove">✕</button>
          </div>
        {:else}
          <div class="wl-empty">No watched symbols</div>
        {/each}
      </div>
    </div>
  </div>
</PageTemplate>

<style>
  .layout { display: flex; gap: 1.5rem; }
  .main-col { flex: 1; min-width: 0; }
  .sidebar { width: 200px; flex-shrink: 0; }

  .sidebar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
  .sidebar-header h3 { font-size: 0.8rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
  .watchlist-items { display: flex; flex-direction: column; gap: 0.25rem; }
  .watchlist-item {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.4rem 0.6rem; border-radius: 6px; cursor: pointer;
    background: #14141e; border: 1px solid #1e1e2e; font-family: monospace; font-size: 0.85rem;
    transition: border-color 0.12s;
  }
  .watchlist-item:hover { border-color: #6366f1; }
  .wl-symbol { color: #e2e2e8; }
  .wl-remove { background: none; border: none; color: #555; cursor: pointer; font-size: 0.75rem; padding: 0.1rem 0.25rem; }
  .wl-remove:hover { color: #ef4444; }
  .wl-empty { color: #555; font-size: 0.8rem; text-align: center; padding: 1rem; }

  .search-bar { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .search-bar input {
    flex: 1; padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid #1e1e2e;
    background: #1a1a28; color: #e2e2e8; font-size: 0.9rem; outline: none; font-family: monospace;
  }
  .search-bar input:focus { border-color: #6366f1; }

  .quick-symbols { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 1.5rem; }
  .symbol-chip {
    padding: 0.25rem 0.6rem; border-radius: 4px; border: 1px solid #1e1e2e;
    background: #14141e; color: #888; font-size: 0.75rem; cursor: pointer; font-family: monospace;
  }
  .symbol-chip:hover { border-color: #6366f1; color: #e2e2e8; }
  .symbol-chip.active { border-color: #6366f1; background: #6366f122; color: #a78bfa; }

  .error-content { display: flex; align-items: center; gap: 0.5rem; color: #ef4444; font-size: 0.85rem; }
  .error-icon { font-size: 1rem; }

  .analysis-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
  .analysis-header h2 { font-size: 1.3rem; font-family: monospace; }
  .price { font-size: 1.5rem; font-weight: 700; color: #e2e2e8; }
  .change { font-size: 0.9rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 4px; }
  .change.positive { color: #22c55e; background: #22c55e22; }
  .change.negative { color: #ef4444; background: #ef444422; }

  .analysis-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #1e1e2e; }
  .analysis-section h3 { font-size: 0.85rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
  .analysis-section p { font-size: 0.9rem; line-height: 1.6; color: #e2e2e8; }

  .signals-list { display: flex; flex-direction: column; gap: 0.35rem; }
  .signal-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; border-radius: 6px; background: #1a1a28; font-size: 0.85rem; }
  .signal-bullish { border-left: 2px solid #22c55e; }
  .signal-bearish { border-left: 2px solid #ef4444; }
  .signal-icon { font-size: 1rem; }

  .tech-detail { background: #0f0f18; padding: 0.75rem; border-radius: 6px; font-size: 0.8rem; line-height: 1.5; overflow-x: auto; color: #888; font-family: monospace; white-space: pre-wrap; }

  .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
  .range-selector { display: flex; gap: 0.25rem; }
  .range-chip {
    padding: 0.15rem 0.4rem; border-radius: 4px; border: 1px solid #1e1e2e;
    background: #1a1a28; color: #666; font-size: 0.7rem; cursor: pointer; font-family: monospace;
  }
  .range-chip:hover { border-color: #6366f1; color: #e2e2e8; }
  .range-chip.active { border-color: #6366f1; background: #6366f122; color: #a78bfa; }
  .chart { width: 100%; height: auto; max-height: 200px; }
  .chart-loading { color: #666; font-size: 0.8rem; padding: 1rem; text-align: center; }

  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; color: #666; padding: 2rem; }
  .empty-icon { font-size: 3rem; opacity: 0.3; }
  .empty-state h3 { font-size: 1.1rem; color: #888; }
  .empty-state p { font-size: 0.85rem; }
</style>
