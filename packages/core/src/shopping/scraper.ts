// Shopping Scraper — multi-strategy search for French e-commerce
// Strategy 1: Google Custom Search (prices + images via pagemap/structured data)
// Strategy 2: DuckDuckGo HTML scrape
// Strategy 3: webSearch via Brave/DDG fallback

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const GOOGLE_CX = process.env.GOOGLE_CX || "";

if (!GOOGLE_API_KEY && !GOOGLE_CX) {
  console.warn("[Shopping] No GOOGLE_API_KEY or GOOGLE_CX set — Google Search disabled");
}

export interface Product {
  id: string;
  title: string;
  price: number;
  currency: string;
  source: string;
  image: string;
  url: string;
  description: string;
  rating?: number;
  reviews?: number;
  availability?: string;
}

// Simple 5min cache
const cache = new Map<string, { products: Product[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function parsePrice(text: string): { raw: string; eur?: number } {
  const m1 = text.match(/(\d+[.,]\d{2})\s*€/);
  if (m1) return { raw: m1[0].trim(), eur: parseFloat(m1[1].replace(",", ".")) };
  const m2 = text.match(/€\s*(\d+[.,]\d{2})/);
  if (m2) return { raw: m2[0].trim(), eur: parseFloat(m2[1].replace(",", ".")) };
  return { raw: text };
}

function extractSite(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch { return "unknown"; }
}

// Extract real URL from DuckDuckGo redirect
function cleanUrl(raw: string): string {
  const m = raw.match(/uddg=([^&]+)/);
  if (m) return decodeURIComponent(m[1]);
  return raw;
}

async function tryDuckDuckGo(query: string): Promise<{ results: any[]; success: boolean }> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    if (html.includes("challenge") || html.includes("anomaly")) {
      return { results: [], success: false }; // CAPTCHA'd
    }
    const results: any[] = [];
    // Match each result block — try harder image extraction
    const blockRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    let blockMatch: RegExpExecArray | null;
    while ((blockMatch = blockRegex.exec(html)) !== null) {
      const block = blockMatch[1];
      const urlMatch = block.match(/href="([^"]*)"[^>]*class="result__a"/);
      const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      // Image: try result__thumbnail > img, then any img in block
      let imgSrc = "";
      const thumbMatch = block.match(/class="result__thumbnail"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"/);
      if (thumbMatch) imgSrc = thumbMatch[1];
      if (!imgSrc) {
        const anyImg = block.match(/<img[^>]*src="([^"]*)"[^>]*>/);
        if (anyImg && !anyImg[1].includes("logo") && !anyImg[1].includes("pixel")) imgSrc = anyImg[1];
      }
      if (urlMatch && titleMatch) {
        results.push({
          url: cleanUrl(urlMatch[1]),
          title: titleMatch[1].replace(/<[^>]+>/g, "").trim(),
          snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "",
          image: imgSrc || undefined,
        });
        if (results.length >= 10) break;
      }
    }
    return { results, success: results.length > 0 };
  } catch {
    return { results: [], success: false };
  }
}

