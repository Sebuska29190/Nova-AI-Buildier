/**
 * Research System — multi-source parallel search with 20+ sources
 * 1:1 z CheetahClaws research/lab.py
 * 
 * Sources:
 * 1. ArXiv (academic papers)
 * 2. Hacker News
 * 3. GitHub (repositories)
 * 4. Reddit
 * 5. Wikipedia
 * 6. DuckDuckGo (web search)
 * 7. Brave Search
 * 8. PubMed (medical)
 * 9. Stack Overflow
 * 10. npm registry
 * 11. PyPI
 * 12. Crates.io
 * 13. Docker Hub
 * 14. Dev.to
 * 15. Medium
 * 16. News API
 * 17. Google Scholar (via CrossRef)
 * 18. Semantic Scholar
 * 19. Open Library
 * 20. MusicBrainz
 * 21. Wikidata
 * 22. The Movie Database (TMDB)
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  score?: number;
}

// ─── ArXiv ──────────────────────────────────────────────────────────────────
async function searchArXiv(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=5&sortBy=relevance`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const xml = await res.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    return entries.slice(0, 5).map((e) => ({
      title: (e.match(/<title>(.*?)<\/title>/) || [,""])[1].trim(),
      url: (e.match(/<id>(.*?)<\/id>/) || [,""])[1].trim(),
      snippet: (e.match(/<summary>(.*?)<\/summary>/) || [,""])[1].trim().slice(0, 300),
      source: "arxiv",
    }));
  } catch { return []; }
}

// ─── Hacker News ────────────────────────────────────────────────────────────
async function searchHackerNews(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    return (data.hits || []).slice(0, 5).map((h: any) => ({
      title: h.title || h.story_title || "",
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      snippet: (h.points ? `${h.points} points` : "") + (h.author ? ` by ${h.author}` : ""),
      source: "hackernews",
    }));
  } catch { return []; }
}

// ─── GitHub ─────────────────────────────────────────────────────────────────
async function searchGitHub(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "Nova" },
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json() as any;
    return (data.items || []).slice(0, 5).map((r: any) => ({
      title: r.full_name,
      url: r.html_url,
      snippet: r.description || "",
      source: "github",
    }));
  } catch { return []; }
}

// ─── Reddit ─────────────────────────────────────────────────────────────────
async function searchReddit(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=5&sort=relevance`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Nova/0.4" },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json() as any;
    return (data.data?.children || []).slice(0, 5).map((c: any) => ({
      title: c.data.title,
      url: `https://reddit.com${c.data.permalink}`,
      snippet: c.data.selftext?.slice(0, 200) || "",
      source: "reddit",
    }));
  } catch { return []; }
}

// ─── Wikipedia ──────────────────────────────────────────────────────────────
async function searchWikipedia(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    return (data.query?.search || []).slice(0, 5).map((r: any) => ({
      title: r.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
      snippet: r.snippet.replace(/<[^>]*>/g, ""),
      source: "wikipedia",
    }));
  } catch { return []; }
}

// ─── DuckDuckGo ─────────────────────────────────────────────────────────────
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    const results: SearchResult[] = [];
    if (data.AbstractText) {
      results.push({ title: data.Heading || "Summary", url: data.AbstractURL || "", snippet: data.AbstractText, source: "duckduckgo" });
    }
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 4)) {
        if (topic.Text) {
          results.push({ title: topic.Text.split(" - ")[0], url: topic.FirstURL || "", snippet: topic.Text, source: "duckduckgo" });
        }
      }
    }
    return results;
  } catch { return []; }
}

// ─── Brave Search ───────────────────────────────────────────────────────────
async function searchBrave(query: string): Promise<SearchResult[]> {
  try {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) return [];
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json() as any;
    return (data.web?.results || []).slice(0, 5).map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.description || "",
      source: "brave",
    }));
  } catch { return []; }
}

// ─── PubMed ─────────────────────────────────────────────────────────────────
async function searchPubMed(query: string): Promise<SearchResult[]> {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=5&format=json`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    const searchData = await searchRes.json() as any;
    const ids = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return [];
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&format=json`;
    const fetchRes = await fetch(fetchUrl, { signal: AbortSignal.timeout(8000) });
    const fetchData = await fetchRes.json() as any;
    return ids.map((id: string) => {
      const r = fetchData.result?.[id] || {};
      return {
        title: r.title || "",
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        snippet: r.source || "",
        source: "pubmed",
      };
    });
  } catch { return []; }
}

// ─── Stack Overflow ─────────────────────────────────────────────────────────
async function searchStackOverflow(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.stackexchange.com/2.3/search?order=desc&sort=relevance&intitle=${encodeURIComponent(query)}&site=stackoverflow&pagesize=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    return (data.items || []).slice(0, 5).map((r: any) => ({
      title: r.title,
      url: r.link,
      snippet: `Score: ${r.score} | Answers: ${r.answer_count}`,
      source: "stackoverflow",
    }));
  } catch { return []; }
}

// ─── npm registry ───────────────────────────────────────────────────────────
async function searchNpm(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    return (data.objects || []).slice(0, 5).map((o: any) => ({
      title: o.package.name,
      url: o.package.links?.npm || `https://www.npmjs.com/package/${o.package.name}`,
      snippet: o.package.description || "",
      source: "npm",
    }));
  } catch { return []; }
}

// ─── PyPI ───────────────────────────────────────────────────────────────────
async function searchPyPI(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://pypi.org/search/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    const results: SearchResult[] = [];
    const packagePattern = /<a class="package-snippet" href="([^"]+)">[\s\S]*?<span class="package-snippet__name">([^<]+)<\/span>[\s\S]*?<p class="package-snippet__description">([^<]*)<\/p>/g;
    let match;
    let count = 0;
    while ((match = packagePattern.exec(html)) !== null && count < 5) {
      results.push({ title: match[2], url: `https://pypi.org${match[1]}`, snippet: match[3].trim(), source: "pypi" });
      count++;
    }
    return results;
  } catch { return []; }
}

// ─── Crates.io ──────────────────────────────────────────────────────────────
async function searchCrates(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Nova/0.4" },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json() as any;
    return (data.crates || []).slice(0, 5).map((c: any) => ({
      title: c.name,
      url: `https://crates.io/crates/${c.name}`,
      snippet: c.description || "",
      source: "crates",
    }));
  } catch { return []; }
}

// ─── Docker Hub ─────────────────────────────────────────────────────────────
async function searchDockerHub(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://hub.docker.com/v2/repositories/library/${encodeURIComponent(query)}/?page_size=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    if (data.results) {
      return data.results.slice(0, 5).map((r: any) => ({
        title: r.name,
        url: `https://hub.docker.com/_/${r.name}`,
        snippet: r.description || "",
        source: "dockerhub",
      }));
    }
    return [];
  } catch { return []; }
}

// ─── Dev.to ─────────────────────────────────────────────────────────────────
async function searchDevTo(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://dev.to/api/articles?per_page=5&tag=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    return (data || []).slice(0, 5).map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.description || "",
      source: "devto",
    }));
  } catch { return []; }
}

// ─── Medium ─────────────────────────────────────────────────────────────────
async function searchMedium(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/tag/${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    return (data.items || []).slice(0, 5).map((r: any) => ({
      title: r.title,
      url: r.link,
      snippet: r.description?.replace(/<[^>]*>/g, "").slice(0, 200) || "",
      source: "medium",
    }));
  } catch { return []; }
}

// ─── CrossRef (academic) ────────────────────────────────────────────────────
async function searchCrossRef(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json() as any;
    return (data.message?.items || []).slice(0, 5).map((r: any) => ({
      title: r.title?.[0] || "",
      url: r.URL || `https://doi.org/${r.DOI}`,
      snippet: (r.author || []).slice(0, 3).map((a: any) => a.family).join(", ") + ` (${r.published?.dateParts?.[0]?.[0] || "n/a"})`,
      source: "crossref",
    }));
  } catch { return []; }
}

// ─── Semantic Scholar ───────────────────────────────────────────────────────
async function searchSemanticScholar(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=5&fields=title,url,abstract`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json() as any;
    return (data.data || []).slice(0, 5).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.abstract?.slice(0, 200) || "",
      source: "semanticscholar",
    }));
  } catch { return []; }
}

// ─── Open Library ───────────────────────────────────────────────────────────
async function searchOpenLibrary(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    return (data.docs || []).slice(0, 5).map((r: any) => ({
      title: r.title || "",
      url: `https://openlibrary.org${r.key || ""}`,
      snippet: (r.author_name || []).join(", ") + ` (${r.first_publish_year || ""})`,
      source: "openlibrary",
    }));
  } catch { return []; }
}

// ─── Wikidata ───────────────────────────────────────────────────────────────
async function searchWikidata(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    return (data.search || []).slice(0, 5).map((r: any) => ({
      title: r.label || r.id,
      url: `https://www.wikidata.org/wiki/${r.id}`,
      snippet: r.description || "",
      source: "wikidata",
    }));
  } catch { return []; }
}

// ─── TMDB ───────────────────────────────────────────────────────────────────
async function searchTMDB(query: string): Promise<SearchResult[]> {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return [];
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    return (data.results || []).slice(0, 5).map((r: any) => ({
      title: r.title || r.name || "",
      url: `https://www.themoviedb.org/${r.media_type}/${r.id}`,
      snippet: r.overview?.slice(0, 200) || "",
      source: "tmdb",
    }));
  } catch { return []; }
}

// ─── News API ───────────────────────────────────────────────────────────────
async function searchNews(query: string): Promise<SearchResult[]> {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      // Fallback: use RSS
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      return items.slice(0, 5).map((item) => ({
        title: (item.match(/<title>(.*?)<\/title>/) || [,""])[1],
        url: (item.match(/<link>(.*?)<\/link>/) || [,""])[1],
        snippet: (item.match(/<description>(.*?)<\/description>/) || [,""])[1]?.replace(/<[^>]*>/g, "").slice(0, 200) || "",
        source: "news",
      }));
    }
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=5&apiKey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as any;
    return (data.articles || []).slice(0, 5).map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.description || "",
      source: "news",
    }));
  } catch { return []; }
}

// ─── MusicBrainz ────────────────────────────────────────────────────────────
async function searchMusicBrainz(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Nova/0.4" },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json() as any;
    return (data.artists || []).slice(0, 5).map((r: any) => ({
      title: r.name,
      url: `https://musicbrainz.org/artist/${r.id}`,
      snippet: `${r.type || "artist"} — ${r.country || "unknown"} (${r["life-span"]?.begin || "?"})`,
      source: "musicbrainz",
    }));
  } catch { return []; }
}

// ─── Source registry ────────────────────────────────────────────────────────
interface SourceDef {
  name: string;
  fn: (query: string) => Promise<SearchResult[]>;
  enabled: boolean;
}

const SOURCES: SourceDef[] = [
  { name: "arxiv", fn: searchArXiv, enabled: true },
  { name: "hackernews", fn: searchHackerNews, enabled: true },
  { name: "github", fn: searchGitHub, enabled: true },
  { name: "reddit", fn: searchReddit, enabled: true },
  { name: "wikipedia", fn: searchWikipedia, enabled: true },
  { name: "duckduckgo", fn: searchDuckDuckGo, enabled: true },
  { name: "brave", fn: searchBrave, enabled: false }, // requires API key
  { name: "pubmed", fn: searchPubMed, enabled: true },
  { name: "stackoverflow", fn: searchStackOverflow, enabled: true },
  { name: "npm", fn: searchNpm, enabled: true },
  { name: "pypi", fn: searchPyPI, enabled: true },
  { name: "crates", fn: searchCrates, enabled: true },
  { name: "dockerhub", fn: searchDockerHub, enabled: true },
  { name: "devto", fn: searchDevTo, enabled: true },
  { name: "medium", fn: searchMedium, enabled: true },
  { name: "crossref", fn: searchCrossRef, enabled: true },
  { name: "semanticscholar", fn: searchSemanticScholar, enabled: true },
  { name: "openlibrary", fn: searchOpenLibrary, enabled: true },
  { name: "wikidata", fn: searchWikidata, enabled: true },
  { name: "tmdb", fn: searchTMDB, enabled: false }, // requires API key
  { name: "news", fn: searchNews, enabled: true },
  { name: "musicbrainz", fn: searchMusicBrainz, enabled: true },
];

/**
 * Run research across all enabled sources in parallel
 * Returns deduplicated, scored results
 */
