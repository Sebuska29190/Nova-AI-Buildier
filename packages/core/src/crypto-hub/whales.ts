// Whale tracking — large transactions via free block explorers + on-chain metrics
import type { WhaleAlert, OnChainMetrics } from "./types.ts";

// Free APIs (no key needed for basic, but limited)
// Etherscan: 5 req/s with free API key
// BscScan: similar
// Whale Alert free API: 10 req/min

const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || "";
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api?chainid=1";
const BSCSCAN_KEY = process.env.BSCSCAN_API_KEY || "";

// ─── Known exchange/label addresses ───────────────────────────────────────────
const KNOWN_ADDRESSES: Record<string, string> = {
  "0x28c6c06298d514db089934071355e5743bf21d60": "Binance Hot Wallet",
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": "Coinbase 1",
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Binance Cold",
  "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8": "Binance 7",
  "0xf977814e90da44bfa03b6295a0616a897441acec": "Binance 8",
  "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be": "Binance 9",
  "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503": "Binance 10",
  "0x6262998ced04146fa42253a5c0af90ca02dfd2a3": "Crypto.com 1",
  "0x46340b20830761efd32832a74d7169b29feb9758": "Crypto.com 2",
  "0xaedf38675fc99e1fa6bad06021fd10797f9fd91c": "OKX",
  "0x5f397b62502e255f68382791947d54c4b2d37f09": "KuCoin 1",
  "0x2b5634c42055806a59e910ded324d8076a72a8db": "KuCoin 2",
  "0x0681d8db095565fe8a346fa0277bffde9c0edbbf": "Bybit 1",
  "0x73ea1a7f3e4caf62ec371d8a4aba0a1e6766abcf": "Bybit 2",
  "0xf89d7b9c864f589bbf53a82105107622b35eaa40": "Bybit Cold",
  "0x176f3dab24a159341c0509bb36b833e7fdd0a132": "Uniswap V2 Router",
  "0x68b3465833fb72a70bcdd9c2a4bca8e82d3e3445": "Uniswap V3 Router",
};

function labelAddress(addr: string): string {
  return KNOWN_ADDRESSES[addr.toLowerCase()] || (addr.slice(0, 6) + "..." + addr.slice(-4));
}

// ─── Fetch large transactions from Etherscan ──────────────────────────────────

export async function getLargeTransactions(
  minValueUsd = 1_000_000,
): Promise<WhaleAlert[]> {
  if (!ETHERSCAN_KEY) return [];

  try {
    // Get latest block
    const blockRes = await fetch(
      `${ETHERSCAN_BASE}&module=proxy&action=eth_blockNumber&apikey=${ETHERSCAN_KEY}`,
      { signal: AbortSignal.timeout(10000) },
    );
    const blockData: any = await blockRes.json();
    const blockNum = parseInt(blockData?.result ?? "0", 16);

    if (!blockNum) return [];

    const alerts: WhaleAlert[] = [];
    const ethPrice = await getEthPrice();

    // Look back last 100 blocks to find large transfers
    const blocksToCheck = 100;
    let checked = 0;

    for (let blk = blockNum; blk > blockNum - blocksToCheck && alerts.length < 15 && checked < 10; blk--) {
      const hex = "0x" + blk.toString(16);
      const txRes = await fetch(
        `${ETHERSCAN_BASE}&module=proxy&action=eth_getBlockByNumber&tag=${hex}&boolean=true&apikey=${ETHERSCAN_KEY}`,
        { signal: AbortSignal.timeout(10000) },
      );
      const txData: any = await txRes.json();
      const block = txData?.result;
      const txs = block?.transactions ?? [];

      checked++;

      if (txs.length === 0) continue;

      const blockTimestamp = parseInt(block.timestamp ?? "0", 16) * 1000;

      for (const tx of txs) {
        const valueEth = parseInt(tx.value ?? "0", 16) / 1e18;
        const valueUsd = valueEth * ethPrice;
        if (valueUsd < minValueUsd) continue;

        const fromLabel = labelAddress(tx.from);
        const toLabel = labelAddress(tx.to || "0x");

        let type: WhaleAlert["type"] = "transfer";
        if (KNOWN_ADDRESSES[tx.to?.toLowerCase()]) type = "deposit";
        else if (KNOWN_ADDRESSES[tx.from?.toLowerCase()]) type = "withdraw";

        alerts.push({
          symbol: "ETH",
          amount: Math.round(valueEth * 10000) / 10000,
          valueUsd: Math.round(valueUsd),
          from: tx.from,
          to: tx.to || "",
          fromLabel,
          toLabel,
          transactionHash: tx.hash,
          timestamp: new Date(blockTimestamp || Date.now()).toISOString(),
          type,
        });
      }

      if (txs.length > 0) await sleep(200); // rate limit
    }

    return alerts.sort((a, b) => b.valueUsd - a.valueUsd).slice(0, 15);
  } catch (e: any) {
    console.warn(`[whales] etherscan failed:`, e.message || e);
    return [];
  }
}

