/**
 * Jupiter Aggregator Client — Solana DEX
 * REST API: quote, swap, execute, price
 */

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number; // in smallest unit (lamports)
  slippageBps?: number; // default 50 (0.5%)
  onlyDirectRoutes?: boolean;
}

export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
}

export interface SwapParams {
  quoteResponse: QuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  dynamicComputeUnitLimit?: boolean;
  prioritizationFeeLamports?: number;
}

export interface SwapResponse {
  swapTransaction: string; // base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export interface TokenPrice {
  id: string;
  type: string;
  price: string;
  content?: {
    signature?: string;
  };
  extraInfo?: {
    quotedPrice?: { buy: number; sell: number };
    confidenceLevel?: string;
    lastUpdated?: string;
  };
}

class JupiterClient {
  private apiKey: string;
  private baseUrl = "https://api.jup.ag";

  constructor() {
    this.apiKey = process.env.JUPITER_API_KEY || "";
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Accept": "application/json" };
    if (this.apiKey) h["x-api-key"] = this.apiKey;
    return h;
  }

  // ─── Quote ──────────────────────────────────────────────

  async getQuote(params: QuoteParams): Promise<QuoteResponse> {
    const url = new URL(`${this.baseUrl}/swap/v1/quote`);
    url.searchParams.set("inputMint", params.inputMint);
    url.searchParams.set("outputMint", params.outputMint);
    url.searchParams.set("amount", String(params.amount));
    url.searchParams.set("slippageBps", String(params.slippageBps || 50));
    if (params.onlyDirectRoutes) url.searchParams.set("onlyDirectRoutes", "true");

    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Jupiter quote failed: ${res.status} — ${err}`);
    }

    return res.json();
  }

  // ─── Swap Transaction ───────────────────────────────────

  async getSwapTransaction(params: SwapParams): Promise<SwapResponse> {
    const res = await fetch(`${this.baseUrl}/swap/v1/swap`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: params.quoteResponse,
        userPublicKey: params.userPublicKey,
        wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
        dynamicComputeUnitLimit: params.dynamicComputeUnitLimit ?? true,
        prioritizationFeeLamports: params.prioritizationFeeLamports ?? 10000,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Jupiter swap failed: ${res.status} — ${err}`);
    }

    return res.json();
  }

  // ─── Price ──────────────────────────────────────────────

  async getPrice(ids: string[]): Promise<Record<string, TokenPrice>> {
    const url = new URL(`${this.baseUrl}/price/v2`);
    url.searchParams.set("ids", ids.join(","));

    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Jupiter price failed: ${res.status}`);
    const data = await res.json();
    return data.data || {};
  }

  async getSimplePrice(ids: string[]): Promise<Record<string, number>> {
    const prices = await this.getPrice(ids);
    const result: Record<string, number> = {};
    for (const [id, data] of Object.entries(prices)) {
      result[id] = parseFloat(data.price) || 0;
    }
    return result;
  }

  // ─── Token List ─────────────────────────────────────────

  async searchTokens(query: string): Promise<any[]> {
    const url = new URL("https://tokens.jup.ag/tokens");
    url.searchParams.set("tags", "verified");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const tokens = await res.json();
    const q = query.toLowerCase();
    return (tokens || []).filter((t: any) =>
      t.symbol?.toLowerCase().includes(q) || t.name?.toLowerCase().includes(q)
    ).slice(0, 20);
  }
}

export const jupiterClient = new JupiterClient();
