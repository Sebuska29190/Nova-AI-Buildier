/**
 * Solana Token Registry — popular tokens with metadata
 */

export interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
}

export const SOLANA_TOKENS: TokenInfo[] = [
  { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112", decimals: 9, coingeckoId: "solana" },
  { symbol: "USDC", name: "USD Coin", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, coingeckoId: "usd-coin" },
  { symbol: "USDT", name: "Tether", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6, coingeckoId: "tether" },
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, coingeckoId: "jupiter-exchange-solana" },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, coingeckoId: "bonk" },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6, coingeckoId: "dogwifcoin" },
  { symbol: "RAY", name: "Raydium", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6, coingeckoId: "raydium" },
  { symbol: "ORCA", name: "Orca", mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", decimals: 6, coingeckoId: "orca" },
  { symbol: "WEN", name: "Wen", mint: "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk", decimals: 5, coingeckoId: "wen-wen" },
  { symbol: "PYTH", name: "Pyth Network", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6, coingeckoId: "pyth-network" },
  { symbol: "RENDER", name: "Render", mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", decimals: 8, coingeckoId: "render-token" },
  { symbol: "JTO", name: "Jito", mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", decimals: 6, coingeckoId: "jito-governance-token" },
  { symbol: "W", name: "Wormhole", mint: "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ", decimals: 6, coingeckoId: "wormhole" },
  { symbol: "TNSR", name: "Tensor", mint: "TNSRxcUoT9BeyRb9RhB5HRmFbN5XZzRBycZq6ZQ8B1n", decimals: 6, coingeckoId: "tensor" },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", decimals: 9, coingeckoId: "popcat" },
  { symbol: "ME", name: "Magic Eden", mint: "MEfE4CDnRFLD9WLockSBMFYjEsU1Z5JU7G6dS5U4iZ6p", decimals: 6, coingeckoId: "magic-eden" },
  { symbol: "BOME", name: "BOOK OF MEME", mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82", decimals: 6, coingeckoId: "book-of-meme" },
  { symbol: "MYRO", name: "Myro", mint: "HhJpBhRRn4g56VsyLuT8DL5Bv31HkUqsSHrV3SjuhFoK", decimals: 9, coingeckoId: "myro" },
  { symbol: "SAMO", name: "Samoyedcoin", mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", decimals: 9, coingeckoId: "samoyedcoin" },
  { symbol: "FIDA", name: "Bonfida", mint: "EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp", decimals: 6, coingeckoId: "bonfida" },
  { symbol: "MNGO", name: "Mango Markets", mint: "MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac", decimals: 6, coingeckoId: "mango-markets" },
  { symbol: "STEP", name: "Step Finance", mint: "StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT", decimals: 9, coingeckoId: "step-finance" },
  { symbol: "FLUX", name: "Fluxbot", mint: "FLUXubRmkEi2q6K3Y5o2jQDQyRHVHFJ5FR9SAj8ARSL", decimals: 9, coingeckoId: "fluxbot" },
  { symbol: "TURBO", name: "Turbo", mint: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpkX", decimals: 9, coingeckoId: "turbo" },
  { symbol: "GUMMY", name: "GUMMY", mint: "FRQ3XfRhBEyA9rwEmBJ4M2xT1UGF6UdDdJP8WmBPEV6C", decimals: 9 },
  { symbol: "PENGU", name: "Pudgy Penguins", mint: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpkX", decimals: 9 },
  { symbol: "TRUMP", name: "Official Trump", mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", decimals: 6 },
  { symbol: "MOODENG", name: "Moo Deng", mint: "ED5nyyWEzpPPiWimJ8xwzDQti1WZb9bBZMah2FhMFJ7k", decimals: 9 },
  { symbol: "CHILLGUY", name: "chillguy", mint: "Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump", decimals: 9 },
  { symbol: "GOAT", name: "Goatseus Maximus", mint: "CzLSujWBLFsSjncK15MUoV1LbYKNX7hX7zBmV8cXr7Z", decimals: 9 },
];

// Stablecoins for DEX routing
export const STABLECOINS = ["USDC", "USDT"];

// Common trading pairs
export const POPULAR_PAIRS = [
  { base: "SOL", quote: "USDC" },
  { base: "JUP", quote: "USDC" },
  { base: "BONK", quote: "USDC" },
  { base: "WIF", quote: "USDC" },
  { base: "RAY", quote: "USDC" },
  { base: "RENDER", quote: "USDC" },
  { base: "JTO", quote: "USDC" },
  { base: "W", quote: "USDC" },
  { base: "TNSR", quote: "USDC" },
  { base: "POPCAT", quote: "USDC" },
];

export function findToken(symbol: string): TokenInfo | undefined {
  return SOLANA_TOKENS.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
}

export function findTokenByMint(mint: string): TokenInfo | undefined {
  return SOLANA_TOKENS.find(t => t.mint === mint);
}

export function formatAmount(amount: number, decimals: number): string {
  return (amount / Math.pow(10, decimals)).toFixed(decimals > 6 ? 4 : 2);
}

export function parseAmount(amount: string, decimals: number): number {
  return Math.floor(parseFloat(amount) * Math.pow(10, decimals));
}
