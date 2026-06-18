import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { channelManager } from "../../channel/manager.ts";

export function register(app: Hono): void {
  // Channels
  app.get("/api/channels", (c) => c.json({ channels: channelManager.getChannels() }));
  app.get("/api/channels/configs", (c) => {
    // Return saved channel configs (keys masked) from disk
    try {
      const configsPath = join(process.cwd(), "data", "channel-configs.json");
      if (existsSync(configsPath)) {
        const raw = JSON.parse(readFileSync(configsPath, "utf-8"));
        // Mask sensitive values
        const masked: Record<string, Record<string, string>> = {};
        for (const [chId, cfg] of Object.entries(raw)) {
          masked[chId] = {};
          for (const [k, v] of Object.entries(cfg as Record<string, string>)) {
            const sensitiveKeys = ["token", "botToken", "apiKey", "accessToken", "secret", "password", "authToken"];
            masked[chId][k] = sensitiveKeys.some(sk => k.toLowerCase().includes(sk))
              ? v.slice(0, 8) + "���" + v.slice(-4)
              : v;
          }
        }
        return c.json({ configs: masked });
      }
      return c.json({ configs: {} });
    } catch { return c.json({ configs: {} }); }
  });
  app.post("/api/channels/:id/start", async (c) => {
    const body = await c.req.json<{ token?: string; botToken?: string; chatId?: string; channelId?: string }>();
    try {
      // Fix naming: UI sends botToken but backend expects token
      if (body.botToken && !body.token) body.token = body.botToken;
      await channelManager.start(c.req.param("id"), body as Record<string, string>);
      return c.json({ status: "started" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 400); }
  });
  app.post("/api/channels/:id/stop", async (c) => {
    await channelManager.stop(c.req.param("id"));
    return c.json({ status: "stopped" });
  });
  app.post("/api/channels/:id/test", async (c) => {
    try {
      const result = await channelManager.test(c.req.param("id"));
      return c.json(result);
    } catch (e: unknown) {
      return c.json({ ok: false, message: safeMessage(e) }, 500);
    }
  });
  app.post("/api/channels/report", async (c) => {
    try {
      const channels = channelManager.getChannels();
      const now = new Date().toISOString();
      let report = `Channel Report — ${now}\n${"=".repeat(50)}\n\n`;
      report += `Total channels configured: ${channels.length}\n\n`;
      for (const ch of channels) {
        const configKeys = Object.keys(ch.config || {}).join(", ");
        report += `[${ch.connected ? "ONLINE" : "OFFLINE"}] ${ch.name || ch.id}\n`;
        report += `  ID:        ${ch.id}\n`;
        report += `  Status:    ${ch.connected ? "Connected" : "Disconnected"}\n`;
        report += `  Config:    ${configKeys || "(none)"}\n`;
        report += "\n";
      }
      report += `${"=".repeat(50)}\n`;
      report += `Report generated at: ${now}\n`;
      return c.json({ report });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });

  // --- File Upload ------------------------------------------------------------
  const UPLOAD_DIR = join(process.cwd(), "data", "uploads");

  app.post("/api/upload", async (c) => {
    try {
      const body = await c.req.json<{ files: { name: string; type: string; content: string }[] }>();
      if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
        return c.json({ error: "No files provided" }, 400);
      }
      if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

      const uploaded: { name: string; path: string; size: number }[] = [];
      for (const file of body.files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = join(UPLOAD_DIR, `${Date.now()}-${safeName}`);
        const buffer = Buffer.from(file.content, "base64");
        writeFileSync(filePath, buffer);
        uploaded.push({ name: file.name, path: filePath, size: buffer.length });
      }

      return c.json({ status: "ok", files: uploaded });
    } catch (e: unknown) {
      return c.json({ error: safeMessage(e) }, 500);
    }
  });
}
