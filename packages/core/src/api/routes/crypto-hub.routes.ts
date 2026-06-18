import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { runAgent } from "../../agent/runner.ts";
import { existsSync } from "node:fs";

export function register(app: Hono): void {
  // --- Crypto & Trading Hub V2 ----------------------------------------
  app.get("/api/crypto-hub/dashboard", async (c) => {
    try { const { getDashboard } = await import("../../crypto-hub/v2.ts"); return c.json(await getDashboard()); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/crypto-hub/coin/:symbol", async (c) => {
    try { const { getCoinDetail } = await import("../../crypto-hub/v2.ts"); return c.json(await getCoinDetail(c.req.param("symbol"))); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/crypto-hub/alerts", async (c) => {
    try { const { listAlerts } = await import("../../crypto-hub/v2.ts"); return c.json({ alerts: listAlerts() }); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/crypto-hub/alerts", async (c) => {
    try {
      const { addAlert } = await import("../../crypto-hub/v2.ts");
      const body = await c.req.json<{ symbol: string; type: string; value: number; message?: string; channel?: string; channelConfig?: string }>();
      return c.json(addAlert(body.symbol, body.type, body.value, body.message, body.channel, body.channelConfig));
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.delete("/api/crypto-hub/alerts/:id", async (c) => {
    try { const { removeAlert } = await import("../../crypto-hub/v2.ts"); return c.json({ removed: removeAlert(c.req.param("id")) }); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/crypto-hub/portfolio", async (c) => {
    try { const { getPortfolioWithPnL } = await import("../../crypto-hub/v2.ts"); return c.json(await getPortfolioWithPnL()); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/crypto-hub/portfolio", async (c) => {
    try {
      const { addPortfolioEntry } = await import("../../crypto-hub/v2.ts");
      const body = await c.req.json<{ symbol: string; amount: number; buyPrice: number; notes?: string }>();
      return c.json(addPortfolioEntry(body.symbol, body.amount, body.buyPrice, body.notes));
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.delete("/api/crypto-hub/portfolio/:id", async (c) => {
    try { const { removePortfolioEntry } = await import("../../crypto-hub/v2.ts"); return c.json({ removed: removePortfolioEntry(c.req.param("id")) }); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/crypto-hub/check-alerts", async (c) => {
    try { const { checkAlerts } = await import("../../crypto-hub/v2.ts"); return c.json({ triggered: await checkAlerts() }); }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // -- Social Media Accounts API ----------------------------
  app.get("/api/social/accounts", async (c) => {
    const { listAccounts } = await import("../../social/manager.ts");
    return c.json({ accounts: listAccounts() });
  });

  app.get("/api/social/platforms", async (c) => {
    const { PLATFORM_DEFS } = await import("../../social/manager.ts");
    return c.json({ platforms: PLATFORM_DEFS });
  });

  app.post("/api/social/accounts", async (c) => {
    try {
      const body = await c.req.json<{ name: string; platform: string; apiConfig?: Record<string, string> }>();
      const { addAccount } = await import("../../social/manager.ts");
      const account = addAccount({ name: body.name, platform: body.platform, apiConfig: body.apiConfig });
      return c.json({ account }, 201);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.delete("/api/social/accounts/:id", async (c) => {
    const { removeAccount } = await import("../../social/manager.ts");
    const ok = removeAccount(c.req.param("id"));
    return c.json({ ok });
  });

  app.post("/api/social/accounts/:id/connect", async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json<{ apiConfig?: Record<string, string> }>().catch(() => ({}));
      const { getAccount, updateAccount, verifyAndConnect } = await import("../../social/manager.ts");

      // If apiConfig provided, update it first
      if (body.apiConfig) {
        updateAccount(id, { apiConfig: body.apiConfig });
      }

      const result = await verifyAndConnect(id);
      return c.json(result);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/social/accounts/:id/launch", async (c) => {
    try {
      const id = c.req.param("id");
      const { getAccount } = await import("../../social/manager.ts");
      const account = getAccount(id);
      if (!account) return c.json({ error: "Account not found" }, 404);

      const { PLATFORM_DEFS } = await import("../../social/manager.ts");
      const platDef = PLATFORM_DEFS.find((p: any) => p.id === account.platform);
      const loginUrl = platDef?.loginUrl || `https://www.${account.platform}.com/login`;
      const profileDir = account.profileDir;

      if (!profileDir || !existsSync(profileDir)) {
        return c.json({ error: "No browser profile for this account" }, 400);
      }

      const { execSync } = await import("node:child_process");

      // Find Chrome/Edge/Brave
      const browsers = [
        "chrome", "msedge", "brave", "google-chrome",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      ];

      let browserCmd = "";
      for (const b of browsers) {
        try {
          execSync(`where ${b}`, { timeout: 1000, windowsHide: true });
          browserCmd = b;
          break;
        } catch {
          // Check full path
          if (existsSync(b)) { browserCmd = b; break; }
        }
      }

      if (!browserCmd) {
        return c.json({ error: "No browser found. Install Chrome, Edge, or Brave." }, 500);
      }

      // Normalize path for Chrome (forward slashes are more reliable on Windows)
      const normalizedDir = profileDir.replace(/\\/g, "/");

      // Kill only browser processes using THIS specific profile
      // Match by account ID in the command line (unique to this profile)
      try {
        execSync(`powershell -Command "Get-Process -Name chrome,msedge,brave -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match '${id}' } | Stop-Process -Force -ErrorAction SilentlyContinue"`, { timeout: 3000, windowsHide: true });
      } catch {}

      // Wait briefly for processes to release
      await new Promise(r => setTimeout(r, 1000));

      execSync(`start "" "${browserCmd}" --user-data-dir="${normalizedDir}" "${loginUrl}" --new-window --no-first-run --no-default-browser-check`, {
        timeout: 5000, shell: "cmd.exe", windowsHide: false,
      });

      return c.json({
        ok: true,
        message: `🌐 Browser opened for **${account.name}**.\nLog in, then click "Verify Login" to confirm.`,
      });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/social/accounts/:id/verify", async (c) => {
    try {
      const { verifyBrowserLogin } = await import("../../social/manager.ts");
      const result = await verifyBrowserLogin(c.req.param("id"));
      return c.json(result);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // --- Playground ------------------------------------------------
  const playgroundHistory: any[] = [];

  app.post("/api/playground/run", async (c) => {
    try {
      const body = await c.req.json();
      const { model, systemPrompt, userPrompt, temperature, maxTokens } = body;

      const messages = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: userPrompt });

      // Use the existing chat mechanism
      const startTime = Date.now();
      const result = await runAgent({
        message: userPrompt,
        modelRef: model || "deepseek/deepseek-chat",
        systemPrompt: systemPrompt || undefined,
      });
      const latency = (Date.now() - startTime) / 1000;

      return c.json({ 
        text: result.text,
        latency,
        tokens: result.usage?.total_tokens || 0,
        cost: 0,
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  app.get("/api/playground/history", (c) => {
    return c.json({ runs: playgroundHistory.slice(0, 50) });
  });

  app.post("/api/playground/save", async (c) => {
    try {
      const body = await c.req.json();
      const { name, systemPrompt, userPrompt, model } = body;
      playgroundHistory.push({
        id: Date.now(),
        name,
        systemPrompt,
        userPrompt,
        model,
        savedAt: new Date().toISOString(),
      });
      return c.json({ ok: true });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });
}