export async function searchProducts(opts: {
  query: string;
  minPrice?: number;
  maxPrice?: number;
  site?: string;
  limit?: number;
}): Promise<{ products: Product[]; error?: string }> {
  const { query, minPrice, maxPrice, site, limit = 10 } = opts;

  // Check cache
  const cacheKey = `${query}|${site}|${minPrice}|${maxPrice}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { products: cached.products };
  }

  const siteFilter = site && site !== "all" ? ` site:${site}` : "";
  const searchQuery = `${query}${siteFilter} ${site === "all" ? "france" : ""}`;

  // Strategy 1: Google Custom Search (best — prices, images, ratings)
  let rawResults: any[] = [];
  if (GOOGLE_API_KEY) {
    const gs = await searchGoogleProducts(searchQuery, limit);
    rawResults = gs;
  }

  // Strategy 2: DuckDuckGo
  if (rawResults.length < 5) {
    const ddg = await tryDuckDuckGo(searchQuery);
    for (const r of ddg.results) {
      if (!rawResults.some((x: any) => x.url === r.url)) {
        rawResults.push(r);
      }
    }
  }

  // Strategy 3: webSearch fallback (Brave)
  if (rawResults.length < 5) {
    try {
      const { webSearch } = await import("../search/web.ts");
      const ws = await webSearch(searchQuery);
      for (const r of ws) {
        if (!rawResults.some((x: any) => x.url === r.url)) {
          rawResults.push({ url: r.url, title: r.title, snippet: r.snippet, image: undefined });
        }
      }
    } catch {}
  }

  if (rawResults.length === 0) {
    return { products: [], error: "Wyszukiwarka chwilowo niedostępna. Spróbuj później." };
  }

  // Parse into products
  const products: Product[] = [];
  for (const r of rawResults.slice(0, limit)) {
    const priceInfo = parsePrice((r.title || "") + " " + (r.snippet || ""));
    const siteName = extractSite(r.url);

    if (priceInfo.eur !== undefined) {
      if (minPrice !== undefined && priceInfo.eur < minPrice) continue;
      if (maxPrice !== undefined && priceInfo.eur > maxPrice) continue;
    }

    let availability: string | undefined;
    let image = "";
    let rating: number | undefined;
    let description = "";
    const lower = (r.snippet || "").toLowerCase();
    if (lower.includes("en stock") || lower.includes("disponible")) availability = "in_stock";
    else if (lower.includes("épuisé") || lower.includes("rupture") || lower.includes("en rupture")) availability = "out_of_stock";
    if (r.image) image = r.image;
    if (r.rating) rating = parseFloat(r.rating);
    if (r.description) description = r.description;

    const id = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    products.push({
      id,
      title: r.title || "Unknown product",
      price: priceInfo.eur ?? 0,
      currency: "EUR",
      source: siteName,
      image,
      url: r.url,
      description: description || r.snippet || "",
      rating,
      reviews: undefined,
      availability,
    });
  }

  // Cache and return
  cache.set(cacheKey, { products, ts: Date.now() });
  // Clean old cache entries
  if (cache.size > 50) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > CACHE_TTL) cache.delete(k);
    }
  }

  return { products: products.slice(0, limit) };
}

// Strategy 1 (primary): Google Custom Search JSON API
// Returns structured results with pagemap (images, prices, ratings) when available
async function searchGoogleProducts(query: string, limit = 10): Promise<any[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&hl=fr&gl=fr&num=${Math.min(limit, 10)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  if (!data.items || data.error) {
    if (data.error) console.warn("[Shopping] Google API error:", data.error.message);
    return [];
  }

  const results: any[] = [];
  for (const item of data.items) {
    let image = "";
    let priceEur: number | undefined;
    let rating: string | undefined;

    // Extract image from pagemap
    const pm = item.pagemap;
    if (pm) {
      if (pm.product?.[0]?.image) image = pm.product[0].image;
      else if (pm.thumbnail?.[0]?.src) image = pm.thumbnail[0].src;
      else if (pm.imageobject?.[0]?.url) image = pm.imageobject[0].url;
      else if (pm.cse_image?.[0]?.src) image = pm.cse_image[0].src;

      if (pm.product?.[0]?.offers?.price) {
        priceEur = parseFloat(pm.product[0].offers.price);
      } else if (pm.product?.[0]?.price) {
        priceEur = parseFloat(pm.product[0].price);
      }

      if (pm.aggregaterating?.[0]?.ratingvalue) {
        rating = pm.aggregaterating[0].ratingvalue;
      }
    }

    // Fallback: parse price from snippet/title
    if (priceEur === undefined) {
      const pi = parsePrice((item.title || "") + " " + (item.htmlSnippet || ""));
      priceEur = pi.eur;
    }

    results.push({
      url: item.link,
      title: item.title,
      snippet: item.htmlSnippet?.replace(/<[^>]+>/g, "") || item.snippet || "",
      price: priceEur !== undefined ? `${priceEur.toFixed(2)} EUR` : "",
      priceEur,
      image,
      rating,
    });
  }
  return results;
}
