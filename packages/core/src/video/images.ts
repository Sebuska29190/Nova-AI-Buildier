import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { ImagePrompt } from "./types.ts";

const GRADIENT_PALETTES = [
  ["6366f1", "a78bfa"], ["0d2137", "1b4332"], ["1a1a2e", "16213e"],
  ["2d1b00", "4a2c00"], ["1b0000", "3d0000"], ["002040", "001020"],
  ["2d0030", "1a0020"], ["003030", "002020"],
];

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "shall", "can",
  "need", "dare", "ought", "used", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "above", "below", "between",
  "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how",
  "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "just",
  "because", "if", "while", "about", "up",
]);

const VISUAL_WORDS = new Set([
  "view", "scene", "landscape", "photo", "image", "picture", "background", "graphic",
]);

async function downloadImage(url: string, outPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 5000) return false; // error page, not a real image
    writeFileSync(outPath, Buffer.from(buf));
    return true;
  } catch { return false; }
}

/**
 * Try picsum.photos first, then fall back to loremflickr.com with topic keywords.
 * picsum sometimes returns 403 or other errors.
 * loremflickr supports keyword-based search: loremflickr.com/1920/1080/keyword1,keyword2
 */
async function downloadPicsum(seed: number, outPath: string, query?: string): Promise<boolean> {
  const urls = [
    `https://picsum.photos/seed/${seed}/1920/1080`,
  ];
  if (query) {
    const keywords = query.split(/\s+/).filter(w => w.length > 2).slice(0, 3).join(",");
    if (keywords) {
      urls.push(`https://loremflickr.com/1920/1080/${keywords}`);
      urls.push(`https://loremflickr.com/1920/1080/${keywords.split(",")[0]}`);
    }
  }
  urls.push(`https://loremflickr.com/1920/1080/nature?random=${seed + 1}`);
  for (const url of urls) {
    if (await downloadImage(url, outPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds a search query from keywords matching CheetahClaws Python logic.
 * Filters stop words, short words, and appends visual context if missing.
 */
function buildSearchQuery(keywords: string[], _lang = "en", _topic = ""): string {
  // Filter out stop words and short words, take top 5
  const filtered = keywords.filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase())).slice(0, 5);
  const working = filtered.length > 0 ? filtered : keywords.slice(0, 3);

  // Check if any visual word is present
  const hasVisual = working.some((w) => VISUAL_WORDS.has(w.toLowerCase()));

  let query = working.join(" ");
  if (!hasVisual && working.length > 0) {
    query += " scene photo";
  }
  return query;
}

/**
 * Pexels API — needs PEXELS_API_KEY env var.
 * First priority per CheetahClaws order.
 */
async function searchPexels(query: string, orientation = "landscape"): Promise<string | undefined> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.log("[images] Pexels: no API key set, skipping");
    return undefined;
  }
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encoded}&per_page=10&orientation=${orientation}`,
      { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return undefined;
    const data: any = await res.json();
    const photos = data.photos || [];
    if (photos.length === 0) return undefined;
    // Pick random photo from top results to avoid repeats
    const picked = photos[Math.floor(Math.random() * Math.min(photos.length, 8))];
    const url = picked?.src?.large || undefined;
    if (url) console.log(`[images] Pexels: found image (${photos.length} results)`);
    return url;
  } catch { return undefined; }
}

/**
 * Unsplash API — needs UNSPLASH_ACCESS_KEY env var.
 * Second priority per CheetahClaws order.
 */
async function searchUnsplash(query: string, orientation = "landscape"): Promise<string | undefined> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) {
    console.log("[images] Unsplash: no API key set, skipping");
    return undefined;
  }
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encoded}&per_page=1&orientation=${orientation}&client_id=${apiKey}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return undefined;
    const data: any = await res.json();
    const url = data.results?.[0]?.urls?.regular || undefined;
    if (url) console.log("[images] Unsplash: found image");
    return url;
  } catch { return undefined; }
}

/**
 * Wikimedia Commons — zero API key needed.
 * Third priority per CheetahClaws order.
 * Uses MediaWiki ImageInfo API to resolve the actual image download URL.
 */
async function searchWikimedia(query: string): Promise<string | undefined> {
  try {
    const encoded = encodeURIComponent(query);
    // Single-request approach: generator=search with prop=imageinfo (matches CheetahClaws Python)
    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=File:${encoded}&prop=imageinfo&iiprop=url&iilimit=1&gsrlimit=8&format=json&origin=*`,
      { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "Nova/1.0" } },
    );
    if (!res.ok) return undefined;
    const data: any = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return undefined;
    for (const page of Object.values(pages) as any[]) {
      const ii = page?.imageinfo;
      if (ii && ii.length > 0 && ii[0].url) {
        const url: string = ii[0].url;
        if (/\.(jpg|jpeg|png|webp)$/i.test(url)) {
          console.log("[images] Wikimedia: found image via combined API");
          return url;
        }
      }
    }
    return undefined;
  } catch { return undefined; }
}

