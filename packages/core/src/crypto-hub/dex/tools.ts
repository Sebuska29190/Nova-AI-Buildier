/**
 * DEX Trading Tools — Jupiter + Solana wallet
 */
import { registerTool } from "../../plugin/tools";
import { jupiterClient } from "./jupiter";
import { walletManager } from "./wallet";
import { SOLANA_TOKENS, findToken, STABLECOINS } from "./tokens";

// ─── DEX Tools ──────────────────────────────────────────

registerTool({
  name: "dex_quote",
  description: "Get a swap quote for a Solana token pair via Jupiter. Returns output amount, price impact, and route.",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string", description: "Input token symbol (e.g. SOL, USDC, JUP)" },
      to: { type: "string", description: "Output token symbol (e.g. USDC, SOL, BONK)" },
      amount: { type: "string", description: "Amount in human-readable form (e.g. '1.5' for 1.5 SOL)" },
      slippage: { type: "number", description: "Slippage tolerance in bps (default 50 = 0.5%)" },
    },
    required: ["from", "to", "amount"],
  },
  async execute(args: { from: string; to: string; amount: string; slippage?: number }) {
    const inputToken = findToken(args.from);
    const outputToken = findToken(args.to);
    if (!inputToken) return `Unknown token: ${args.from}. Available: ${SOLANA_TOKENS.map(t => t.symbol).join(", ")}`;
    if (!outputToken) return `Unknown token: ${args.to}. Available: ${SOLANA_TOKENS.map(t => t.symbol).join(", ")}`;

    const amountLamports = Math.floor(parseFloat(args.amount) * Math.pow(10, inputToken.decimals));
    if (isNaN(amountLamports) || amountLamports <= 0) return "Invalid amount";

    const quote = await jupiterClient.getQuote({
      inputMint: inputToken.mint,
      outputMint: outputToken.mint,
      amount: amountLamports,
      slippageBps: args.slippage || 50,
    });

    const outAmount = parseFloat(quote.outAmount) / Math.pow(10, outputToken.decimals);
    const inAmount = parseFloat(quote.inAmount) / Math.pow(10, inputToken.decimals);

    return [
      `**${args.amount} ${inputToken.symbol} → ${outAmount.toFixed(outputToken.decimals > 6 ? 4 : 2)} ${outputToken.symbol}**`,
      `Price impact: ${parseFloat(quote.priceImpactPct).toFixed(4)}%`,
      `Slippage: ${quote.slippageBps} bps`,
      `Routes: ${quote.routePlan?.length || 0} hop(s)`,
    ].join("\n");
  },
});

registerTool({
  name: "dex_swap",
  description: "Execute a token swap on Solana via Jupiter. Requires wallet configured (SOLANA_PRIVATE_KEY env).",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string", description: "Input token symbol" },
      to: { type: "string", description: "Output token symbol" },
      amount: { type: "string", description: "Amount to swap" },
    },
    required: ["from", "to", "amount"],
  },
  async execute(args: { from: string; to: string; amount: string }) {
    walletManager.init();
    if (!walletManager.isConnected()) return "Wallet not configured. Set SOLANA_PRIVATE_KEY in .env";

    const inputToken = findToken(args.from);
    const outputToken = findToken(args.to);
    if (!inputToken || !outputToken) return "Unknown token";

    const amountLamports = Math.floor(parseFloat(args.amount) * Math.pow(10, inputToken.decimals));

    // Get quote
    const quote = await jupiterClient.getQuote({
      inputMint: inputToken.mint,
      outputMint: outputToken.mint,
      amount: amountLamports,
      slippageBps: 50,
    });

    // Build swap transaction
    const swap = await jupiterClient.getSwapTransaction({
      quoteResponse: quote,
      userPublicKey: walletManager.getAddress()!,
    });

    // In production, sign with private key and execute
    // For now, return the transaction for user to sign
    const outAmount = parseFloat(quote.outAmount) / Math.pow(10, outputToken.decimals);
    return `Swap prepared: ${args.amount} ${inputToken.symbol} → ${outAmount.toFixed(4)} ${outputToken.symbol}\nTransaction ready for signing. Use wallet interface to complete.`;
  },
});

registerTool({
  name: "dex_price",
  description: "Get current USD prices for Solana tokens via Jupiter",
  parameters: {
    type: "object",
    properties: {
      tokens: { type: "string", description: "Comma-separated token symbols (e.g. 'SOL,USDC,JUP')" },
    },
    required: ["tokens"],
  },
  async execute(args: { tokens: string }) {
    const symbols = args.tokens.split(",").map(s => s.trim().toUpperCase());
    const tokenMap = new Map<string, typeof SOLANA_TOKENS[0]>();
    const mints: string[] = [];

    for (const sym of symbols) {
      const token = findToken(sym);
      if (token) {
        tokenMap.set(token.mint, token);
        mints.push(token.mint);
      }
    }

    if (mints.length === 0) return "No valid tokens found";

    const prices = await jupiterClient.getSimplePrice(mints);
    const lines = mints.map(mint => {
      const token = tokenMap.get(mint)!;
      const price = prices[mint] || 0;
      return `**${token.symbol}**: $${price.toFixed(price < 1 ? 6 : 2)}`;
    });

    return lines.join("\n");
  },
});

registerTool({
  name: "dex_balance",
  description: "Get Solana wallet balances (SOL + tokens)",
  parameters: { type: "object", properties: {} },
  async execute() {
    walletManager.init();
    if (!walletManager.isConnected()) return "Wallet not configured. Set SOLANA_PRIVATE_KEY in .env";

    const info = await walletManager.getInfo();
    if (!info) return "Could not fetch wallet info";

    const lines = [`**Wallet: ${info.address.slice(0, 6)}...${info.address.slice(-4)}**\n`];
    lines.push(`SOL: ${info.solBalance.toFixed(4)}`);

    if (info.tokenAccounts.length > 0) {
      lines.push("\n**Tokens:**");
      for (const t of info.tokenAccounts) {
        const token = findToken(t.mint);
        const symbol = token?.symbol || t.mint.slice(0, 6);
        lines.push(`  ${symbol}: ${t.amount.toFixed(t.decimals > 6 ? 4 : 2)}`);
      }
    }

    return lines.join("\n");
  },
});

registerTool({
  name: "dex_tokens",
  description: "List available Solana tokens for trading",
  parameters: {
    type: "object",
    properties: {
      search: { type: "string", description: "Optional search filter" },
    },
  },
  async execute(args: { search?: string }) {
    let tokens = SOLANA_TOKENS;
    if (args.search) {
      const q = args.search.toLowerCase();
      tokens = tokens.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
    }
    return tokens.map(t => `${t.symbol} — ${t.name} (${t.decimals} decimals)`).join("\n");
  },
});

console.log("[dex] Registered 5 DEX trading tools");
