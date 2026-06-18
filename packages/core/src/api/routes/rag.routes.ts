import { Hono } from "hono";
import { safeMessage } from "../../errors.ts";

export function register(app: Hono): void {
  // --- RAG Pipeline --------------------------------------------
  app.get("/api/rag/documents", async (c) => {
    try {
      const { ragManager } = await import("../../rag/manager.ts");
      const limit = parseInt(c.req.query("limit") || "100");
      const offset = parseInt(c.req.query("offset") || "0");
      const search = c.req.query("search") || "";
      let docs = ragManager.listDocuments();
      if (search) docs = docs.filter((d: any) => d.filename?.toLowerCase().includes(search.toLowerCase()));
      const total = docs.length;
      const paginated = docs.slice(offset, offset + limit);
      return c.json({ documents: paginated, total, offset, limit });
    }
    catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/rag/upload", async (c) => {
    try {
      const { ragManager } = await import("../../rag/manager.ts");
      const ct = c.req.header("content-type") || "";
      if (ct.includes("multipart/form-data")) {
        const fd = await c.req.parseBody();
        const file = fd.file as File;
        if (!file) return c.json({ error: "file required" }, 400);
        const buffer = Buffer.from(await file.arrayBuffer());
        console.log(`[rag] Uploading: ${file.name} (${buffer.length} bytes)`);
        const doc = await ragManager.uploadDocument(file.name, buffer);
        console.log(`[rag] Result: ${file.name} — status=${doc.status}`);
        return c.json({ document: doc }, 201);
      }
      const body = await c.req.json<{ filename: string; content: string }>();
      if (!body.filename || !body.content) return c.json({ error: "filename and content required" }, 400);
      const doc = await ragManager.uploadDocument(body.filename, body.content);
      return c.json({ document: doc }, 201);
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/rag/documents/:id", async (c) => {
    try {
      const { ragManager } = await import("../../rag/manager.ts");
      const doc = ragManager.getDocument(c.req.param("id"));
      if (!doc) return c.json({ error: "Not found" }, 404);
      return c.json({ document: doc });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.get("/api/rag/documents/:id/content", async (c) => {
    try {
      const { ragManager } = await import("../../rag/manager.ts");
      const content = ragManager.getDocumentContent(c.req.param("id"));
      if (!content) return c.json({ error: "Not found" }, 404);
      return c.json({ content });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.delete("/api/rag/documents/:id", async (c) => {
    try {
      const { ragManager } = await import("../../rag/manager.ts");
      const ok = ragManager.deleteDocument(c.req.param("id"));
      if (!ok) return c.json({ error: "Not found" }, 404);
      return c.json({ status: "deleted" });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });

  app.post("/api/rag/query", async (c) => {
    try {
      const { ragManager } = await import("../../rag/manager.ts");
      const body = await c.req.json<{ question: string }>();
      if (!body.question) return c.json({ error: "question required" }, 400);
      const answer = await ragManager.query(body.question);
      return c.json({ answer, question: body.question });
    } catch (e: unknown) { return c.json({ error: safeMessage(e) }, 500); }
  });
}