/**
 * Flickr API — needs FLICKR_API_KEY env var.
 * Falls back after Wikimedia if key is available.
 */
async function searchFlickr(query: string): Promise<string | undefined> {
  const apiKey = process.env.FLICKR_API_KEY;
  if (!apiKey) {
    console.log("[images] Flickr: no API key set (FLICKR_API_KEY), skipping");
    return undefined;
  }
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${apiKey}&text=${encoded}&format=json&nojsoncallback=1&per_page=5&sort=relevance&content_type=1&media=photos`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return undefined;
    const data: any = await res.json();
    const photos = data?.photos?.photo || [];
    if (photos.length === 0) return undefined;
    // Try each photo until we get a valid URL
    for (const photo of photos) {
      const farmId = photo.farm;
      const serverId = photo.server;
      const id = photo.id;
      const secret = photo.secret;
      const url = `https://farm${farmId}.staticflickr.com/${serverId}/${id}_${secret}_b.jpg`;
      // Return first one — downloadImage will validate it
      // We do a HEAD check to avoid rate-limit issues from downloading multiple
      try {
        const headRes = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
        if (headRes.ok) {
          console.log("[images] Flickr: found image");
          return url;
        }
      } catch {
        continue;
      }
    }
    return undefined;
  } catch { return undefined; }
}

/**
 * Paintings API — uses Harvard Art Museums + MET Museum as fallback.
 * Fourth priority per CheetahClaws order.
 */