// ─── Whale Alert free API ─────────────────────────────────────────────────────

export async function getWhaleAlerts(minValueUsd = 500_000): Promise<WhaleAlert[]> {
  try {
    const res = await fetch(
      `https://api.whale-alert.io/v1/transactions?api_key=${process.env.WHALE_ALERT_KEY || "free"}&min_value=${minValueUsd}&limit=20`,
      { signal: AbortSignal.timeout(10000) },
    );
    const data: any = await res.json();
    if (!data.transactions) return [];

    return data.transactions.map((tx: any) => ({
      symbol: tx.symbol || "UNKNOWN",
      amount: tx.amount ?? 0,
      valueUsd: tx.amount_usd ?? 0,
      from: tx.from?.address ?? "",
      to: tx.to?.address ?? "",
      fromLabel: tx.from?.owner ?? labelAddress(tx.from?.address),
      toLabel: tx.to?.owner ?? labelAddress(tx.to?.address),
      transactionHash: tx.hash ?? "",
      timestamp: new Date(tx.timestamp * 1000).toISOString(),
      type: tx.to?.owner_type === "exchange" ? "deposit" : tx.from?.owner_type === "exchange" ? "withdraw" : "transfer",
    }));
  } catch {
    return [];
  }
}

// ─── On-chain metrics ─────────────────────────────────────────────────────────

export async function getOnChainMetrics(symbol: string): Promise<OnChainMetrics | null> {
  // Bitcoin: use blockchain.com free API
  if (symbol.toUpperCase() === "BTC") {
    try {
      const [stats, txCount] = await Promise.all([
        fetch("https://api.blockchain.info/stats", { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
        fetch("https://api.blockchain.info/q/24hrtransactioncount", { signal: AbortSignal.timeout(5000) }).then(r => r.text()),
      ]);
      const btcPrice = await getBtcPrice();
      return {
        symbol: "BTC",
        activeAddresses24h: stats.n_unique_addresses ?? 0,
        transactionCount24h: parseInt(txCount) || 0,
        largeTransactions24h: stats.n_transactions_excluding_popular ?? 0,
        exchangeInflow24h: 0,
        exchangeOutflow24h: 0,
        netExchangeFlow24h: 0,
        supplyOnExchanges: stats.totalbc ?? 0,
        supplyPercentOnExchanges: 0,
      };
    } catch { return null; }
  }

  // ETH: Etherscan
  if (symbol.toUpperCase() === "ETH" && ETHERSCAN_KEY) {
    try {
      const [supplyRes, gasRes] = await Promise.all([
        fetch(`${ETHERSCAN_BASE}&module=stats&action=ethsupply&apikey=${ETHERSCAN_KEY}`),
        fetch(`${ETHERSCAN_BASE}&module=stats&action=ethprice&apikey=${ETHERSCAN_KEY}`),
      ]);
      return {
        symbol: "ETH",
        activeAddresses24h: 0,
        transactionCount24h: 0,
        largeTransactions24h: 0,
        exchangeInflow24h: 0,
        exchangeOutflow24h: 0,
        netExchangeFlow24h: 0,
        supplyOnExchanges: 0,
        supplyPercentOnExchanges: 0,
      };
    } catch { return null; }
  }

  return null;
}

// ─── Price helpers ────────────────────────────────────────────────────────────

async function getEthPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) },
    );
    const data: any = await res.json();
    return data.ethereum?.usd ?? 3000;
  } catch { return 3000; }
}

async function getBtcPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) },
    );
    const data: any = await res.json();
    return data.bitcoin?.usd ?? 60000;
  } catch { return 60000; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
