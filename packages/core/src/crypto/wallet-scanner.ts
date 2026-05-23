/**
 * Multi-Wallet Balance & Reputation Scanner (BaseCred)
 * Checks EVM wallet balances across chains + computes reputation score
 */

import { safeMessage } from "../errors.ts";

interface WalletBalance {
  chain: string;
  token: string;
  symbol: string;
  balance: number;
  usdValue: number;
}

interface WalletResult {
  address: string;
  balances: WalletBalance[];
  totalUsd: number;
  reputation: {
    score: number; // 0-100
    txCount: number;
    age: number; // days since first tx
    volume: number;
    label: string; // "Whale" | "Active" | "Casual" | "New"
  };
  error?: string;
}

const CHAINS: { name: string; nativeToken: string; explorer: string; coinGeckoId: string }[] = [
  { name: "Ethereum", nativeToken: "ETH", explorer: "https://api.etherscan.io/api", coinGeckoId: "ethereum" },
  { name: "Base", nativeToken: "ETH", explorer: "https://api.basescan.org/api", coinGeckoId: "ethereum" },
  { name: "Arbitrum", nativeToken: "ETH", explorer: "https://api.arbiscan.io/api", coinGeckoId: "ethereum" },
  { name: "Polygon", nativeToken: "MATIC", explorer: "https://api.polygonscan.com/api", coinGeckoId: "matic-network" },
];

// Cache prices for 5 min
let priceCache: Record<string, { price: number; ts: number }> = {};

async function getTokenPrice(coinGeckoId: string): Promise<number> {
  const cached = priceCache[coinGeckoId];
  if (cached && Date.now() - cached.ts < 300000) return cached.price;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const price = data[coinGeckoId]?.usd || 0;
    priceCache[coinGeckoId] = { price, ts: Date.now() };
    return price;
  } catch {
    return 0;
  }
}

async function fetchBalanceFromExplorer(address: string, chain: typeof CHAINS[0]): Promise<WalletBalance[]> {
  try {
    // Fetch native balance
    const ethPrice = await getTokenPrice(chain.coinGeckoId);
    const res = await fetch(
      `${chain.explorer}?module=account&action=balance&address=${address}&tag=latest`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const weiBalance = BigInt(data?.result || "0");
    const ethBalance = Number(weiBalance) / 1e18;

    return [{
      chain: chain.name,
      token: chain.nativeToken,
      symbol: chain.nativeToken,
      balance: ethBalance,
      usdValue: ethBalance * ethPrice,
    }];
  } catch {
    return [];
  }
}

async function computeReputation(address: string): Promise<WalletResult["reputation"]> {
  try {
    // Fetch tx count from Etherscan
    const res = await fetch(
      `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&offset=1&limit=1`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return { score: 0, txCount: 0, age: 0, volume: 0, label: "New" };

    const data = await res.json();
    const txCount = parseInt(data?.result?.[0]?.nonce || "0");
    const firstTxTs = data?.result?.[0]?.timeStamp
      ? parseInt(data.result[0].timeStamp) * 1000
      : Date.now();
    const age = Math.floor((Date.now() - firstTxTs) / 86400000);

    // Score calculation
    let score = 0;
    if (txCount > 1000) score = 90;
    else if (txCount > 500) score = 80;
    else if (txCount > 100) score = 65;
    else if (txCount > 20) score = 45;
    else if (txCount > 5) score = 25;
    else score = 10;

    if (age > 365) score = Math.min(100, score + 10);
    else if (age > 90) score = Math.min(100, score + 5);

    let label = "New";
    if (score >= 80) label = "Whale";
    else if (score >= 50) label = "Active";
    else if (score >= 20) label = "Casual";

    return {
      score,
      txCount,
      age,
      volume: 0,
      label,
    };
  } catch {
    return { score: 0, txCount: 0, age: 0, volume: 0, label: "New" };
  }
}

export async function scanWallets(addresses: string[]): Promise<WalletResult[]> {
  const results: WalletResult[] = [];

  for (const address of addresses) {
    try {
      const addr = address.trim();
      if (!addr.startsWith("0x") || addr.length !== 42) {
        results.push({ address: addr, balances: [], totalUsd: 0, reputation: { score: 0, txCount: 0, age: 0, volume: 0, label: "Invalid" }, error: "Invalid address" });
        continue;
      }

      // Fetch balances from all chains
      const allBalances: WalletBalance[] = [];
      for (const chain of CHAINS) {
        const balances = await fetchBalanceFromExplorer(addr, chain);
        allBalances.push(...balances);
      }

      const totalUsd = allBalances.reduce((s, b) => s + b.usdValue, 0);
      const reputation = await computeReputation(addr);

      results.push({ address: addr, balances: allBalances, totalUsd, reputation });
    } catch (e) {
      results.push({ address, balances: [], totalUsd: 0, reputation: { score: 0, txCount: 0, age: 0, volume: 0, label: "Error" }, error: safeMessage(e) });
    }
  }

  return results;
}