async function searchPaintings(query: string): Promise<string | undefined> {
  try {
    const encoded = encodeURIComponent(query);

    // Harvard Art Museums API (needs HARVARD_API_KEY env var)
    const harvardKey = process.env.HARVARD_API_KEY;
    if (harvardKey) {
      const res = await fetch(
        `https://api.harvardartmuseums.org/image?q=${encoded}&size=1&apikey=${harvardKey}`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (res.ok) {
        const data: any = await res.json();
        if (data?.records?.[0]?.baseimageurl) {
          console.log("[images] Harvard Art Museums: found image");
          return data.records[0].baseimageurl;
        }
      }
    }

    // Metropolitan Museum of Art API (no API key needed)
    const searchRes = await fetch(
      `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encoded}&hasImages=true`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!searchRes.ok) return undefined;
    const searchData: any = await searchRes.json();
    const objectIds = searchData.objectIDs;
    if (!objectIds || objectIds.length === 0) return undefined;

    const objRes = await fetch(
      `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectIds[0]}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!objRes.ok) return undefined;
    const objData: any = await objRes.json();
    if (objData.primaryImage) {
      console.log("[images] MET Museum: found image");
    }
    return objData.primaryImage || undefined;
  } catch { return undefined; }
}

/**
 * Download a video file from URL to disk.
 */
async function downloadVideoClip(url: string, outPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 50000) return false; // too small to be a real video
    writeFileSync(outPath, Buffer.from(buf));
    return true;
  } catch { return false; }
}

/**
 * Search Pexels for a video clip and return the HD MP4 URL.
 */
async function searchPexelsVideoClip(query: string): Promise<string | undefined> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.log("[videos] Pexels: no API key set, skipping");
    return undefined;
  }
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encoded}&per_page=15&orientation=landscape&min_duration=10&max_duration=60`,
      { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return undefined;
    const data: any = await res.json();
    const videos = (data.videos || []).filter((v: any) => v.duration >= 8);
    if (videos.length === 0) return undefined;
    // Pick from top results, prefer longer clips (20s+)
    const longClips = videos.filter((v: any) => v.duration >= 20);
    const pool = longClips.length > 0 ? longClips : videos;
    const picked = pool[Math.floor(Math.random() * Math.min(pool.length, 8))];
    const files = picked?.video_files || [];
    // Prefer HD (1280), fallback to SD (960 or 640), then largest
    const hd = files.find((f: any) => f.width === 1280 && f.file_type === "video/mp4")
      || files.find((f: any) => f.width === 1920 && f.file_type === "video/mp4")
      || files.filter((f: any) => f.file_type === "video/mp4").sort((a: any, b: any) => b.width - a.width)[0]
      || files[0];
    if (hd?.link) console.log(`[videos] Pexels: found video clip (${pool.length} results, ${hd.width}x${hd.height}, ${picked.duration}s)`);
    return hd?.link || undefined;
  } catch { return undefined; }
}

/**
 * Download stock video clips from Pexels for each scene prompt.
 * Returns the number of clips successfully downloaded.
 */
export async function generateVideoClips(prompts: ImagePrompt[], outputDir: string, clipCount?: number, stockUrls?: string[], storyContext = ""): Promise<number> {
  mkdirSync(outputDir, { recursive: true });

  const targetCount = Math.max(1, Math.min(20, clipCount ?? 6));

  // Trim or pad prompts to match target count
  let safePrompts: ImagePrompt[];
  if (prompts.length >= targetCount) {
    safePrompts = prompts.slice(0, targetCount);
  } else {
    safePrompts = [...prompts];
    while (safePrompts.length < targetCount) {
      safePrompts.push({ prompt: `Scene ${safePrompts.length + 1}, cinematic video`, timestamp: null, seconds: null });
    }
  }

  let count = 0;
  for (let i = 0; i < safePrompts.length; i++) {
    const outPath = join(outputDir, `clip_${String(i + 1).padStart(2, "0")}.mp4`);
    let downloaded = false;

    // If user provided pre-selected stock video URLs, use those first
    if (stockUrls && stockUrls[i]) {
      console.log(`[videos] Using pre-selected stock video: ${stockUrls[i]}`);
      downloaded = await downloadVideoClip(stockUrls[i], outPath);
      if (downloaded) { count++; continue; }
    }

    // Search Pexels for a matching video clip
    const promptText = safePrompts[i].prompt;
    const words = promptText.split(/\s+/);
    let query = buildSearchQuery(words);
    if (storyContext) {
      const ctxWords = storyContext.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
      const ctxQuery = buildSearchQuery(ctxWords);
      if (ctxQuery && ctxQuery !== query) query = `${query} ${ctxQuery}`;
    }

    if (query) {
      console.log(`[videos] Searching Pexels video for: "${query}"`);
      const url = await searchPexelsVideoClip(query);
      if (url) downloaded = await downloadVideoClip(url, outPath);
      if (downloaded) console.log(`[videos] Downloaded clip: ${outPath}`);
    }

    if (downloaded) {
      count++;
    } else {
      console.log(`[videos] No video clip found for scene ${i + 1}, skipping`);
    }
  }
  return count;
}

export async function generateImages(prompts: ImagePrompt[], outputDir: string, engine: string, isShort = false, imageCount?: number, imageStyle?: string, storyContext = ""): Promise<number> {
  mkdirSync(outputDir, { recursive: true });
  const resW = isShort ? 1080 : 1920;
  const resH = isShort ? 1920 : 1080;

  // User-controlled image count (default 6, min 1, max 20)
  const targetCount = Math.max(1, Math.min(20, imageCount ?? 6));

  // Trim or pad prompts to match target count
  let safePrompts: ImagePrompt[];
  if (prompts.length >= targetCount) {
    safePrompts = prompts.slice(0, targetCount);
  } else {
    safePrompts = [...prompts];
    while (safePrompts.length < targetCount) {
      safePrompts.push({ prompt: `Scene ${safePrompts.length + 1}, establishing shot`, timestamp: null, seconds: null });
    }
  }

  // Treat AI image engine names as synonyms for "web-search" (Nova doesn't have actual API keys)
  const webSearchEngines = new Set(["auto", "web-search", "dalle3", "stable-diffusion", "midjourney", "flux"]);
  const isWebSearch = webSearchEngines.has(engine);

  let count = 0;
  for (let i = 0; i < safePrompts.length; i++) {
    const outPath = join(outputDir, `img_${String(i + 1).padStart(2, "0")}.png`);
    const seed = i + 1 + Date.now();
    let downloaded = false;

    if (isWebSearch) {
      const promptText = safePrompts[i].prompt;
      const styleHint = imageStyle ? `, ${imageStyle}` : "";
      const words = (promptText + styleHint).split(/\s+/);
      let query = buildSearchQuery(words);

      if (query) {
        // Enrich query with story context keywords for better relevance
        if (storyContext) {
          const ctxWords = storyContext.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
          const ctxQuery = buildSearchQuery(ctxWords);
          if (ctxQuery && ctxQuery !== query) query = `${query} ${ctxQuery}`;
        }
        // CheetahClaws order: 1. Pexels -> 2. Unsplash -> 3. Wikimedia -> 4. Flickr -> 5. Paintings
        let url: string | undefined;

        // 1. Pexels (needs API key)
        console.log(`[images] Searching Pexels for: "${query}"`);
        url = await searchPexels(query);
        if (url) downloaded = await downloadImage(url, outPath);
        if (downloaded) console.log(`[images] Downloaded from Pexels: ${outPath}`);

        // 2. Unsplash (needs API key)
        if (!downloaded) {
          console.log(`[images] Searching Unsplash for: "${query}"`);
          url = await searchUnsplash(query);
          if (url) downloaded = await downloadImage(url, outPath);
          if (downloaded) console.log(`[images] Downloaded from Unsplash: ${outPath}`);
        }

        // 3. Lorem Picsum (free stock photos, no API key) — PRIORITY over museums
        if (!downloaded) {
          console.log(`[images] Trying picsum/loremflickr (seed=${seed}, query="${query || 'none'}")`);
          downloaded = await downloadPicsum(seed, outPath, query);
          if (downloaded) console.log(`[images] Downloaded from picsum/loremflickr: ${outPath}`);
        }

        // 4. Flickr (needs FLICKR_API_KEY)
        if (!downloaded) {
          console.log(`[images] Searching Flickr for: "${query}"`);
          url = await searchFlickr(query);
          if (url) downloaded = await downloadImage(url, outPath);
          if (downloaded) console.log(`[images] Downloaded from Flickr: ${outPath}`);
        }

        // 5. Wikimedia (no API key needed, last resort — may return art/religious)
        if (!downloaded) {
          console.log(`[images] Searching Wikimedia Commons for: "${query}"`);
          url = await searchWikimedia(query);
          if (url) downloaded = await downloadImage(url, outPath);
          if (downloaded) console.log(`[images] Downloaded from Wikimedia Commons: ${outPath}`);
        }

        // 6. Paintings (Harvard + MET, no keys needed for MET — absolute last)
        if (!downloaded) {
          console.log(`[images] Searching Paintings APIs for: "${query}"`);
          url = await searchPaintings(query);
          if (url) downloaded = await downloadImage(url, outPath);
          if (downloaded) console.log(`[images] Downloaded from Paintings API: ${outPath}`);
        }
      }
    }

    if (!downloaded) {
      console.log(`[images] All sources failed, generating gradient placeholder for ${outPath}`);
      try {
        await makePlaceholderFFmpeg(outPath, resW, resH, i);
        count++;
      } catch {
        count += writeMinimalPNG(outPath) ? 1 : 0;
      }
    } else {
      count++;
    }
  }
  return count;
}

async function makePlaceholderFFmpeg(outPath: string, w: number, h: number, idx: number): Promise<void> {
  const colors = GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length];
  const ff = Bun.which("ffmpeg") || "ffmpeg";
  const proc = spawn(ff, [
    "-y", "-f", "lavfi", "-i", `color=c=#${colors[0]}:s=${w}x${h}:d=0.04`,
    "-frames:v", "1", outPath,
  ]);
  await new Promise<void>((resolve, reject) => {
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`color PNG ${code}`)));
    proc.on("error", reject);
  });
}

function writeMinimalPNG(outPath: string): boolean {
  try {
    // Minimal valid 1x1 dark pixel PNG
    const png = Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10, // PNG signature
      0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, // IHDR (1x1)
      0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 0, 0, 0, 2, 0, 1, 226, 33, 190, 171, // IDAT
      0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130, // IEND
    ]);
    writeFileSync(outPath, png);
    return true;
  } catch { return false; }
}
