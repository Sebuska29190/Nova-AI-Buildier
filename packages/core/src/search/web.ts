// Web Search provider — zero-cost path via DuckDuckGo + Brave fallback
// Matching CheetahClaws' WebSearch tool pattern

export interface SearchResult {
  title: string; url: string; snippet: string;
  source: string;
}

async function duckDuckGoSearch(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
    const html = await res.text();
    const results: SearchResult[] = [];
    const regex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      results.push({
        url: match[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, "").replace(/&rut=.*$/, ""),
        title: match[2].replace(/<[^>]+>/g, "").trim(),
        snippet: match[3].replace(/<[^>]+>/g, "").trim(),
        source: "duckduckgo",
      });
      if (results.length >= 5) break;
    }
    return results;
  } catch { return []; }
}

async function braveSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
      headers: { "Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": apiKey },
      signal: AbortSignal.timeout(10000),
    });
    const data: any = await res.json();
    return (data.web?.results || []).slice(0, 5).map((r: any) => ({
      title: r.title, url: r.url, snippet: r.description, source: "brave",
    }));
  } catch { return []; }
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  let results = await braveSearch(query);
  if (results.length === 0) results = await duckDuckGoSearch(query);
  return results;
}

// Register as a tool
import { registerTool } from "../plugin/tools.ts";

registerTool({
  name: "web_search",
  description: "Search the web for information",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "Search query" } },
    required: ["query"], additionalProperties: false,
  },
  async execute(args, ctx) {
    const { query } = args as { query: string };
    const results = await webSearch(query);
    if (results.length === 0) return "No results found.";
    return results.map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.snippet}`).join("\n\n");
  },
});
