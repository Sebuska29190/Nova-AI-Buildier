// ─── Session Search Tool (FTS5) ───────────────────────────────
import { registerTool } from "./tools.ts";

registerTool({
  name: "session_search",
  description: "Search past conversations and agent transcripts. Finds relevant sessions using full-text search.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query (words or phrases)" },
      limit: { type: "integer", description: "Max results (default 10)" },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async execute(args: { query: string; limit?: number }) {
    const { sessionManager } = await import("../session/manager.ts");
    const results = sessionManager.searchTranscripts(args.query, args.limit || 10);
    if (results.length === 0) return `No results found for "${args.query}".`;

    const lines = [`Found ${results.length} matches for "${args.query}":`];
    results.forEach((r, i) => {
      const session = sessionManager.getSession(r.sessionId);
      const agent = session?.agentId || "chat";
      lines.push(`${i + 1}. [${agent}] ${r.snippet}`);
      lines.push(`   Session: ${r.sessionId.slice(0, 8)}... (${new Date(session?.createdAt || "").toLocaleDateString()})`);
    });
    return lines.join("\n");
  },
});
