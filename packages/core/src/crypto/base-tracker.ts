/**
 * Base Ecosystem Tracker
 * Tracks top projects on Base L2: TVL, volume, transactions
 * Sources: DeFiLlama API, CoinGecko
 */

import { safeMessage } from "../errors.ts";

interface BaseProject {
  name: string;
  slug: string;
  tvl: number;
  tvlChange24h: number;
  volume24h: number;
  category: string;
  url?: string;
  chain: string;
}

interface BaseEcosystemStatus {
  totalTvl: number;
  totalVolume24h: number;
  projectCount: number;
  topProjects: BaseProject[];
  timestamp: number;
}

export async function fetchBaseEcosystem(): Promise<BaseEcosystemStatus> {
  try {
    // Fetch top projects on Base from DeFiLlama
    const res = await fetch("https://api.llama.fi/protocols");
    if (!res.ok) throw new Error(`DeFiLlama responded ${res.status}`);
    const protocols: any[] = await res.json();

    // Filter Base chain
    const baseProtocols = protocols.filter((p: any) =>
      p.chains?.includes("Base") || p.chain === "Base"
    );

    const projects: BaseProject[] = baseProtocols
      .sort((a: any, b: any) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 30)
      .map((p: any) => ({
        name: p.name,
        slug: p.slug,
        tvl: p.tvl || 0,
        tvlChange24h: p.change_1d || 0,
        volume24h: p.volume24h || 0,
        category: p.category || "DeFi",
        url: p.url || p.website,
        chain: "Base",
      }));

    const totalTvl = projects.reduce((sum, p) => sum + p.tvl, 0);
    const totalVolume24h = projects.reduce((sum, p) => sum + p.volume24h, 0);

    return {
      totalTvl,
      totalVolume24h,
      projectCount: projects.length,
      topProjects: projects,
      timestamp: Date.now(),
    };
  } catch (e) {
    console.error("  ⚠ Base tracker error:", safeMessage(e));
    return {
      totalTvl: 0,
      totalVolume24h: 0,
      projectCount: 0,
      topProjects: [],
      timestamp: Date.now(),
    };
  }
}

export async function fetchBaseOnchainStats(): Promise<{
  dailyTx: number;
  dailyActiveAddresses: number;
  totalBridged: number;
}> {
  try {
    // Try Base block explorer API
    const res = await fetch("https://api.basescan.org/api?module=stats&action=tokentx", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { dailyTx: 0, dailyActiveAddresses: 0, totalBridged: 0 };

    const data = await res.json();
    return {
      dailyTx: data?.result?.length || 0,
      dailyActiveAddresses: 0,
      totalBridged: 0,
    };
  } catch {
    return { dailyTx: 0, dailyActiveAddresses: 0, totalBridged: 0 };
  }
}
