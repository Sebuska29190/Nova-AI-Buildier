/**
 * 1inch DEX Aggregator — Multi-chain swap for EVM
 * Supports: Ethereum, Base, Arbitrum, Polygon, BSC
 */

export interface OneInchQuote {
  dstAmount: string;
  srcToken: { symbol: string; address: string; decimals: number };
  dstToken: { symbol: string; address: string; decimals: number };
  protocols: any[];
}

export interface OneInchSwap {
  dstAmount: string;
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gas: number;
  };
}

export interface OneInchToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI: string;
}

class OneInchClient {
  private apiKey: string;
  private baseUrl = "https://api.1inch.dev/swap/v6.0";

  constructor() {
    this.apiKey = process.env.ONEINCH_API_KEY || "";
  }

  private headers(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Accept": "application/json",
    };
  }

  // ─── Quote ──────────────────────────────────────────────

  async getQuote(params: {
    chainId: number;
    src: string;
    dst: string;
    amount: string;
    includeGas?: boolean;
  }): Promise<OneInchQuote> {
    const url = new URL(`${this.baseUrl}/${params.chainId}/quote`);
    url.searchParams.set("src", params.src);
    url.searchParams.set("dst", params.dst);
    url.searchParams.set("amount", params.amount);
    if (params.includeGas) url.searchParams.set("includeGas", "true");

    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`1inch quote failed: ${res.status} — ${err}`);
    }

    return res.json();
  }

  // ─── Swap Transaction ───────────────────────────────────

  async getSwapTransaction(params: {
    chainId: number;
    src: string;
    dst: string;
    amount: string;
    from: string;
    slippage?: number;
    disableEstimate?: boolean;
  }): Promise<OneInchSwap> {
    const url = new URL(`${this.baseUrl}/${params.chainId}/swap`);
    url.searchParams.set("src", params.src);
    url.searchParams.set("dst", params.dst);
    url.searchParams.set("amount", params.amount);
    url.searchParams.set("from", params.from);
    url.searchParams.set("slippage", String(params.slippage || 1));
    url.searchParams.set("disableEstimate", "true");

    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`1inch swap failed: ${res.status} — ${err}`);
    }

    return res.json();
  }

  // ─── Token Allowance ────────────────────────────────────

  async getAllowance(params: {
    chainId: number;
    tokenAddress: string;
    walletAddress: string;
  }): Promise<string> {
    const url = new URL(`${this.baseUrl}/${params.chainId}/approve/allowance`);
    url.searchParams.set("tokenAddress", params.tokenAddress);
    url.searchParams.set("walletAddress", params.walletAddress);

    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return "0";
    const data = await res.json();
    return data.allowance || "0";
  }

  // ─── Approval Transaction ───────────────────────────────

  async buildApproval(params: {
    chainId: number;
    tokenAddress: string;
    amount?: string; // max if not specified
  }): Promise<{ data: string; gas: number }> {
    const url = new URL(`${this.baseUrl}/${params.chainId}/approve/transaction`);
    url.searchParams.set("tokenAddress", params.tokenAddress);
    if (params.amount) url.searchParams.set("amount", params.amount);

    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`1inch approval failed: ${res.status}`);
    return res.json();
  }

  // ─── Token List ─────────────────────────────────────────

  async getTokens(chainId: number): Promise<OneInchToken[]> {
    const url = new URL(`${this.baseUrl}/${chainId}/tokens`);

    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return Object.values(data.tokens || {}).slice(0, 50) as OneInchToken[];
  }

  // ─── Price ──────────────────────────────────────────────

  async getPrices(chainId: number, tokens: string[]): Promise<Record<string, string>> {
    const url = new URL(`${this.baseUrl}/${chainId}/prices`);
    url.searchParams.set("tokens", tokens.join(","));

    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return {};
    return res.json();
  }
}

export const oneInchClient = new OneInchClient();
