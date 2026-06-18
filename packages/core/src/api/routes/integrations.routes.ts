import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";

export function register(app: Hono): void {
  // --- Stock Media Search ----------------------------------------
  app.get("/api/stock/search", async (c) => {
    try {
      const q = c.req.query("q");
      const page = parseInt(c.req.query("page") || "1");
      if (!q) return c.json({ error: "query required" }, 400);
      const apiKey = process.env.PEXELS_API_KEY;
      if (!apiKey) return c.json({ photos: [] });
      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=20&page=${page}&orientation=landscape`, {
        headers: { Authorization: apiKey }, signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return c.json({ error: `Pexels HTTP ${res.status}` }, 502);
      const data = await res.json();
      return c.json({ photos: (data.photos || []).map((p: any) => ({
        id: p.id, url: p.url, photographer: p.photographer,
        src: { medium: p.src?.medium, large: p.src?.large, original: p.src?.original }, alt: p.alt,
      }))});
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // --- Stock Video Search -----------------------------------------
  app.get("/api/stock/video-search", async (c) => {
    try {
      const q = c.req.query("q");
      const page = parseInt(c.req.query("page") || "1");
      if (!q) return c.json({ error: "query required" }, 400);
      const apiKey = process.env.PEXELS_API_KEY;
      if (!apiKey) return c.json({ videos: [] });
      const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=15&page=${page}&orientation=landscape&min_duration=10&max_duration=60`, {
        headers: { Authorization: apiKey }, signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return c.json({ error: `Pexels HTTP ${res.status}` }, 502);
      const data = await res.json();
      return c.json({ videos: (data.videos || []).filter((v: any) => v.duration >= 8).sort((a: any, b: any) => b.duration - a.duration).map((v: any) => {
        // Pick HD file (1280 or 1920 width), fallback to largest available
        const files = v.video_files || [];
        const hd = files.find((f: any) => f.width === 1280 && f.file_type === "video/mp4")
          || files.find((f: any) => f.width === 1920 && f.file_type === "video/mp4")
          || files.filter((f: any) => f.file_type === "video/mp4").sort((a: any, b: any) => b.width - a.width)[0]
          || files[0];
        return {
          id: v.id, url: v.url, photographer: v.user?.name || "Pexels",
          duration: v.duration, width: hd?.width || 0, height: hd?.height || 0,
          videoUrl: hd?.link || "",
          thumbnail: v.image || "",
        };
      })});
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  // --- Music Library ---------------------------------------------
  app.get("/api/music/library", (c) => {
    const tracks = [
      { id: "chill-1", title: "Sunset Chill", artist: "Nexus Audio", duration: 180, genre: "chill", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
      { id: "upbeat-1", title: "Morning Energy", artist: "Nexus Audio", duration: 210, genre: "upbeat", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
      { id: "cinematic-1", title: "Epic Journey", artist: "Nexus Audio", duration: 240, genre: "cinematic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
      { id: "lofi-1", title: "Night Study", artist: "Nexus Audio", duration: 195, genre: "lofi", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
      { id: "corporate-1", title: "Tech Forward", artist: "Nexus Audio", duration: 165, genre: "corporate", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
      { id: "ambient-1", title: "Deep Space", artist: "Nexus Audio", duration: 300, genre: "ambient", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
      { id: "pop-1", title: "Summer Vibes", artist: "Nexus Audio", duration: 200, genre: "pop", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3" },
      { id: "jazz-1", title: "Late Night Jazz", artist: "Nexus Audio", duration: 280, genre: "jazz", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
      { id: "electronic-1", title: "Neon Pulse", artist: "Nexus Audio", duration: 220, genre: "electronic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3" },
      { id: "acoustic-1", title: "Acoustic Dreams", artist: "Nexus Audio", duration: 190, genre: "acoustic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3" },
    ];
    return c.json({ tracks });
  });

  // --- Integrations ---------------------------------------------
  app.get("/api/integrations/services", async (c) => {
    try {
      const { integrationManager } = await import("../../integrations/manager.ts");
      return c.json({ services: integrationManager.listServices() });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/integrations/accounts", async (c) => {
    try {
      const { integrationManager } = await import("../../integrations/manager.ts");
      return c.json({ accounts: integrationManager.listAccounts() });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/integrations/accounts", async (c) => {
    try {
      const { integrationManager } = await import("../../integrations/manager.ts");
      const body = await c.req.json<{ service: string; name: string; config: Record<string, string> }>();
      if (!body.service || !body.name) return c.json({ error: "service and name required" }, 400);
      const acc = integrationManager.addAccount(body.service, body.name, body.config || {});
      return c.json({ account: acc }, 201);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.delete("/api/integrations/accounts/:id", async (c) => {
    try {
      const { integrationManager } = await import("../../integrations/manager.ts");
      const ok = integrationManager.removeAccount(c.req.param("id"));
      if (!ok) return c.json({ error: "Not found" }, 404);
      return c.json({ status: "deleted" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.put("/api/integrations/accounts/:id/toggle", async (c) => {
    try {
      const { integrationManager } = await import("../../integrations/manager.ts");
      const body = await c.req.json<{ enabled: boolean }>();
      const acc = integrationManager.toggleAccount(c.req.param("id"), body.enabled);
      if (!acc) return c.json({ error: "Not found" }, 404);
      return c.json({ account: acc });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/integrations/accounts/:id/test", async (c) => {
    try {
      const { integrationManager } = await import("../../integrations/manager.ts");
      const result = await integrationManager.testConnection(c.req.param("id"));
      return c.json(result);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/integrations/accounts/:id/logs", async (c) => {
    try {
      const { integrationManager } = await import("../../integrations/manager.ts");
      const limit = parseInt(c.req.query("limit") || "20");
      return c.json({ logs: integrationManager.getLogs(c.req.param("id"), limit) });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });
}
