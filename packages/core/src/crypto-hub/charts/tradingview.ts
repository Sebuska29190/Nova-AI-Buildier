/**
 * TradingView Widget Configuration
 * Generates iframe URLs for embedding TradingView charts
 */

export interface TradingViewWidgetParams {
  symbol: string;        // "BINANCE:BTCUSDT", "COINBASE:ETHUSD"
  interval?: string;     // "1", "5", "15", "60", "240", "D", "W", "M"
  theme?: "Dark" | "Light" | "Auto";
  style?: number;        // 1=candles, 2=line, 8=hollow_candles
  studies?: string[];    // ["MASimple@tv-basicstudies", "RSI@tv-basicstudies"]
  height?: number;
  width?: string;
  hideSideToolbar?: boolean;
  allowSymbolChange?: boolean;
}

const PRESETS: Record<string, Partial<TradingViewWidgetParams>> = {
  cryptoOverview: {
    interval: "D",
    style: 1,
    studies: ["MASimple@tv-basicstudies", "RSI@tv-basicstudies"],
    hideSideToolbar: true,
    allowSymbolChange: false,
  },
  tradingView: {
    interval: "60",
    style: 1,
    studies: ["MASimple@tv-basicstudies", "MACD@tv-basicstudies", "RSI@tv-basicstudies"],
    hideSideToolbar: false,
    allowSymbolChange: true,
  },
  miniChart: {
    interval: "D",
    style: 2,
    studies: [],
    hideSideToolbar: true,
    allowSymbolChange: false,
  },
  detailedAnalysis: {
    interval: "240",
    style: 1,
    studies: ["MASimple@tv-basicstudies", "MACD@tv-basicstudies", "RSI@tv-basicstudies", "BB@tv-basicstudies"],
    hideSideToolbar: false,
    allowSymbolChange: true,
  },
};

export class TradingViewConfig {
  /**
   * Generate TradingView widget embed URL
   */
  static getWidgetUrl(params: TradingViewWidgetParams): string {
    const url = new URL("https://www.tradingview.com/widgetembed/");

    url.searchParams.set("symbol", params.symbol);
    url.searchParams.set("interval", params.interval || "D");
    url.searchParams.set("theme", params.theme || "Dark");
    url.searchParams.set("style", String(params.style || 1));
    url.searchParams.set("hidesidetoolbar", params.hideSideToolbar ? "1" : "0");
    url.searchParams.set("symboledit", params.allowSymbolChange ? "1" : "0");
    url.searchParams.set("saveimage", "0");
    url.searchParams.set("studies", JSON.stringify(params.studies || []));
    url.searchParams.set("timezone", "exchange");
    url.searchParams.set("locale", "en");

    return url.toString();
  }

  /**
   * Get preset configuration
   */
  static getPreset(name: string): Partial<TradingViewWidgetParams> {
    return PRESETS[name] || PRESETS.tradingView;
  }

  /**
   * Convert crypto symbol to TradingView format
   */
  static toTradingViewSymbol(symbol: string, exchange: string = "BINANCE"): string {
    const pair = symbol.toUpperCase().includes("USDT") ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
    return `${exchange}:${pair}`;
  }

  /**
   * Get popular crypto TradingView symbols
   */
  static getPopularSymbols(): Array<{ name: string; symbol: string; tvSymbol: string }> {
    return [
      { name: "Bitcoin", symbol: "BTC", tvSymbol: "BINANCE:BTCUSDT" },
      { name: "Ethereum", symbol: "ETH", tvSymbol: "BINANCE:ETHUSDT" },
      { name: "Solana", symbol: "SOL", tvSymbol: "BINANCE:SOLUSDT" },
      { name: "XRP", symbol: "XRP", tvSymbol: "BINANCE:XRPUSDT" },
      { name: "Dogecoin", symbol: "DOGE", tvSymbol: "BINANCE:DOGEUSDT" },
      { name: "Cardano", symbol: "ADA", tvSymbol: "BINANCE:ADAUSDT" },
      { name: "Avalanche", symbol: "AVAX", tvSymbol: "BINANCE:AVAXUSDT" },
      { name: "Polkadot", symbol: "DOT", tvSymbol: "BINANCE:DOTUSDT" },
    ];
  }
}