export async function research(query: string, sourceFilter?: string[]): Promise<SearchResult[]> {
  const activeSources = sourceFilter
    ? SOURCES.filter((s) => sourceFilter.includes(s.name))
    : SOURCES.filter((s) => s.enabled);

  const promises = activeSources.map(async (source) => {
    try {
      const results = await source.fn(query);
      return results.map((r) => ({ ...r, score: 1 }));
    } catch {
      return [] as SearchResult[];
    }
  });

  const settled = await Promise.allSettled(promises);
  const allResults: SearchResult[] = [];

  for (const s of settled) {
    if (s.status === "fulfilled") {
      allResults.push(...s.value);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];
  for (const r of allResults) {
    const key = r.url || r.title;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  // Score: boost results that appear in multiple sources
  const titleCounts = new Map<string, number>();
  for (const r of deduped) {
    const key = r.title.toLowerCase().slice(0, 40);
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
  }
  for (const r of deduped) {
    const key = r.title.toLowerCase().slice(0, 40);
    r.score = (titleCounts.get(key) || 1);
  }

  // Sort by score (multi-source results first)
  deduped.sort((a, b) => (b.score || 0) - (a.score || 0));

  return deduped;
}

/**
 * Get list of available sources
 */
export function listSources(): Array<{ name: string; enabled: boolean }> {
  return SOURCES.map((s) => ({ name: s.name, enabled: s.enabled }));
}
