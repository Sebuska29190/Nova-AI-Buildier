/**
 * Relay Protocol Bridge Client — Cross-chain bridging
 * Ported from BatchBridge (github.com/Sebuska29190/batchbridge)
 * Uses correct Relay API field names
 */

export interface BridgeQuote {
  id: string;
  provider: string;
  details: {
    totalOutputAmount: string;
    outputAmount: string;
    originCurrency: { decimals: number; symbol: string; address: string; chainId: number };
    destinationCurrency: { decimals: number; symbol: string; address: string; chainId: number };
    originAmount: string;
  };
  steps: any[];
}

class RelayBridge {
  private baseUrl = "https://api.relay.link";
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.RELAY_API_KEY || "";
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Accept": "application/json" };
    if (this.apiKey) h["Authorization"] = `Bearer ${this.apiKey}`;
    return h;
  }

  // ─── Get cross-chain quote ──────────────────────────────

  async getQuote(params: {
    originChainId: number;
    destinationChainId: number;
    originCurrency: string;
    destinationCurrency: string;
    amount: string;
    user: string;
    recipient?: string;
  }): Promise<any> {
    const res = await fetch(`${this.baseUrl}/quote`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        originChainId: params.originChainId,
        destinationChainId: params.destinationChainId,
        originCurrency: params.originCurrency,
        destinationCurrency: params.destinationCurrency,
        amount: params.amount,
        user: params.user,
        recipient: params.recipient || params.user,
        tradeType: "EXACT_INPUT",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Relay quote failed: ${res.status} — ${err}`);
    }

    return res.json();
  }

  // ─── Get available routes ───────────────────────────────

  async getRoutes(params: {
    originChainId: number;
    destinationChainId: number;
    token: string;
    amount: string;
  }): Promise<any[]> {
    const url = new URL(`${this.baseUrl}/routes`);
    url.searchParams.set("originChainId", String(params.originChainId));
    url.searchParams.set("destinationChainId", String(params.destinationChainId));
    url.searchParams.set("token", params.token);
    url.searchParams.set("amount", params.amount);

    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];
    return res.json();
  }

  // ─── Get supported chains ───────────────────────────────

  async getSupportedChains(): Promise<number[]> {
    try {
      const res = await fetch(`${this.baseUrl}/chains`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [1, 8453, 42161, 137, 56];
      const data = await res.json();
      return data.chains?.map((c: any) => c.id) || [1, 8453, 42161, 137, 56];
    } catch {
      return [1, 8453, 42161, 137, 56];
    }
  }

  // ─── Get supported tokens per chain ─────────────────────

  async getSupportedTokens(chainId: number): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/tokens/${chainId}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  }
}

export const relayBridge = new RelayBridge();
