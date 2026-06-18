import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";

export function register(app: Hono): void {
  // --- OAuth Endpoints --------------------------------------
  app.get("/api/integrations/oauth/authorize/:service", async (c) => {
    try {
      const { oauthManager } = await import("../../integrations/oauth");
      const { url, codeVerifier } = oauthManager.getAuthorizeUrl(c.req.param("service"));
      // Store codeVerifier in session for later exchange
      return c.json({ url, codeVerifier });
    } catch (e: any) { return c.json({ error: e.message }, 400); }
  });

  app.post("/api/integrations/oauth/callback", async (c) => {
    try {
      const { oauthManager } = await import("../../integrations/oauth");
      const body = await c.req.json();
      const token = await oauthManager.exchangeCode(body.service, body.code, body.codeVerifier);
      // Store token for the integration
      if (body.integrationId) {
        oauthManager.storeTokens(body.integrationId, body.service, token);
      }
      return c.json({ ok: true, tokenType: token.tokenType, scopes: token.scopes });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/integrations/oauth/config", (c) => {
    const configs: Record<string, any> = {};
    for (const [service, config] of Object.entries(require("../../integrations/oauth").OAUTH_CONFIGS)) {
      configs[service] = { authorizeUrl: config.authorizeUrl, scopes: config.scopes, usePKCE: config.usePKCE };
    }
    return c.json(configs);
  });

  // --- Git Automation Endpoints -----------------------------
  app.post("/api/git/status", async (c) => {
    try {
      const { gitManager } = await import("../../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.getStatus(body.cwd || process.cwd()));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/diff", async (c) => {
    try {
      const { gitManager } = await import("../../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.diff(body.cwd || process.cwd(), body.target));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/log", async (c) => {
    try {
      const { gitManager } = await import("../../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.log(body.cwd || process.cwd(), body.count || 20));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/branch", async (c) => {
    try {
      const { gitManager } = await import("../../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.branch(body.cwd || process.cwd(), body.name));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/checkout", async (c) => {
    try {
      const { gitManager } = await import("../../git/manager");
      const body = await c.req.json();
      return c.json(await gitManager.checkout(body.cwd || process.cwd(), body.branch));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/commit", async (c) => {
    try {
      const { gitManager } = await import("../../git/manager");
      const body = await c.req.json();
      return c.json(await gitManager.commit(body.cwd || process.cwd(), body.message, body.files));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/push", async (c) => {
    try {
      const { gitManager } = await import("../../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.push(body.cwd || process.cwd(), body.remote, body.branch));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/pull", async (c) => {
    try {
      const { gitManager } = await import("../../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.pull(body.cwd || process.cwd(), body.remote, body.branch));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/stash", async (c) => {
    try {
      const { gitManager } = await import("../../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.stash(body.cwd || process.cwd(), body.message));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/stash-pop", async (c) => {
    try {
      const { gitManager } = await import("../../git/manager");
      const body = await c.req.json().catch(() => ({}));
      return c.json(await gitManager.stashPop(body.cwd || process.cwd()));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/git/blame", async (c) => {
    try {
      const { gitManager } = await import("../../git/manager");
      const body = await c.req.json();
      return c.json(await gitManager.blame(body.cwd || process.cwd(), body.file));
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // --- RAG Embedding Endpoints ------------------------------
  app.get("/api/rag/config", (c) => {
    const { embeddingManager } = require("../../rag/manager");
    return c.json(embeddingManager.getConfig());
  });

  app.post("/api/rag/config", async (c) => {
    const { embeddingManager } = require("../../rag/manager");
    const body = await c.req.json();
    await embeddingManager.setConfig(body.provider, body.model, body.apiKey);
    return c.json({ ok: true });
  });

  app.post("/api/rag/embed/:docId", async (c) => {
    const { embeddingManager } = require("../../rag/manager");
    const count = await embeddingManager.embedDocument(c.req.param("docId"));
    return c.json({ embedded: count });
  });

  app.post("/api/rag/embed-all", async (c) => {
    const { embeddingManager } = require("../../rag/manager");
    const result = await embeddingManager.embedAllDocuments();
    return c.json(result);
  });

  app.post("/api/rag/hybrid-search", async (c) => {
    const { embeddingManager } = require("../../rag/manager");
    const body = await c.req.json();
    const results = await embeddingManager.hybridSearch(body.query, body.limit || 10);
    return c.json({ results });
  });

  // --- DEX Trading Endpoints -------------------------------
  app.post("/api/dex/quote", async (c) => {
    try {
      const { jupiterClient } = await import("../../crypto-hub/dex/jupiter");
      const { findToken } = await import("../../crypto-hub/dex/tokens");
      const body = await c.req.json();
      const inputToken = findToken(body.from);
      const outputToken = findToken(body.to);
      if (!inputToken || !outputToken) return c.json({ error: "Unknown token" }, 400);
      const amount = Math.floor(parseFloat(body.amount) * Math.pow(10, inputToken.decimals));
      const quote = await jupiterClient.getQuote({
        inputMint: inputToken.mint, outputMint: outputToken.mint,
        amount, slippageBps: body.slippage || 50,
      });
      return c.json(quote);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/dex/swap", async (c) => {
    try {
      const { jupiterClient } = await import("../../crypto-hub/dex/jupiter");
      const { findToken } = await import("../../crypto-hub/dex/tokens");
      const body = await c.req.json();
      const inputToken = findToken(body.from);
      const outputToken = findToken(body.to);
      if (!inputToken || !outputToken) return c.json({ error: "Unknown token" }, 400);

      // Use publicKey from frontend wallet (Phantom/Solflare)
      const publicKey = body.publicKey;
      if (!publicKey) return c.json({ error: "Wallet public key required" }, 400);

      const amount = Math.floor(parseFloat(body.amount) * Math.pow(10, inputToken.decimals));
      const quote = await jupiterClient.getQuote({
        inputMint: inputToken.mint, outputMint: outputToken.mint, amount, slippageBps: body.slippage || 50,
      });
      const swap = await jupiterClient.getSwapTransaction({
        quoteResponse: quote, userPublicKey: publicKey,
      });
      return c.json(swap);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/dex/price/:tokens", async (c) => {
    try {
      const { jupiterClient } = await import("../../crypto-hub/dex/jupiter");
      const { findToken } = await import("../../crypto-hub/dex/tokens");
      const symbols = c.req.param("tokens").split(",");
      const mints = symbols.map((s: string) => findToken(s.trim())?.mint).filter(Boolean);
      const prices = await jupiterClient.getSimplePrice(mints);
      return c.json(prices);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/dex/wallet", async (c) => {
    try {
      const { walletManager } = await import("../../crypto-hub/dex/wallet");
      walletManager.init();
      const info = await walletManager.getInfo();
      return c.json(info || { error: "No wallet" });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/dex/tokens", (c) => {
    const { SOLANA_TOKENS } = require("../../crypto-hub/dex/tokens");
    return c.json(SOLANA_TOKENS);
  });

  // --- Polymarket Endpoints --------------------------------
  app.get("/api/polymarket/markets", async (c) => {
    try {
      const { polymarketClient } = await import("../../crypto-hub/polymarket/client");
      const limit = parseInt(c.req.query("limit") || "20");
      const active = c.req.query("active") !== "false";
      const markets = await polymarketClient.getMarkets({ limit, active, closed: false });
      return c.json(markets);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/markets/:id", async (c) => {
    try {
      const { polymarketClient } = await import("../../crypto-hub/polymarket/client");
      const market = await polymarketClient.getMarket(c.req.param("id"));
      return c.json(market);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/trending", async (c) => {
    try {
      const { polymarketClient } = await import("../../crypto-hub/polymarket/client");
      const limit = parseInt(c.req.query("limit") || "10");
      const markets = await polymarketClient.getTrendingMarkets(limit);
      return c.json(markets);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/search", async (c) => {
    try {
      const { polymarketClient } = await import("../../crypto-hub/polymarket/client");
      const q = c.req.query("q") || "";
      const markets = await polymarketClient.searchMarkets(q, 10);
      return c.json(markets);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/book/:tokenId", async (c) => {
    try {
      const { polymarketClient } = await import("../../crypto-hub/polymarket/client");
      const book = await polymarketClient.getOrderBook(c.req.param("tokenId"));
      return c.json(book);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/analyze/:id", async (c) => {
    try {
      const { polymarketAnalyzer } = await import("../../crypto-hub/polymarket/analyzer");
      const analysis = await polymarketAnalyzer.analyzeMarket(c.req.param("id"));
      return c.json(analysis);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/polymarket/opportunities", async (c) => {
    try {
      const { polymarketAnalyzer } = await import("../../crypto-hub/polymarket/analyzer");
      const limit = parseInt(c.req.query("limit") || "5");
      const opps = await polymarketAnalyzer.findOpportunities(limit);
      return c.json(opps);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // --- Strategy Endpoints ----------------------------------
  app.get("/api/strategies", (c) => {
    const { strategyEngine } = require("../../crypto-hub/strategies/engine");
    return c.json(strategyEngine.listStrategies());
  });

  app.post("/api/strategies", async (c) => {
    try {
      const { strategyEngine } = await import("../../crypto-hub/strategies/engine");
      const body = await c.req.json();
      const strategy = strategyEngine.createStrategy(body.type, body.name, body.config || {});
      return c.json(strategy);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/strategies/:id", (c) => {
    const { strategyEngine } = require("../../crypto-hub/strategies/engine");
    const s = strategyEngine.getStrategy(c.req.param("id"));
    return s ? c.json(s) : c.json({ error: "Not found" }, 404);
  });

  app.delete("/api/strategies/:id", (c) => {
    const { strategyEngine } = require("../../crypto-hub/strategies/engine");
    strategyEngine.deleteStrategy(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post("/api/strategies/:id/start", (c) => {
    const { strategyEngine } = require("../../crypto-hub/strategies/engine");
    strategyEngine.startStrategy(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post("/api/strategies/:id/pause", (c) => {
    const { strategyEngine } = require("../../crypto-hub/strategies/engine");
    strategyEngine.pauseStrategy(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.get("/api/strategies/:id/history", (c) => {
    const { strategyEngine } = require("../../crypto-hub/strategies/engine");
    return c.json(strategyEngine.getTradeHistory(c.req.param("id")));
  });

  // --- Risk Endpoints --------------------------------------
  app.post("/api/risk/score", async (c) => {
    try {
      const { riskScorer } = await import("../../crypto-hub/risk/scorer");
      const body = await c.req.json();
      const result = await riskScorer.calculateRisk(body.positions || []);
      return c.json(result);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // --- TradingView Widget Config --------------------------
  app.get("/api/tradingview/url", (c) => {
    const { TradingViewConfig } = require("../../crypto-hub/charts/tradingview");
    const symbol = c.req.query("symbol") || "BINANCE:BTCUSDT";
    const preset = c.req.query("preset") || "tradingView";
    const config = { ...TradingViewConfig.getPreset(preset), symbol };
    return c.json({ url: TradingViewConfig.getWidgetUrl(config) });
  });

  // --- 1inch DEX (Multi-Chain EVM) -----------------------
  app.post("/api/oneinch/quote", async (c) => {
    try {
      const { oneInchClient } = await import("../../crypto-hub/dex/oneinch");
      const body = await c.req.json();
      const quote = await oneInchClient.getQuote({
        chainId: body.chainId || 1,
        src: body.src,
        dst: body.dst,
        amount: body.amount,
        includeGas: true,
      });
      return c.json(quote);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/oneinch/swap", async (c) => {
    try {
      const { oneInchClient } = await import("../../crypto-hub/dex/oneinch");
      const body = await c.req.json();
      const swap = await oneInchClient.getSwapTransaction({
        chainId: body.chainId || 1,
        src: body.src,
        dst: body.dst,
        amount: body.amount,
        from: body.from,
        slippage: body.slippage || 1,
      });
      return c.json(swap);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/oneinch/allowance", async (c) => {
    try {
      const { oneInchClient } = await import("../../crypto-hub/dex/oneinch");
      const chainId = parseInt(c.req.query("chainId") || "1");
      const token = c.req.query("token") || "";
      const wallet = c.req.query("wallet") || "";
      const allowance = await oneInchClient.getAllowance({ chainId, tokenAddress: token, walletAddress: wallet });
      return c.json({ allowance });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.post("/api/oneinch/approval", async (c) => {
    try {
      const { oneInchClient } = await import("../../crypto-hub/dex/oneinch");
      const body = await c.req.json();
      const approval = await oneInchClient.buildApproval({
        chainId: body.chainId || 1,
        tokenAddress: body.tokenAddress,
        amount: body.amount,
      });
      return c.json(approval);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/oneinch/tokens/:chainId", async (c) => {
    try {
      const { oneInchClient } = await import("../../crypto-hub/dex/oneinch");
      const tokens = await oneInchClient.getTokens(parseInt(c.req.param("chainId")));
      return c.json(tokens);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  // --- Relay Bridge (Cross-Chain) -------------------------
  app.post("/api/bridge/quote", async (c) => {
    try {
      const { relayBridge } = await import("../../crypto-hub/bridge/relay");
      const body = await c.req.json();
      const quote = await relayBridge.getQuote({
        originChainId: body.originChainId,
        destinationChainId: body.destinationChainId,
        originCurrency: body.originCurrency || body.originToken,
        destinationCurrency: body.destinationCurrency || body.destinationToken,
        amount: body.amount,
        user: body.user || body.sender,
      });
      return c.json(quote);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/bridge/chains", async (c) => {
    try {
      const { relayBridge } = await import("../../crypto-hub/bridge/relay");
      const chains = await relayBridge.getSupportedChains();
      return c.json(chains);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });

  app.get("/api/bridge/tokens/:chainId", async (c) => {
    try {
      const { relayBridge } = await import("../../crypto-hub/bridge/relay");
      const tokens = await relayBridge.getSupportedTokens(parseInt(c.req.param("chainId")));
      return c.json(tokens);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
  });
}
