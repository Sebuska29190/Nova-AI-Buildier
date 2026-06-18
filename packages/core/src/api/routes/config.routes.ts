import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { join, dirname } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { getAllProviderConfigs } from "../../config/provider-config.ts";
import { workspaceManager } from "../../workspace/manager.ts";

export function register(app: Hono): void {
  // --- Workspace API --------------------------------------------------------
  app.post("/api/workspace/add-folder", async (c) => {
    try {
      const body = await c.req.json<{ path: string }>();
      const ok = workspaceManager.addFolder(body.path);
      return c.json({ ok });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.post("/api/workspace/remove-folder", async (c) => {
    try {
      const body = await c.req.json<{ path: string }>();
      const ok = workspaceManager.removeFolder(body.path);
      return c.json({ ok });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });

  app.get("/api/workspace/folders", (c) => {
    const folders = workspaceManager.getFolders();
    return c.json({ folders });
  });

  // Native folder picker — opens Windows folder dialog via PowerShell
  app.post("/api/workspace/browse", async (c) => {
    try {
      const { execSync } = await import("node:child_process");
      // PowerShell script that opens native FolderBrowserDialog
      // Use semicolons between statements so newline?space replacement doesn't break it
      const psScript = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$folder = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$folder.Description = "Select workspace folder for Nexus AI"',
        '$folder.ShowNewFolderButton = $true',
        '$result = $folder.ShowDialog()',
        'if ($result -eq [System.Windows.Forms.DialogResult]::OK) {',
        '  Write-Output $folder.SelectedPath',
        '} else {',
        '  Write-Output "__CANCELLED__"',
        '}',
      ].join("; ");
      const result = execSync(
        `powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
        { encoding: "utf-8", timeout: 30000, shell: true },
      ).trim();
      if (result === "__CANCELLED__" || !result) {
        return c.json({ cancelled: true });
      }
      return c.json({ path: result });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  // --- Config / Global Rules -------------------------------------------------
  const RULES_PATH = join(process.cwd(), "config", "rules.txt");

  app.get("/api/config/rules", (c) => {
    try {
      if (existsSync(RULES_PATH)) {
        const rules = readFileSync(RULES_PATH, "utf-8");
        return c.json({ rules });
      }
      return c.json({ rules: "" });
    } catch (e: unknown) {
      return c.json({ rules: "", error: safeMessage(e) });
    }
  });

  app.post("/api/config/rules", async (c) => {
    try {
      const body = await c.req.json<{ rules: string }>();
      const dir = dirname(RULES_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(RULES_PATH, body.rules ?? "", "utf-8");
      return c.json({ status: "saved" });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  // Save generation defaults
  app.post("/api/config/settings", async (c) => {
    try {
      const body = await c.req.json<{ ttsEngine?: string; imageEngine?: string; videoQuality?: string }>();
      const SETTINGS_PATH = join(process.cwd(), "data", "defaults.json");
      const dir = dirname(SETTINGS_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const existing = existsSync(SETTINGS_PATH) ? JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) : {};
      const merged = { ...existing, ...body };
      writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
      // Also set env vars for runtime
      if (body.ttsEngine) process.env.NOVA_DEFAULT_TTS = body.ttsEngine;
      if (body.imageEngine) process.env.NOVA_DEFAULT_IMAGE = body.imageEngine;
      if (body.videoQuality) process.env.NOVA_DEFAULT_QUALITY = body.videoQuality;
      return c.json({ status: "saved", settings: merged });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  // --- Config Export/Import ------------------------------------------------------
  const CFG_DIR = join(process.cwd(), "data");
  const APPEARANCE_PATH = join(process.cwd(), "data", "appearance.json");

  app.get("/api/config/export", (c) => {
    try {
      const providers = getAllProviderConfigs();
      const rules = existsSync(RULES_PATH) ? readFileSync(RULES_PATH, "utf-8") : "";
      const defaults = existsSync(join(CFG_DIR, "defaults.json"))
        ? JSON.parse(readFileSync(join(CFG_DIR, "defaults.json"), "utf-8"))
        : {};
      const appearance = existsSync(APPEARANCE_PATH)
        ? JSON.parse(readFileSync(APPEARANCE_PATH, "utf-8"))
        : {};
      return c.json({
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        providers: providers.map((p: any) => ({
          id: p.id,
          providerId: p.providerId,
          name: p.name,
          enabled: p.enabled,
          model: p.model,
          baseUrl: p.baseUrl,
        })),
        rules,
        defaults,
        appearance,
      });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  app.post("/api/config/import", async (c) => {
    try {
      const body = await c.req.json<any>();
      if (!body || !body.exportVersion) {
        return c.json({ error: "Invalid config file: missing exportVersion" }, 400);
      }
      // Save rules
      if (body.rules !== undefined) {
        const dir = dirname(RULES_PATH);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(RULES_PATH, body.rules, "utf-8");
      }
      // Save defaults
      if (body.defaults) {
        if (!existsSync(CFG_DIR)) mkdirSync(CFG_DIR, { recursive: true });
        writeFileSync(join(CFG_DIR, "defaults.json"), JSON.stringify(body.defaults, null, 2), "utf-8");
      }
      // Save appearance
      if (body.appearance) {
        if (!existsSync(CFG_DIR)) mkdirSync(CFG_DIR, { recursive: true });
        writeFileSync(APPEARANCE_PATH, JSON.stringify(body.appearance, null, 2), "utf-8");
      }
      return c.json({ status: "imported" });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  app.get("/api/config/appearance", (c) => {
    try {
      const defaults = { theme: "dark", fontSize: "medium", accentColor: "#00f2fe", compact: false };
      if (existsSync(APPEARANCE_PATH)) {
        const saved = JSON.parse(readFileSync(APPEARANCE_PATH, "utf-8"));
        return c.json({ ...defaults, ...saved });
      }
      return c.json(defaults);
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  app.post("/api/config/appearance", async (c) => {
    try {
      const body = await c.req.json<{ theme?: string; fontSize?: string; accentColor?: string; compact?: boolean }>();
      if (!existsSync(CFG_DIR)) mkdirSync(CFG_DIR, { recursive: true });
      const existing = existsSync(APPEARANCE_PATH) ? JSON.parse(readFileSync(APPEARANCE_PATH, "utf-8")) : {};
      const merged = { ...existing, ...body };
      writeFileSync(APPEARANCE_PATH, JSON.stringify(merged, null, 2), "utf-8");
      return c.json({ status: "saved", appearance: merged });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  // --- MCP Management -----------------------------------------------------------
  app.get("/api/mcp/servers", async (c) => {
    try {
      const { listServers } = await import("../../mcp/client.ts");
      return c.json({ servers: listServers() });
    } catch { return c.json({ servers: [] }); }
  });

  app.post("/api/mcp/restart", async (c) => {
    try {
      const mcp = await import("../../mcp/client.ts");
      await mcp.stopAll();
      await mcp.initMCPServers();
      return c.json({ status: "restarted", servers: mcp.listServers() });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });
}
