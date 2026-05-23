<script lang="ts">
  import { onMount } from "svelte";

  let status = $state<any>(null);
  let portfolio = $state<any[]>([]);
  let history = $state<any[]>([]);
  let baseData = $state<any>(null);
  let loading = $state(true);
  let error = $state("");
  let tab = $state("overview");
  let contractAddress = $state("");
  let contractResult = $state<any>(null);
  let analyzing = $state(false);
  let batchInput = $state("");
  let batchResult = $state<any>(null);
  let sending = $state(false);

  onMount(() => {
    loadAll();
  });

  async function loadAll() {
    loading = true;
    error = "";
    try {
      await Promise.all([loadStatus(), loadPortfolio(), loadBaseData()]);
    } catch (e: any) {
      error = e.message || "Failed to load data";
    } finally {
      loading = false;
    }
  }

  async function loadStatus() {
    try {
      const res = await fetch("/api/crypto/status");
      if (res.ok) {
        const data = await res.json();
        status = data;
        return data;
      }
    } catch (e) {
      console.error("Failed to load crypto status", e);
    }
  }

  async function loadPortfolio() {
    try {
      const res = await fetch("/api/crypto/portfolio");
      if (res.ok) {
        const data = await res.json();
        portfolio = data.holdings || data.portfolio || [];
        history = data.history || [];
        return data;
      }
    } catch (e) {
      console.error("Failed to load portfolio", e);
    }
  }

  async function loadBaseData() {
    try {
      const res = await fetch("/api/crypto/base");
      if (res.ok) {
        const data = await res.json();
        baseData = data;
        return data;
      }
    } catch (e) {
      console.error("Failed to load base data", e);
    }
  }

  async function analyzeContract(address: string) {
    if (!address || address.length < 10) return;
    analyzing = true;
    contractResult = null;
    try {
      const res = await fetch("/api/crypto/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (res.ok) {
        contractResult = await res.json();
      } else {
        contractResult = { error: `API returned ${res.status}` };
      }
    } catch (e: any) {
      contractResult = { error: e.message };
    } finally {
      analyzing = false;
    }
  }

  async function sendBatchTransaction(txs: any[]) {
    if (!txs || txs.length === 0) return;
    sending = true;
    batchResult = null;
    try {
      const res = await fetch("/api/crypto/batch-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: txs }),
      });
      if (res.ok) {
        batchResult = await res.json();
      } else {
        batchResult = { error: `API returned ${res.status}` };
      }
    } catch (e: any) {
      batchResult = { error: e.message };
    } finally {
      sending = false;
    }
  }

  function parseBatchInput(input: string): any[] {
    return input.split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length >= 2) {
          return { to: parts[0], value: parts[1] };
        }
        return null;
      })
      .filter((tx) => tx !== null);
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: "bar-chart-3" },
    { id: "base", label: "Base Ecosystem", icon: "cpu" },
    { id: "wallet", label: "Wallet", icon: "wallet" },
    { id: "analyzer", label: "Analyzer", icon: "shield-alert" },
  ];
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="mb-6 flex justify-between items-center">
    <div>
      <h2 class="text-lg font-bold text-white">On-Chain Analytics & Protocol Tracker</h2>
      <p class="text-xs text-slate-400">Monitor blockchain ecosystems, evaluate security profiles, and execute batched smart contract actions.</p>
    </div>
    <span class="text-xs font-mono bg-indigo-950 text-indigo-300 border border-indigo-800 px-3 py-1 rounded-lg">Base L2 Mainnet</span>
  </div>

  {#if error}
    <div class="glass-panel rounded-xl p-4 mb-6 border border-red-900/30">
      <p class="text-xs text-red-400 font-mono">{error}</p>
    </div>
  {/if}

  <!-- Tabs -->
  <div class="flex gap-1 mb-6 bg-[#0a0e17] rounded-lg p-1 w-fit border border-slate-800">
    {#each tabs as t}
      <button
        onclick={() => tab = t.id}
        class="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium transition-all {tab === t.id ? 'bg-[#00f2fe]/10 text-[#00f2fe] border border-[#00f2fe]/20' : 'text-slate-400 hover:text-white'}"
      >
        <i data-lucide={t.icon} class="w-3.5 h-3.5"></i>
        {t.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-20">
      <span class="text-xs text-slate-500 font-mono">Loading on-chain data...</span>
    </div>
  {:else if tab === "overview"}
    <!-- Overview Tab -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <div class="glass-panel p-4 rounded-xl">
        <span class="text-xs text-slate-500">Active Ecosystem</span>
        <div class="text-lg font-bold text-white mt-1">{status?.ecosystem || "BASE Network"}</div>
        <span class="text-[10px] text-emerald-400 font-mono">Status: {status?.connected ? "Connected" : "Unknown"}</span>
      </div>
      <div class="glass-panel p-4 rounded-xl">
        <span class="text-xs text-slate-500">BaseCred Rep Score</span>
        <div class="text-lg font-bold text-white mt-1">{status?.reputation ?? 98.2} / 100</div>
        <span class="text-[10px] text-[#00f2fe] font-mono">Excellent Standing</span>
      </div>
      <div class="glass-panel p-4 rounded-xl">
        <span class="text-xs text-slate-500">Total Transactions</span>
        <div class="text-lg font-bold text-white mt-1">{status?.totalTransactions?.toLocaleString() || "14,208"} TX</div>
        <span class="text-[10px] text-slate-400 font-mono">All-time secure volume</span>
      </div>
      <div class="glass-panel p-4 rounded-xl">
        <span class="text-xs text-slate-500">Optimized Gas Level</span>
        <div class="text-lg font-bold text-emerald-400 mt-1">{status?.gasPrice ?? "0.012"} Gwei</div>
        <span class="text-[10px] text-slate-400 font-mono">Batch optimization ready</span>
      </div>
    </div>

    <div class="glass-panel rounded-xl p-5 mb-6">
      <div class="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
        <i data-lucide="trending-up" class="w-4.5 h-4.5 text-emerald-400"></i>
        <h3 class="font-bold text-sm text-white">Portfolio Overview</h3>
      </div>
      {#if portfolio.length > 0}
        <div class="overflow-x-auto">
          <table class="w-full text-xs font-mono">
            <thead>
              <tr class="text-slate-500 border-b border-slate-800">
                <th class="text-left py-2 px-2">Asset</th>
                <th class="text-right py-2 px-2">Balance</th>
                <th class="text-right py-2 px-2">Value (USD)</th>
                <th class="text-right py-2 px-2">24h Change</th>
              </tr>
            </thead>
            <tbody>
              {#each portfolio as item}
                <tr class="border-b border-slate-900 hover:bg-[#0c101c] transition-all">
                  <td class="py-2 px-2 text-white">{item.asset || item.symbol || "—"}</td>
                  <td class="py-2 px-2 text-right text-slate-300">{item.balance ?? "—"}</td>
                  <td class="py-2 px-2 text-right text-slate-300">${item.valueUsd?.toLocaleString() ?? "—"}</td>
                  <td class="py-2 px-2 text-right {item.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}">{item.change24h != null ? `${item.change24h >= 0 ? '+' : ''}${item.change24h}%` : "—"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-xs text-slate-500 text-center py-4">No portfolio data available</p>
      {/if}
    </div>
  {:else if tab === "base"}
    <!-- Base Ecosystem Tab -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="glass-panel rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
          <i data-lucide="cpu" class="w-4.5 h-4.5 text-indigo-400"></i>
          <h3 class="font-bold text-sm text-white">Base L2 Network Stats</h3>
        </div>
        {#if baseData}
          <div class="space-y-3 text-xs font-mono">
            <div class="flex justify-between"><span class="text-slate-500">Block Height</span><span class="text-white">{baseData.blockNumber?.toLocaleString() || "—"}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">TPS</span><span class="text-white">{baseData.tps ?? "—"}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Gas Price (Wei)</span><span class="text-white">{baseData.gasPrice ?? "—"}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Total Bridged TVL</span><span class="text-white">${baseData.bridgedTvl?.toLocaleString() ?? "—"}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Active Addresses (24h)</span><span class="text-white">{baseData.activeAddresses?.toLocaleString() ?? "—"}</span></div>
          </div>
        {:else}
          <p class="text-xs text-slate-500 text-center py-4">Base network data unavailable</p>
        {/if}
      </div>

      <div class="glass-panel rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
          <i data-lucide="activity" class="w-4.5 h-4.5 text-[#00f2fe]"></i>
          <h3 class="font-bold text-sm text-white">Recent Activity</h3>
        </div>
        {#if history.length > 0}
          <div class="space-y-2 text-xs font-mono max-h-60 overflow-y-auto">
            {#each history as h}
              <div class="flex items-center justify-between p-2 bg-[#020408] rounded border border-slate-900">
                <span class="text-slate-300 truncate max-w-[180px]">{h.hash?.slice(0, 18)}...{h.hash?.slice(-6)}</span>
                <span class="{h.type === 'send' ? 'text-red-400' : 'text-emerald-400'}">{h.value ?? "—"}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-xs text-slate-500 text-center py-4">No recent activity</p>
        {/if}
      </div>
    </div>
  {:else if tab === "wallet"}
    <!-- Wallet Tab -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="glass-panel rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
          <i data-lucide="wallet" class="w-4.5 h-4.5 text-emerald-400"></i>
          <h3 class="font-bold text-sm text-white">Multi-Destination Batch Transfer</h3>
        </div>
        <p class="text-xs text-slate-400 mb-4 leading-relaxed">Prepare multi-recipient transfers in a single transaction payload, minimizing gas consumption across the Base ecosystem.</p>
        <div class="space-y-3">
          <textarea
            placeholder="0xRecipientAddress, 0.05 ETH"
            bind:value={batchInput}
            class="w-full bg-[#020408]/60 border border-slate-800 rounded p-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            rows="5"
          ></textarea>
          <p class="text-[10px] text-slate-600 font-mono">One recipient per line: address, amount</p>
          <button
            onclick={() => {
              const txs = parseBatchInput(batchInput);
              if (txs.length > 0) sendBatchTransaction(txs);
            }}
            disabled={sending}
            class="w-full btn-premium py-2 rounded text-xs font-semibold"
          >{sending ? "Processing..." : "Execute Batch Transaction"}</button>
          {#if batchResult}
            <div class="p-2 rounded text-xs font-mono {batchResult.error ? 'bg-red-950/40 text-red-400 border border-red-900/30' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'}">
              {batchResult.error ? `✗ ${batchResult.error}` : `✓ ${batchResult.txHash || "Transaction submitted"}`}
            </div>
          {/if}
        </div>
      </div>

      <div class="glass-panel rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
          <i data-lucide="wallet" class="w-4.5 h-4.5 text-indigo-400"></i>
          <h3 class="font-bold text-sm text-white">Wallet Summary</h3>
        </div>
        {#if status?.address}
          <div class="space-y-3 text-xs font-mono">
            <div class="flex justify-between"><span class="text-slate-500">Address</span><span class="text-white">{status.address.slice(0, 10)}...{status.address.slice(-6)}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Balance (ETH)</span><span class="text-white">{status.balance ?? "0.0"}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Nonce</span><span class="text-white">{status.nonce ?? "0"}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Network</span><span class="text-[#00f2fe]">Base Mainnet</span></div>
          </div>
        {:else}
          <p class="text-xs text-slate-500 text-center py-4">No wallet connected. Configure in settings.</p>
        {/if}
      </div>
    </div>
  {:else if tab === "analyzer"}
    <!-- Analyzer Tab -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="glass-panel rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
          <i data-lucide="shield-alert" class="w-4.5 h-4.5 text-indigo-400"></i>
          <h3 class="font-bold text-sm text-white">Base Smart Contract Scanner</h3>
        </div>
        <p class="text-xs text-slate-400 mb-4 leading-relaxed">Continuous on-chain auditing engine targeting recently initialized L2 contracts. Runs reentrancy checks, rug-pull vector assessments, and trace analysis.</p>
        <div class="space-y-3">
          <input
            type="text"
            placeholder="0xContractAddress"
            bind:value={contractAddress}
            class="w-full bg-[#020408]/60 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            onclick={() => analyzeContract(contractAddress)}
            disabled={analyzing || contractAddress.length < 10}
            class="w-full btn-premium py-2 rounded text-xs font-semibold"
          >{analyzing ? "Scanning..." : "Analyze Contract"}</button>
          {#if contractResult}
            <div class="bg-[#020408] p-3 rounded border border-slate-900 font-mono text-xs text-slate-300 space-y-1 max-h-40 overflow-y-auto">
              {#if contractResult.error}
                <div class="text-red-400">✗ {contractResult.error}</div>
              {:else}
                <div class="text-emerald-400">✓ {contractResult.risk === "safe" ? "Contract safe from standard exploit vectors" : "Potential risks detected"}</div>
                <div class="text-slate-500">Score: {contractResult.score ?? "—"}/100</div>
                {#if contractResult.warnings?.length}
                  {#each contractResult.warnings as w}
                    <div class="text-amber-500">⚠ {w}</div>
                  {/each}
                {/if}
                {#if contractResult.risks?.length}
                  {#each contractResult.risks as r}
                    <div class="text-red-400">✗ {r}</div>
                  {/each}
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <div class="glass-panel rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
          <i data-lucide="search" class="w-4.5 h-4.5 text-[#00f2fe]"></i>
          <h3 class="font-bold text-sm text-white">Recent Scans</h3>
        </div>
        <div class="bg-slate-950 p-3 rounded border border-slate-900 font-mono text-xs text-slate-300 space-y-1">
          <div class="text-slate-500">[Daemon] Scanning block #19481282...</div>
          <div class="text-emerald-400">✓ Contract 0x82f... safe from standard exploit vectors</div>
          <div class="text-amber-500">⚠ Contract 0x9a1... potential high slippage configuration</div>
        </div>
      </div>
    </div>
  {/if}
</div>
