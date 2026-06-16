/**
 * Polymarket CLOB API Client
 * REST API for prediction markets — read + trade
 */

export interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  conditionId: string;
  slug: string;
  active: boolean;
  closed: boolean;
  endDate: string;
  outcomes: string[];
  outcomePrices: string; // JSON array of prices [yes_price, no_price]
  volume: string;
  liquidity: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  image?: string;
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  markets: PolymarketMarket[];
  startDate: string;
  endDate: string;
  category?: string;
  image?: string;
}

export interface OrderBook {
  market: string;
  asset_id: string;
  hash: string;
  timestamp: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface OrderBookEntry {
  price: string;
  size: string;
}

export interface PolymarketOrder {
  id: string;
  market: string;
  asset_id: string;
  side: "BUY" | "SELL";
  price: string;
  size: string;
  status: string;
  created_at: string;
}

export interface PolymarketPosition {
  id: string;
  market: string;
  asset_id: string;
  outcome: string;
  size: string;
  avg_price: string;
  pnl: string;
}

class PolymarketClient {
  private clobUrl = "https://clob.polymarket.com";
  private gammaUrl = "https://gamma-api.polymarket.com";

  // ─── Read-only (no auth) ──────────────────────────────

  async getMarkets(params?: {
    limit?: number;
    offset?: number;
    active?: boolean;
    closed?: boolean;
    order?: string;
  }): Promise<PolymarketMarket[]> {
    const url = new URL(`${this.clobUrl}/markets`);
    if (params?.limit) url.searchParams.set("limit", String(params.limit));
    if (params?.offset) url.searchParams.set("offset", String(params.offset));
    if (params?.active !== undefined) url.searchParams.set("active", String(params.active));
    if (params?.closed !== undefined) url.searchParams.set("closed", String(params.closed));
    if (params?.order) url.searchParams.set("order", params.order);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Polymarket markets failed: ${res.status}`);
    return res.json();
  }

  async getMarket(conditionId: string): Promise<PolymarketMarket> {
    const res = await fetch(`${this.clobUrl}/markets/${conditionId}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Polymarket market failed: ${res.status}`);
    return res.json();
  }

  async getEvents(params?: { limit?: number; offset?: number }): Promise<PolymarketEvent[]> {
    const url = new URL(`${this.clobUrl}/events`);
    if (params?.limit) url.searchParams.set("limit", String(params.limit));
    if (params?.offset) url.searchParams.set("offset", String(params.offset));

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Polymarket events failed: ${res.status}`);
    return res.json();
  }

  async getOrderBook(tokenId: string): Promise<OrderBook> {
    const url = new URL(`${this.clobUrl}/book`);
    url.searchParams.set("token_id", tokenId);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Polymarket book failed: ${res.status}`);
    return res.json();
  }

  async getMidpoint(tokenId: string): Promise<number> {
    const url = new URL(`${this.clobUrl}/midpoint`);
    url.searchParams.set("token_id", tokenId);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return 0;
    const data = await res.json();
    return parseFloat(data.mid || "0");
  }

  async getPrice(tokenId: string, side: "BUY" | "SELL" = "BUY"): Promise<number> {
    const url = new URL(`${this.clobUrl}/price`);
    url.searchParams.set("token_id", tokenId);
    url.searchParams.set("side", side);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return 0;
    const data = await res.json();
    return parseFloat(data.price || "0");
  }

  async getTimeseries(tokenId: string, interval: string = "1d"): Promise<any[]> {
    const url = new URL(`${this.clobUrl}/timeseries`);
    url.searchParams.set("token_id", tokenId);
    url.searchParams.set("interval", interval);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    return res.json();
  }

  async searchMarkets(query: string, limit: number = 10): Promise<PolymarketMarket[]> {
    // Use Gamma API for search
    const url = new URL(`${this.gammaUrl}/markets`);
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const markets = await res.json();
    const q = query.toLowerCase();
    return (Array.isArray(markets) ? markets : []).filter((m: any) =>
      m.question?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)
    );
  }

  // ─── Trending markets ─────────────────────────────────

  async getTrendingMarkets(limit: number = 10): Promise<PolymarketMarket[]> {
    const markets = await this.getMarkets({ limit: 50, active: true, closed: false });
    // Sort by volume
    return markets
      .sort((a, b) => parseFloat(b.volume || "0") - parseFloat(a.volume || "0"))
      .slice(0, limit);
  }
}

export const polymarketClient = new PolymarketClient();
