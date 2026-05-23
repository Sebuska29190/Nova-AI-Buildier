export interface RawArticle {
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: string;
}

export interface CuratedNews {
  title: string;
  url: string;
  source: string;
  summary: string;
  analysis: string;
  sentiment: "bullish" | "bearish" | "neutral";
  sentimentScore: number; // 1-10
  priceImpact: number; // 1-10
  rank: number; // 1-5
  publishedAt: string;
}

export interface NewsDigest {
  articles: CuratedNews[];
  marketMood: "bullish" | "bearish" | "neutral";
  moodBreakdown: { bullish: number; bearish: number; neutral: number };
  topPrices: { symbol: string; price: number; change24h: number }[];
  generatedAt: string;
}

export interface PriceSnapshot {
  symbol: string;
  price: number;
  change24h: number;
  change1h: number;
  timestamp: number;
}

export interface PortfolioPosition {
  symbol: string;
  amount: number;
  entryPrice?: number;
}

export interface PortfolioSnapshot {
  positions: PortfolioPosition[];
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  timestamp: number;
}

export interface PublicationRecord {
  id: string;
  timestamp: number;
  articleCount: number;
  skippedCount: number;
  digestPreview: string;
}
