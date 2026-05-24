// ─── Crypto & Trading Hub — Unified Types ──────────────────────────────────────

// ▸ Live Prices
export interface PriceSnapshot {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  marketCap: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  ath: number;
  athDate: string;
  supply: number;
  rank: number;
  sparkline7d: number[];
  timestamp: number;
}

export interface PriceHistory {
  symbol: string;
  prices: [number, number][]; // [timestamp_ms, price]
  marketCaps: [number, number][];
  volumes: [number, number][];
}

// ▸ AI Trading Signals
export interface TradingSignal {
  symbol: string;
  price: number;
  signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  confidence: number; // 0-100
  reasoning: string;
  indicators: TechnicalIndicators;
  sentiment: "bullish" | "bearish" | "neutral";
  generatedAt: string;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: number;
  macdSignal: number;
  ema20: number;
  ema50: number;
  ema200: number;
  bollingerUpper: number;
  bollingerLower: number;
  volume24h: number;
  volatility24h: number;
}

export interface MarketScreener {
  topGainers: PriceSnapshot[];
  topLosers: PriceSnapshot[];
  mostVolume: PriceSnapshot[];
  trendingTokens: PriceSnapshot[];
  aiPicks: TradingSignal[];
  updatedAt: string;
}

// ▸ Portfolio
export interface PortfolioPosition {
  symbol: string;
  name: string;
  amount: number;
  avgBuyPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  allocation: number;
  addedAt: string;
}

export interface PortfolioSnapshot {
  positions: PortfolioPosition[];
  totalValue: number;
  totalInvested: number;
  totalPnl: number;
  totalPnlPercent: number;
  bestPerformer: string;
  worstPerformer: string;
  timestamp: number;
}

export interface Transaction {
  id: string;
  symbol: string;
  type: "buy" | "sell";
  amount: number;
  price: number;
  total: number;
  fee?: number;
  timestamp: string;
  note?: string;
}

// ▸ Crypto News (z istniejącego crypto/)
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
  sentimentScore: number;
  priceImpact: number;
  rank: number;
  publishedAt: string;
}

export interface NewsDigest {
  articles: CuratedNews[];
  marketMood: "bullish" | "bearish" | "neutral";
  moodBreakdown: { bullish: number; bearish: number; neutral: number };
  topPrices: { symbol: string; price: number; change24h: number }[];
  generatedAt: string;
}

// ▸ Whale Tracking
export interface WhaleAlert {
  symbol: string;
  amount: number;
  valueUsd: number;
  from: string;
  to: string;
  fromLabel?: string;
  toLabel?: string;
  transactionHash: string;
  timestamp: string;
  type: "deposit" | "withdraw" | "transfer";
}

export interface OnChainMetrics {
  symbol: string;
  activeAddresses24h: number;
  transactionCount24h: number;
  largeTransactions24h: number;
  exchangeInflow24h: number;
  exchangeOutflow24h: number;
  netExchangeFlow24h: number;
  supplyOnExchanges: number;
  supplyPercentOnExchanges: number;
}

// ▸ Watchlist
export interface WatchlistEntry {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  alertPrice?: number;
  alertDirection?: "above" | "below";
  notes?: string;
  addedAt: string;
}

// ▸ Hub State
export interface CryptoHubState {
  screener: MarketScreener | null;
  portfolio: PortfolioSnapshot | null;
  watchlist: WatchlistEntry[];
  news: NewsDigest | null;
  whales: WhaleAlert[];
  onChain: Record<string, OnChainMetrics>;
  selectedSymbol: string | null;
  selectedPriceHistory: PriceHistory | null;
  lastUpdated: number;
}
