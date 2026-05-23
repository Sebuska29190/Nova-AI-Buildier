/**
 * Community Skills — expanded tool registry for all 40+ Nova skills
 *
 * Each skill .md in D:\nova\skills\<category>\ gets a corresponding
 * executable tool registered here so agents can call them at runtime.
 * Sources: CheetahClaws tools, OpenClaw patterns, community requests
 */

import { registerTool } from "./tools.ts";
import { safeMessage } from "../errors.ts";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve, basename, extname, dirname } from "node:path";
import { randomUUID } from "node:crypto";

// ─── Helper: safe bash execution ───────────────────────────────
async function safeExec(cmd: string, timeoutMs = 10000): Promise<string> {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }).trim();
  } catch (e: any) {
    return `Error: ${e.message || e}`;
  }
}

// ─── Helper: fetch JSON ────────────────────────────────────────
async function fetchJSON(url: string, timeoutMs = 8000): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "Nova/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── 1. PLAN — save structured plans ───────────────────────────
registerTool({
  name: "plan_save", description: "Save a structured plan to .cheetahclaws/plans/<name>.md",
  parameters: {
    type: "object", properties: {
      name: { type: "string", description: "Plan name (slug)" },
      content: { type: "string", description: "Full markdown content" },
    }, required: ["name", "content"], additionalProperties: false,
  },
  async execute(args: { name: string; content: string }) {
    const plansDir = join(process.cwd(), ".cheetahclaws/plans");
    mkdirSync(plansDir, { recursive: true });
    const fp = join(plansDir, `${args.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`);
    writeFileSync(fp, args.content, "utf-8");
    return `Plan saved: ${fp}`;
  },
});

registerTool({
  name: "plan_list", description: "List all saved plans",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const plansDir = join(process.cwd(), ".cheetahclaws/plans");
    if (!existsSync(plansDir)) return "No plans directory found.";
    const files = readdirSync(plansDir).filter(f => f.endsWith(".md"));
    if (files.length === 0) return "No plans found.";
    return files.map(f => `  - ${f}`).join("\n");
  },
});

// ─── 2. SKILL AUTHORING — template generator ───────────────────
registerTool({
  name: "skill_create", description: "Generate a new skill .md file from a template",
  parameters: {
    type: "object", properties: {
      name: { type: "string", description: "Skill name (kebab-case)" },
      description: { type: "string", description: "One-line description" },
      triggers: { type: "array", items: { type: "string" }, description: "Trigger keywords" },
      tools: { type: "array", items: { type: "string" }, description: "Required tools" },
      category: { type: "string", description: "Category folder: software-dev, github, research, creative, etc." },
      body: { type: "string", description: "Skill instructions (markdown)" },
    }, required: ["name", "description", "triggers", "tools", "category", "body"], additionalProperties: false,
  },
  async execute(args: { name: string; description: string; triggers: string[]; tools: string[]; category: string; body: string }) {
    const skillsDir = join(process.cwd(), "skills", args.category);
    mkdirSync(skillsDir, { recursive: true });
    const triggersStr = args.triggers.map(t => `"${t}"`).join(", ");
    const toolsStr = args.tools.map(t => `"${t}"`).join(", ");
    const content = `---
description: ${args.description}
triggers: [${triggersStr}]
tools: [${toolsStr}]
version: 1.0.0
author: Nova
license: MIT
metadata:
  nova:
    tags: [${args.category}]
    related_skills: []
---
${args.body}
`;
    const fp = join(skillsDir, `${args.name}.md`);
    writeFileSync(fp, content, "utf-8");
    return `Skill created: ${fp}`;
  },
});

// ─── 3. ARXIV — research paper search ──────────────────────────
registerTool({
  name: "arxiv_search", description: "Search arXiv for academic papers",
  parameters: {
    type: "object", properties: {
      query: { type: "string", description: "Search query" },
      maxResults: { type: "number", description: "Max results (default 10)" },
    }, required: ["query"], additionalProperties: false,
  },
  async execute(args: { query: string; maxResults?: number }) {
    try {
      const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(args.query)}&start=0&max_results=${args.maxResults || 10}&sortBy=relevance&sortOrder=descending`;
      const xml = await (await fetch(url, { signal: AbortSignal.timeout(15000) })).text();
      // Simple parse
      const results: string[] = [];
      const entries = xml.split("<entry>").slice(1);
      for (const entry of entries.slice(0, args.maxResults || 10)) {
        const title = (entry.match(/<title>([^<]*)<\/title>/) || [,""])[1].replace(/\s+/g, " ").trim();
        const summary = (entry.match(/<summary>([^<]*)<\/summary>/) || [,""])[1].replace(/\s+/g, " ").trim().slice(0, 200);
        const link = (entry.match(/<id>([^<]*)<\/id>/) || [,""])[1];
        const authors = entry.match(/<author>[\s\S]*?<name>([^<]*)<\/name>[\s\S]*?<\/author>/g) || [];
        const authorNames = authors.map((a: string) => (a.match(/<name>([^<]*)<\/name>/) || [,""])[1]).slice(0, 3).join(", ");
        results.push(`**${title}**\n   Authors: ${authorNames || "N/A"}\n   Abstract: ${summary}...\n   ${link}\n`);
      }
      return results.length ? results.join("\n") : "No results found.";
    } catch (e: any) {
      return `arXiv search error: ${e.message}`;
    }
  },
});

// ─── 4. GIF SEARCH — Tenor API ─────────────────────────────────
registerTool({
  name: "gif_search", description: "Search for GIFs via Tenor API",
  parameters: {
    type: "object", properties: {
      query: { type: "string", description: "Search term" },
      limit: { type: "number", description: "Max results (default 5)" },
    }, required: ["query"], additionalProperties: false,
  },
  async execute(args: { query: string; limit?: number }) {
    try {
      const data = await fetchJSON(`https://g.tenor.com/v1/search?q=${encodeURIComponent(args.query)}&limit=${args.limit || 5}&contentfilter=medium`);
      if (!data.results?.length) return "No GIFs found.";
      return data.results.map((r: any, i: number) =>
        `${i + 1}. **${r.title || "GIF"}**\n   URL: ${r.url}\n   Preview: ${r.media?.[0]?.tinygif?.url || ""}`
      ).join("\n");
    } catch (e: any) {
      return `GIF search error: ${e.message}`;
    }
  },
});

// ─── 5. SPOTIFY — search tracks ────────────────────────────────
registerTool({
  name: "spotify_search", description: "Search Spotify for tracks, albums, or artists",
  parameters: {
    type: "object", properties: {
      query: { type: "string", description: "Search query" },
      type: { type: "string", enum: ["track", "artist", "album"], description: "Search type (default track)" },
      limit: { type: "number", description: "Max results (default 10)" },
    }, required: ["query"], additionalProperties: false,
  },
  async execute(args: { query: string; type?: string; limit?: number }) {
    const token = process.env.SPOTIFY_ACCESS_TOKEN || process.env.SPOTIFY_TOKEN;
    if (!token) return "Spotify token not configured. Set SPOTIFY_ACCESS_TOKEN in .env";
    try {
      const data = await fetchJSON(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(args.query)}&type=${args.type || "track"}&limit=${args.limit || 10}`,
        { headers: { Authorization: `Bearer ${token}` } } as any
      );
      const items = data.tracks?.items || data.artists?.items || data.albums?.items || [];
      if (!items.length) return "No results found.";
      return items.map((i: any, idx: number) =>
        `${idx + 1}. **${i.name}** ${i.artists ? `by ${i.artists.map((a: any) => a.name).join(", ")}` : ""}`
      ).join("\n");
    } catch (e: any) {
      return `Spotify search error: ${e.message}`;
    }
  },
});

// ─── 6. YOUTUBE — search videos ────────────────────────────────
registerTool({
  name: "youtube_search", description: "Search YouTube for videos",
  parameters: {
    type: "object", properties: {
      query: { type: "string", description: "Search query" },
      maxResults: { type: "number", description: "Max results (default 10)" },
    }, required: ["query"], additionalProperties: false,
  },
  async execute(args: { query: string; maxResults?: number }) {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) return "YouTube API key not configured. Set YOUTUBE_API_KEY in .env";
    try {
      const data = await fetchJSON(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(args.query)}&maxResults=${args.maxResults || 10}&type=video&key=${key}`
      );
      if (!data.items?.length) return "No videos found.";
      return data.items.map((v: any, i: number) =>
        `${i + 1}. **${v.snippet.title}**\n   Channel: ${v.snippet.channelTitle}\n   https://youtu.be/${v.id.videoId}`
      ).join("\n");
    } catch (e: any) {
      return `YouTube search error: ${e.message}`;
    }
  },
});

// ─── 7. GITHUB — search repos ──────────────────────────────────
registerTool({
  name: "github_search", description: "Search GitHub for repositories",
  parameters: {
    type: "object", properties: {
      query: { type: "string", description: "Search query" },
      limit: { type: "number", description: "Max results (default 10)" },
    }, required: ["query"], additionalProperties: false,
  },
  async execute(args: { query: string; limit?: number }) {
    try {
      const data = await fetchJSON(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(args.query)}&per_page=${args.limit || 10}&sort=stars`,
      );
      if (!data.items?.length) return "No repos found.";
      return data.items.map((r: any, i: number) =>
        `${i + 1}. **${r.full_name}** ⭐${r.stargazers_count}\n   ${r.description || "No description"}\n   ${r.html_url}`
      ).join("\n");
    } catch (e: any) {
      return `GitHub search error: ${e.message}`;
    }
  },
});

registerTool({
  name: "github_create_issue", description: "Create a GitHub issue using gh CLI",
  parameters: {
    type: "object", properties: {
      title: { type: "string", description: "Issue title" },
      body: { type: "string", description: "Issue body (markdown)" },
      labels: { type: "string", description: "Comma-separated labels (optional)" },
    }, required: ["title", "body"], additionalProperties: false,
  },
  async execute(args: { title: string; body: string; labels?: string }) {
    const cmd = `gh issue create --title "${args.title.replace(/"/g, '\\"')}" --body "${args.body.replace(/"/g, '\\"')}" ${args.labels ? `--label "${args.labels}"` : ""}`;
    const result = await safeExec(cmd, 15000);
    return result || "Issue created";
  },
});

registerTool({
  name: "github_list_issues", description: "List open GitHub issues",
  parameters: {
    type: "object", properties: {
      limit: { type: "number", description: "Max results (default 20)" },
      state: { type: "string", enum: ["open", "closed", "all"], description: "Issue state" },
    }, additionalProperties: false,
  },
  async execute(args: { limit?: number; state?: string }) {
    const result = await safeExec(`gh issue list --limit ${args.limit || 20} ${args.state ? `--state ${args.state}` : ""}`, 10000);
    return result || "No issues found.";
  },
});

registerTool({
  name: "github_pr_create", description: "Create a GitHub Pull Request",
  parameters: {
    type: "object", properties: {
      title: { type: "string", description: "PR title" },
      body: { type: "string", description: "PR body (markdown)" },
      head: { type: "string", description: "Head branch (default: current)" },
      base: { type: "string", description: "Base branch (default: main)" },
    }, required: ["title", "body"], additionalProperties: false,
  },
  async execute(args: { title: string; body: string; head?: string; base?: string }) {
    const cmd = `gh pr create --title "${args.title.replace(/"/g, '\\"')}" --body "${args.body.replace(/"/g, '\\"')}" ${args.base ? `--base ${args.base}` : ""}`;
    const result = await safeExec(cmd, 20000);
    return result || "PR created";
  },
});

registerTool({
  name: "github_review_pr", description: "Review a GitHub Pull Request with inline comments",
  parameters: {
    type: "object", properties: {
      prNumber: { type: "number", description: "PR number" },
      body: { type: "string", description: "Review summary" },
      event: { type: "string", enum: ["APPROVE", "REQUEST_CHANGES", "COMMENT"], description: "Review action" },
    }, required: ["prNumber", "body", "event"], additionalProperties: false,
  },
  async execute(args: { prNumber: number; body: string; event: string }) {
    const cmd = `gh pr review ${args.prNumber} --${args.event.toLowerCase().replace(/_/g, "-")} --body "${args.body.replace(/"/g, '\\"')}"`;
    const result = await safeExec(cmd, 15000);
    return result || "Review submitted";
  },
});

// ─── 8. X/TWITTER — search tweets ─────────────────────────────
registerTool({
  name: "twitter_search", description: "Search recent tweets via X/Twitter API v2",
  parameters: {
    type: "object", properties: {
      query: { type: "string", description: "Search query" },
      maxResults: { type: "number", description: "Max results (default 10)" },
    }, required: ["query"], additionalProperties: false,
  },
  async execute(args: { query: string; maxResults?: number }) {
    const token = process.env.TWITTER_BEARER_TOKEN;
    if (!token) return "Twitter bearer token not configured. Set TWITTER_BEARER_TOKEN in .env";
    try {
      const data = await fetchJSON(
        `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(args.query)}&max_results=${args.maxResults || 10}&tweet.fields=created_at,public_metrics,author_id`,
        { headers: { Authorization: `Bearer ${token}` } } as any
      );
      if (!data.data?.length) return "No tweets found.";
      return data.data.map((t: any, i: number) =>
        `${i + 1}. ${t.text.slice(0, 200)}\n   ❤️${t.public_metrics?.like_count || 0} 🔁${t.public_metrics?.retweet_count || 0}\n   🕐${t.created_at || ""}`
      ).join("\n\n");
    } catch (e: any) {
      return `Twitter search error: ${e.message}`;
    }
  },
});

// ─── 9. JUPYTER — notebook management ──────────────────────────
registerTool({
  name: "jupyter_list_kernels", description: "List available Jupyter kernels",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    return await safeExec("jupyter kernelspec list 2>&1", 8000);
  },
});

// ─── 10. DIAGRAMS — architecture SVG ───────────────────────────
registerTool({
  name: "diagram_architecture", description: "Generate a dark-theme SVG architecture diagram as an HTML file",
  parameters: {
    type: "object", properties: {
      title: { type: "string", description: "Diagram title" },
      components: { type: "array", items: { type: "string" }, description: "System components to include" },
      outputFile: { type: "string", description: "Output file path (optional, default: diagram.html)" },
    }, required: ["title", "components"], additionalProperties: false,
  },
  async execute(args: { title: string; components: string[]; outputFile?: string }) {
    const svgW = 800;
    const boxH = 60;
    const gap = 40;
    const boxW = 200;
    const startY = 120;
    const totalH = startY + args.components.length * (boxH + gap) + 80;

    let svg = `<svg viewBox="0 0 ${svgW} ${totalH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0f10"/>
      <stop offset="100%" stop-color="#11181a"/>
    </linearGradient>
    <filter id="glow">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#2dd4bf" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="${svgW}" height="${totalH}" fill="url(#bg)"/>
  <text x="${svgW/2}" y="50" fill="#ece6da" font-family="monospace" font-size="24" text-anchor="middle" font-weight="bold">${args.title}</text>
  <line x1="100" y1="80" x2="${svgW-100}" y2="80" stroke="#253a3c" stroke-width="1"/>`;

    args.components.forEach((comp, i) => {
      const y = startY + i * (boxH + gap);
      const x = (svgW - boxW) / 2;
      svg += `
  <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="8" fill="#131a1c" stroke="#2dd4bf" stroke-width="1.5" filter="url(#glow)"/>
  <text x="${svgW/2}" y="${y + boxH/2 + 5}" fill="#2dd4bf" font-family="monospace" font-size="13" text-anchor="middle">${comp}</text>`;
      if (i < args.components.length - 1) {
        const y2 = y + boxH + gap / 2;
        svg += `
  <line x1="${svgW/2}" y1="${y + boxH}" x2="${svgW/2}" y2="${y2}" stroke="#2dd4bf" stroke-width="1.5" stroke-dasharray="4,4"/>
  <polygon points="${svgW/2 - 5},${y2} ${svgW/2 + 5},${y2} ${svgW/2},${y2 + 8}" fill="#2dd4bf"/>`;
      }
    });

    svg += `\n</svg>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.title}</title><style>body{margin:0;background:#0a0f10;display:flex;justify-content:center;padding:20px}</style></head><body>${svg}</body></html>`;

    const fp = resolve(args.outputFile || "diagram.html");
    writeFileSync(fp, html, "utf-8");
    return `Architecture diagram saved: ${fp}\n\nPreview the HTML file in a browser.`;
  },
});

// ─── 11. EXCALIDRAW — hand-drawn diagrams ──────────────────────
registerTool({
  name: "excalidraw_generate", description: "Generate an Excalidraw-compatible JSON scene",
  parameters: {
    type: "object", properties: {
      title: { type: "string", description: "Diagram title" },
      elements: { type: "array", items: { type: "object" }, description: "Array of {type, x, y, width, height, label}" },
      outputFile: { type: "string", description: "Output .excalidraw file path" },
    }, required: ["title", "elements"], additionalProperties: false,
  },
  async execute(args: { title: string; elements: any[]; outputFile?: string }) {
    const excElements = args.elements.map((el, i) => ({
      id: `el-${i}`,
      type: el.type || "rectangle",
      x: el.x || 100,
      y: el.y || 100 + i * 100,
      width: el.width || 200,
      height: el.height || 60,
      strokeColor: "#2dd4bf",
      backgroundColor: "#131a1c",
      fillStyle: "solid",
      strokeWidth: 1,
      roughness: 1,
      opacity: 100,
      groupIds: [] as string[],
      roundness: { type: 3 },
      boundElements: el.label ? [{ type: "text", id: `text-${i}` }] : [],
      updated: Date.now(),
      link: null as string | null,
      locked: false,
    }));
    if (args.elements.some((el: any) => el.label)) {
      args.elements.forEach((el: any, i: number) => {
        if (!el.label) return;
        excElements.push({
          id: `text-${i}`,
          type: "text",
          x: (el.x || 100) + 10,
          y: (el.y || 100 + i * 100) + 15,
          width: (el.width || 200) - 20,
          height: 30,
          text: el.label,
          fontSize: 16,
          fontFamily: 2,
          textAlign: "left",
          strokeColor: "#ece6da",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          roughness: 1,
          opacity: 100,
          groupIds: [] as string[],
          roundness: null,
          boundElements: null,
          updated: Date.now(),
          link: null,
          locked: false,
        });
      });
    }

    const scene = {
      type: "excalidraw",
      version: 2,
      source: "Nova AI",
      elements: excElements,
      appState: {
        viewBackgroundColor: "#0a0f10",
        currentItemStrokeColor: "#2dd4bf",
        currentItemBackgroundColor: "#131a1c",
      },
    };

    const fp = resolve(args.outputFile || `diagram-${randomUUID().slice(0, 8)}.excalidraw`);
    writeFileSync(fp, JSON.stringify(scene, null, 2), "utf-8");
    return `Excalidraw scene saved: ${fp}\n\nOpen with: https://excalidraw.com/#json=${Buffer.from(JSON.stringify(scene)).toString("base64url").slice(0, 100)}...`;
  },
});

// ─── 12. OPENHUE — Philips Hue control ─────────────────────────
registerTool({
  name: "openhue_control", description: "Control Philips Hue lights: on/off, brightness, color",
  parameters: {
    type: "object", properties: {
      action: { type: "string", enum: ["on", "off", "brightness", "color"], description: "Action to perform" },
      lightId: { type: "string", description: "Light ID or 'all' (default: all)" },
      value: { type: "number", description: "Brightness 1-254 or hue 0-65535" },
    }, required: ["action"], additionalProperties: false,
  },
  async execute(args: { action: string; lightId?: string; value?: number }) {
    const bridge = process.env.HUE_BRIDGE_IP;
    const key = process.env.HUE_API_KEY;
    if (!bridge || !key) return "Hue bridge not configured. Set HUE_BRIDGE_IP and HUE_API_KEY.";
    try {
      const base = `https://${bridge}/api/${key}`;
      if (args.action === "on" || args.action === "off") {
        const target = args.lightId && args.lightId !== "all" ? `lights/${args.lightId}/state` : "groups/0/action";
        await fetchJSON(`${base}/${target}`, { method: "PUT", body: JSON.stringify({ on: args.action === "on" }), headers: { "Content-Type": "application/json" } } as any);
        return `Lights turned ${args.action}`;
      }
      if (args.action === "brightness" && args.value) {
        const target = args.lightId && args.lightId !== "all" ? `lights/${args.lightId}/state` : "groups/0/action";
        await fetchJSON(`${base}/${target}`, { method: "PUT", body: JSON.stringify({ bri: Math.min(254, Math.max(1, args.value)) }), headers: { "Content-Type": "application/json" } } as any);
        return `Brightness set to ${args.value}`;
      }
      return "Action completed (check lights).";
    } catch (e: any) {
      return `Hue control error: ${e.message}`;
    }
  },
});

// ─── 13. COMMUNITY SKILLS DOWNLOAD ──────────────────────────────
registerTool({
  name: "community_skills_download", description: "Download community skills from GitHub repositories",
  parameters: {
    type: "object", properties: {
      repo: { type: "string", description: "GitHub repo URL or 'cheetahclaws/skills' shorthand (default: cheetahclaws/skills)" },
      skill: { type: "string", description: "Specific skill name to download (omit for all)" },
      category: { type: "string", description: "Target category folder (omit for auto-detect)" },
    }, additionalProperties: false,
  },
  async execute(args: { repo?: string; skill?: string; category?: string }) {
    const repoUrl = args.repo || "cheetahclaws/skills";
    const normalized = repoUrl.includes("github.com") ? repoUrl : `https://github.com/${repoUrl}`;
    const rawBase = normalized.replace("github.com", "raw.githubusercontent.com").replace(/\.git$/, "") + "/main";
    const skillsDir = join(process.cwd(), "skills");

    try {
      if (args.skill) {
        // Download single .md file
        const cat = args.category || "community";
        const targetDir = join(skillsDir, cat);
        mkdirSync(targetDir, { recursive: true });
        const url = `${rawBase}/${args.skill}.md`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
          // Try with .md extension
          const url2 = `${rawBase}/${args.skill}`;
          const res2 = await fetch(url2, { signal: AbortSignal.timeout(10000) });
          if (!res2.ok) return `Skill not found at ${url} or ${url2}`;
          writeFileSync(join(targetDir, basename(url2)), await res2.text(), "utf-8");
          return `Downloaded: ${args.skill} -> ${targetDir}`;
        }
        writeFileSync(join(targetDir, `${args.skill}.md`), await res.text(), "utf-8");
        return `Downloaded: ${args.skill}.md -> ${targetDir}`;
      } else {
        // Try to list files from the repo
        const apiUrl = normalized.replace("github.com", "api.github.com/repos").replace(/\.git$/, "") + "/contents";
        const data = await fetchJSON(apiUrl);
        const mdFiles = (Array.isArray(data) ? data : []).filter((f: any) => f.name?.endsWith(".md"));
        if (!mdFiles.length) {
          return `No .md files found at ${apiUrl}. Try specifying a skill name directly.`;
        }
        let count = 0;
        for (const f of mdFiles) {
          const cat2 = args.category || "community";
          const targetDir = join(skillsDir, cat2);
          mkdirSync(targetDir, { recursive: true });
          const res = await fetch(f.download_url, { signal: AbortSignal.timeout(10000) });
          if (res.ok) {
            writeFileSync(join(targetDir, f.name), await res.text(), "utf-8");
            count++;
          }
        }
        return `Downloaded ${count} skills from ${repoUrl} to skills/${args.category || "community"}/`;
      }
    } catch (e: any) {
      return `Download error: ${e.message}\n\nTried repo: ${normalized}`;
    }
  },
});

// ─── 14. SKILLS LIST — list all available skills ───────────────
registerTool({
  name: "skills_list", description: "List all available skills organized by category",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const skillsDir = join(process.cwd(), "skills");
    if (!existsSync(skillsDir)) return "No skills directory found.";
    const cats = readdirSync(skillsDir).filter(f => statSync(join(skillsDir, f)).isDirectory());
    const rootFiles = readdirSync(skillsDir).filter(f => f.endsWith(".md"));
    const lines: string[] = [];
    if (rootFiles.length) {
      lines.push("## Root Skills");
      rootFiles.forEach(f => lines.push(`  - ${f}`));
    }
    for (const cat of cats.sort()) {
      const catDir = join(skillsDir, cat);
      const files = readdirSync(catDir).filter(f => f.endsWith(".md"));
      if (files.length) {
        lines.push(`\n## ${cat} (${files.length})`);
        files.forEach(f => lines.push(`  - ${f.replace(/\.md$/, "")}`));
      }
    }
    return lines.join("\n") || "No skills found.";
  },
});

// ─── 15. KANBAN — task orchestration ────────────────────────────
registerTool({
  name: "kanban_summary", description: "Generate a Kanban-style summary of current tasks",
  parameters: { type: "object", properties: {
    includeCompleted: { type: "boolean", description: "Include completed tasks (default: false)" },
  }, additionalProperties: false },
  async execute(args: { includeCompleted?: boolean }) {
    try {
      const { listTools: listAgentTools } = await import("./tools.ts");
      // Fall through to using shell if available
      return "Use /tasks command to view the task board.\n\nColumns:\n- Backlog | To Do | In Progress | Review | Done\n\nRun `nova tasks list` for current state.";
    } catch {
      return "Kanban: use /tasks or check .tasks/ directory.";
    }
  },
});

// ─── 16. OBSIDIAN — vault operations ───────────────────────────
registerTool({
  name: "obsidian_create_note", description: "Create a note in Obsidian vault",
  parameters: {
    type: "object", properties: {
      title: { type: "string", description: "Note title" },
      content: { type: "string", description: "Note content (markdown)" },
      vault: { type: "string", description: "Vault path (default: ~/obsidian-vault)" },
      folder: { type: "string", description: "Subfolder name (optional)" },
    }, required: ["title", "content"], additionalProperties: false,
  },
  async execute(args: { title: string; content: string; vault?: string; folder?: string }) {
    const vaultPath = resolve(args.vault || join(process.env.HOME || process.env.USERPROFILE || "~", "obsidian-vault"));
    if (!existsSync(vaultPath)) return `Obsidian vault not found at ${vaultPath}. Create it first or specify a vault path.`;
    const targetDir = args.folder ? join(vaultPath, args.folder) : vaultPath;
    mkdirSync(targetDir, { recursive: true });
    const slug = args.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "note";
    const note = `---
tags: []
created: ${new Date().toISOString().split("T")[0]}
aliases: [${args.title}]
---
# ${args.title}

${args.content}
`;
    const fp = join(targetDir, `${slug}.md`);
    writeFileSync(fp, note, "utf-8");
    return `Note created: ${fp}`;
  },
});

// ─── 17. POWERPOINT — generate pptx ────────────────────────────
registerTool({
  name: "powerpoint_generate", description: "Generate a PowerPoint presentation via Python",
  parameters: {
    type: "object", properties: {
      title: { type: "string", description: "Presentation title" },
      slides: { type: "array", items: { type: "object", properties: { title: { type: "string" }, content: { type: "array", items: { type: "string" } } } }, description: "Array of slide objects: {title, content: [bullets]}" },
      outputFile: { type: "string", description: "Output .pptx file path" },
    }, required: ["title", "slides"], additionalProperties: false,
  },
  async execute(args: { title: string; slides: Array<{ title: string; content?: string[] }>; outputFile?: string }) {
    const fp = resolve(args.outputFile || `${args.title.replace(/[^a-zA-Z0-9]/g, "_")}.pptx`);
    // Write a Python script and execute it
    const pyScript = `
from pptx import Presentation
from pptx.util import Inches, Pt
prs = Presentation()
slides_data = ${JSON.stringify(args.slides)}
for i, sd in enumerate(slides_data):
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    if slide.shapes.title:
        slide.shapes.title.text = sd.get('title', 'Slide ' + str(i+1))
    content = sd.get('content', [])
    if content and slide.placeholders:
        tf = slide.placeholders[1].text_frame if len(slide.placeholders) > 1 else slide.shapes.add_textbox(Inches(1), Inches(2), Inches(8), Inches(5)).text_frame
        tf.clear()
        for j, bullet in enumerate(content):
            if j == 0:
                tf.text = bullet
            else:
                p = tf.add_paragraph()
                p.text = bullet
prs.save(r'${fp.replace(/\\/g, "\\\\")}')
print('OK')
`;
    const pyFp = join(process.env.TEMP || "/tmp", `nova_pptx_${randomUUID().slice(0, 8)}.py`);
    writeFileSync(pyFp, pyScript, "utf-8");
    try {
      const result = execSync(`python "${pyFp}"`, { encoding: "utf-8", timeout: 15000 });
      return `Presentation saved: ${fp}`;
    } catch (e: any) {
      return `PPTX generation error: ${e.message}\n\nInstall python-pptx: pip install python-pptx`;
    } finally {
      try { execSync(`del "${pyFp}"`); } catch {}
    }
  },
});

// ─── 18. OCR — text extraction ─────────────────────────────────
registerTool({
  name: "ocr_extract", description: "Extract text from an image using Tesseract OCR",
  parameters: {
    type: "object", properties: {
      imagePath: { type: "string", description: "Path to the image file" },
      language: { type: "string", description: "OCR language (default: eng)" },
    }, required: ["imagePath"], additionalProperties: false,
  },
  async execute(args: { imagePath: string; language?: string }) {
    const fp = resolve(args.imagePath);
    if (!existsSync(fp)) return `File not found: ${fp}`;
    const lang = args.language || "eng";
    const outFp = join(process.env.TEMP || "/tmp", `nova_ocr_${randomUUID().slice(0, 8)}`);
    try {
      execSync(`tesseract "${fp}" "${outFp}" -l ${lang} 2>&1`, { encoding: "utf-8", timeout: 30000 });
      const text = readFileSync(`${outFp}.txt`, "utf-8");
      return text.trim() || "No text extracted.";
    } catch (e: any) {
      return `OCR error: ${e.message}\n\nInstall Tesseract: https://github.com/UB-Mannheim/tesseract/wiki`;
    } finally {
      try { execSync(`del "${outFp}.txt" 2>nul`); } catch {}
    }
  },
});

// ─── 19. LLM WIKI — build project wiki ─────────────────────────
registerTool({
  name: "wiki_build", description: "Generate wiki index files for the project",
  parameters: {
    type: "object", properties: {
      sections: { type: "array", items: { type: "string" }, description: "Section names: architecture, api, config, development" },
      outputDir: { type: "string", description: "Output directory (default: docs/wiki/)" },
    }, required: ["sections"], additionalProperties: false,
  },
  async execute(args: { sections: string[]; outputDir?: string }) {
    const wikiDir = resolve(args.outputDir || "docs/wiki");
    mkdirSync(wikiDir, { recursive: true });
    const templates: Record<string, string> = {
      architecture: `# Architecture\n\n## Overview\n\n[Describe system architecture here]\n\n## Components\n\n- Component 1: [description]\n- Component 2: [description]\n\n## Data Flow\n\n\`\`\`\n[flow diagram]\n\`\`\`\n`,
      api: `# API Reference\n\n## Endpoints\n\n### GET /api/...\n\n- Description:\n- Parameters:\n- Response:\n\n### POST /api/...\n\n- Description:\n- Request body:\n- Response:\n`,
      config: `# Configuration\n\n## Environment Variables\n\n| Variable | Default | Description |\n|----------|---------|-------------|\n| \`NOVA_API_KEY\` | - | API key |\n\n## Config File\n\nLocation: \`.env\` or config file\n`,
      development: `# Development\n\n## Setup\n\n1. Clone the repo\n2. Install dependencies: \`npm install\`\n3. Build: \`npm run build\`\n\n## Testing\n\n\`npm test\`\n\n## Deployment\n\n[deployment steps]\n`,
    };
    let created: string[] = [];
    for (const section of args.sections) {
      const key = section.toLowerCase();
      const content = templates[key] || `# ${section}\n\n[Content for ${section}]\n`;
      const fp = join(wikiDir, `${key}.md`);
      if (!existsSync(fp)) {
        writeFileSync(fp, content, "utf-8");
        created.push(fp);
      }
    }
    // Create index
    const indexPath = join(wikiDir, "index.md");
    if (!existsSync(indexPath)) {
      const links = args.sections.map(s => `- [${s}](${s.toLowerCase()}.md)`).join("\n");
      writeFileSync(indexPath, `# Project Wiki\n\n${links}\n\n---\n*Auto-generated by Nova*\n`, "utf-8");
      created.unshift(indexPath);
    }
    return created.length ? `Created:\n${created.map(f => `  - ${f}`).join("\n")}\n\nEdit these files to add content.` : "Wiki files already exist. Edit them manually.";
  },
});

// ─── 20. WIKI — search existing wikis ──────────────────────────
registerTool({
  name: "wiki_search", description: "Search wiki files for content",
  parameters: {
    type: "object", properties: {
      query: { type: "string", description: "Search term" },
      wikiDir: { type: "string", description: "Wiki directory (default: docs/wiki/)" },
    }, required: ["query"], additionalProperties: false,
  },
  async execute(args: { query: string; wikiDir?: string }) {
    const dir = resolve(args.wikiDir || "docs/wiki");
    if (!existsSync(dir)) return "No wiki directory found.";
    const files = readdirSync(dir).filter(f => f.endsWith(".md"));
    const results: string[] = [];
    for (const f of files) {
      const content = readFileSync(join(dir, f), "utf-8");
      if (content.toLowerCase().includes(args.query.toLowerCase())) {
        const lines = content.split("\n").filter((l: string) => l.toLowerCase().includes(args.query.toLowerCase()));
        results.push(`${f}:\n${lines.map((l: string) => `  > ${l.trim().slice(0, 100)}`).join("\n")}`);
      }
    }
    return results.length ? results.join("\n\n") : `No results for "${args.query}"`;
  },
});

// ─── TTS Tool (v0.5.0) ──────────────────────────────────────────
registerTool({
  name: "tts_speak",
  description: "Synthesize text to speech audio. Supports: edge (free), openai, elevenlabs, gtts",
  source: "community",
  schema: {
    type: "object", properties: {
      text: { type: "string", description: "Text to convert to speech" },
      provider: { type: "string", enum: ["edge", "openai", "elevenlabs", "gtts"], description: "TTS provider (default: edge)" },
      voice: { type: "string", description: "Voice ID or name. Use tts_list_voices to see options" },
      speed: { type: "number", description: "Speech speed multiplier (0.5-2.0, default: 1.0)" },
    }, required: ["text"], additionalProperties: false,
  },
  async execute(args: { text: string; provider?: string; voice?: string; speed?: number }) {
    const { synthesizeSpeech } = await import("../voice/tts.ts");
    try {
      const result = await synthesizeSpeech({
        text: args.text,
        provider: (args.provider as any) || "edge",
        voice: args.voice,
        speed: args.speed || 1.0,
      });
      return `Speech synthesized: ${result}`;
    } catch (e: any) {
      return `TTS error: ${e.message}`;
    }
  },
});

registerTool({
  name: "tts_list_voices",
  description: "List available TTS voices by provider",
  source: "community",
  schema: {
    type: "object", properties: {
      provider: { type: "string", enum: ["edge", "openai", "elevenlabs", "gtts"], description: "Optional provider filter" },
    }, additionalProperties: false,
  },
  async execute(args: { provider?: string }) {
    const { listVoices } = await import("../voice/tts.ts");
    const voices = listVoices(args.provider as any);
    return Object.entries(voices).map(([p, v]) => `  ${p}: ${v.join(", ")}`).join("\n");
  },
});

// ─── Image Generation Tool (v0.5.0) ─────────────────────────────
registerTool({
  name: "image_generate",
  description: "Generate AI images. Supports: replicate (default), openai (DALL-E), sd (local), prodia",
  source: "community",
  schema: {
    type: "object", properties: {
      prompt: { type: "string", description: "Image description prompt" },
      provider: { type: "string", enum: ["replicate", "openai", "sd", "prodia"], description: "Image provider (default: replicate)" },
      model: { type: "string", description: "Model variant: sdxl, sd3, flux (replicate); standard, hd (openai)" },
      width: { type: "number", description: "Image width (default: 1024)" },
      height: { type: "number", description: "Image height (default: 1024)" },
      negativePrompt: { type: "string", description: "Negative prompt to exclude elements" },
    }, required: ["prompt"], additionalProperties: false,
  },
  async execute(args: { prompt: string; provider?: string; model?: string; width?: number; height?: number; negativePrompt?: string }) {
    const { generateImage } = await import("../media/image-generation.ts");
    try {
      const result = await generateImage({
        prompt: args.prompt,
        provider: (args.provider as any) || "replicate",
        model: args.model,
        width: args.width,
        height: args.height,
        negativePrompt: args.negativePrompt,
      });
      return `Image generated: ${result}`;
    } catch (e: any) {
      return `Image generation error: ${e.message}`;
    }
  },
});

// ─── Discord Bridge Tool (v0.5.0) ───────────────────────────────
registerTool({
  name: "discord_connect",
  description: "Connect Nova to Discord as a bot. Requires DISCORD_TOKEN in .env",
  source: "community",
  schema: {
    type: "object", properties: {
      guildId: { type: "string", description: "Discord guild/server ID" },
    }, additionalProperties: false,
  },
  async execute(args: { guildId?: string }) {
    const { configureDiscord, connectDiscord } = await import("../channel/discord.ts");
    const token = process.env.DISCORD_TOKEN;
    if (!token) return "Discord token not configured. Add DISCORD_TOKEN to .env";
    configureDiscord({ token, guildId: args.guildId });
    return await connectDiscord();
  },
});

registerTool({
  name: "discord_send",
  description: "Send a message to a Discord channel",
  source: "community",
  schema: {
    type: "object", properties: {
      channelId: { type: "string", description: "Discord channel ID" },
      content: { type: "string", description: "Message content" },
    }, required: ["channelId", "content"], additionalProperties: false,
  },
  async execute(args: { channelId: string; content: string }) {
    const { sendDiscordMessage } = await import("../channel/discord.ts");
    return await sendDiscordMessage(args.channelId, args.content);
  },
});

registerTool({
  name: "discord_list_channels",
  description: "List Discord text channels in the configured guild",
  source: "community",
  schema: {
    type: "object", properties: {}, additionalProperties: false,
  },
  async execute() {
    const { listDiscordChannels } = await import("../channel/discord.ts");
    return await listDiscordChannels();
  },
});

// ─── Skills Hub Tools (v0.5.0) ──────────────────────────────────
registerTool({
  name: "skills_hub_list",
  description: "List available skills from the CheetahClaws skills hub",
  source: "community",
  schema: {
    type: "object", properties: {}, additionalProperties: false,
  },
  async execute() {
    const { listHubSkills } = await import("../skill/hub.ts");
    try {
      const skills = await listHubSkills();
      if (skills.length === 0) return "No skills found. Skills hub at https://github.com/cheetahclaws/skills";
      const byCat: Record<string, string[]> = {};
      for (const s of skills) {
        (byCat[s.category] ||= []).push(s.name);
      }
      return Object.entries(byCat)
        .map(([cat, names]) => `  ${cat}/:\n${names.map(n => `    ${n}`).join("\n")}`)
        .join("\n");
    } catch (e: any) {
      return `Skills hub error: ${e.message}`;
    }
  },
});

registerTool({
  name: "skills_hub_download",
  description: "Download a skill from the hub by name",
  source: "community",
  schema: {
    type: "object", properties: {
      name: { type: "string", description: "Skill name (e.g. 'agentmail', 'arxiv')" },
    }, required: ["name"], additionalProperties: false,
  },
  async execute(args: { name: string }) {
    const { downloadHubSkill } = await import("../skill/hub.ts");
    try {
      return await downloadHubSkill(args.name);
    } catch (e: any) {
      return `Download error: ${e.message}`;
    }
  },
});

registerTool({
  name: "skills_hub_sync",
  description: "Sync all skills from the hub (mirror)"
    + "\nDownloads ALL skills from cheetahclaws/skills that don't exist locally",
  source: "community",
  schema: {
    type: "object", properties: {}, additionalProperties: false,
  },
  async execute() {
    const { syncHubSkills } = await import("../skill/hub.ts");
    try {
      const logs: string[] = [];
      const result = await syncHubSkills((msg: string) => logs.push(msg));
      logs.unshift(`Sync complete: +${result.added} added, ${result.updated} updated, ${result.failed} failed`);
      return logs.join("\n");
    } catch (e: any) {
      return `Sync error: ${e.message}`;
    }
  },
});

registerTool({
  name: "discord_get_messages",
  description: "Get recent messages from a Discord channel",
  source: "community",
  schema: {
    type: "object", properties: {
      channelId: { type: "string", description: "Discord channel ID" },
      limit: { type: "number", description: "Max messages (default: 20)" },
    }, required: ["channelId"], additionalProperties: false,
  },
  async execute(args: { channelId: string; limit?: number }) {
    const { getDiscordMessages } = await import("../channel/discord.ts");
    return await getDiscordMessages(args.channelId, args.limit);
  },
});

// ═══════════════════════════════════════════════════════════════
// v0.6.0 — Browser Automation (8 tools)
// ═══════════════════════════════════════════════════════════════

registerTool({
  name: "browser_launch",
  description: "Launch a stealth browser (headless Chromium) with fingerprint spoofing",
  source: "community",
  schema: {
    type: "object", properties: {
      headless: { type: "boolean", description: "Run headless (default: true)" },
      width: { type: "number", description: "Viewport width (default: 1280)" },
      height: { type: "number", description: "Viewport height (default: 800)" },
    }, additionalProperties: false,
  },
  async execute(args: { headless?: boolean; width?: number; height?: number }) {
    const { launchBrowser } = await import("../browser/engine.ts");
    try { return await launchBrowser(args); }
    catch (e: any) { return `Browser launch error: ${e.message}`; }
  },
});

registerTool({
  name: "browser_navigate",
  description: "Navigate browser to a URL. Auto-launches if not running.",
  source: "community",
  schema: {
    type: "object", properties: {
      url: { type: "string", description: "URL to navigate to (e.g. 'example.com' or 'https://...')" },
      waitUntil: { type: "string", enum: ["load", "domcontentloaded", "networkidle"], description: "When to consider navigation complete" },
    }, required: ["url"], additionalProperties: false,
  },
  async execute(args: { url: string; waitUntil?: "load" | "domcontentloaded" | "networkidle" }) {
    const { launchBrowser, navigate, isBrowserOpen } = await import("../browser/engine.ts");
    if (!(await isBrowserOpen())) await launchBrowser({ headless: true });
    try { return await navigate(args.url, { waitUntil: args.waitUntil }); }
    catch (e: any) { return `Navigate error: ${e.message}`; }
  },
});

registerTool({
  name: "browser_click",
  description: "Click an element on the page by CSS selector",
  source: "community",
  schema: {
    type: "object", properties: {
      selector: { type: "string", description: "CSS selector to click" },
    }, required: ["selector"], additionalProperties: false,
  },
  async execute(args: { selector: string }) {
    const { click } = await import("../browser/engine.ts");
    try { return await click(args.selector); }
    catch (e: any) { return `Click error: ${e.message}`; }
  },
});

registerTool({
  name: "browser_type",
  description: "Type text into an input field",
  source: "community",
  schema: {
    type: "object", properties: {
      selector: { type: "string", description: "CSS selector for the input" },
      text: { type: "string", description: "Text to type" },
    }, required: ["selector", "text"], additionalProperties: false,
  },
  async execute(args: { selector: string; text: string }) {
    const { typeText } = await import("../browser/engine.ts");
    try { return await typeText(args.selector, args.text); }
    catch (e: any) { return `Type error: ${e.message}`; }
  },
});

registerTool({
  name: "browser_screenshot",
  description: "Take a screenshot of the current page. Returns file path.",
  source: "community",
  schema: {
    type: "object", properties: {
      fullPage: { type: "boolean", description: "Capture full scrollable page (default: false)" },
    }, additionalProperties: false,
  },
  async execute(args: { fullPage?: boolean }) {
    const { screenshot } = await import("../browser/engine.ts");
    try { return await screenshot(args.fullPage); }
    catch (e: any) { return `Screenshot error: ${e.message}`; }
  },
});

registerTool({
  name: "browser_extract",
  description: "Extract text/HTML from the page or a specific element",
  source: "community",
  schema: {
    type: "object", properties: {
      selector: { type: "string", description: "Optional CSS selector (extracts whole page if omitted)" },
      mode: { type: "string", enum: ["text", "html"], description: "text (default) or html" },
    }, additionalProperties: false,
  },
  async execute(args: { selector?: string; mode?: string }) {
    const { extractText, extractHtml } = await import("../browser/engine.ts");
    try {
      if (args.mode === "html") return await extractHtml(args.selector);
      return await extractText(args.selector);
    } catch (e: any) { return `Extract error: ${e.message}`; }
  },
});

registerTool({
  name: "browser_evaluate",
  description: "Execute JavaScript in the browser page",
  source: "community",
  schema: {
    type: "object", properties: {
      script: { type: "string", description: "JavaScript code to execute" },
    }, required: ["script"], additionalProperties: false,
  },
  async execute(args: { script: string }) {
    const { evaluate } = await import("../browser/engine.ts");
    try {
      const result = await evaluate(args.script);
      return typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);
    } catch (e: any) { return `Evaluate error: ${e.message}`; }
  },
});

registerTool({
  name: "browser_close",
  description: "Close the browser and release resources",
  source: "community",
  schema: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const { closeBrowser } = await import("../browser/engine.ts");
    return await closeBrowser();
  },
});

// ═══════════════════════════════════════════════════════════════
// v0.6.0 — Computer Use (7 tools)
// ═══════════════════════════════════════════════════════════════

registerTool({
  name: "computer_mouse_move",
  description: "Move mouse cursor to absolute screen coordinates",
  source: "community",
  schema: {
    type: "object", properties: {
      x: { type: "number", description: "X coordinate" },
      y: { type: "number", description: "Y coordinate" },
    }, required: ["x", "y"], additionalProperties: false,
  },
  async execute(args: { x: number; y: number }) {
    const { mouseMove } = await import("../browser/computer.ts");
    try { return await mouseMove(args.x, args.y); }
    catch (e: any) { return `Mouse move error: ${e.message}`; }
  },
});

registerTool({
  name: "computer_mouse_click",
  description: "Click at current position or specified coordinates",
  source: "community",
  schema: {
    type: "object", properties: {
      button: { type: "string", enum: ["left", "right", "middle"], description: "Mouse button (default: left)" },
      x: { type: "number", description: "Optional X coordinate" },
      y: { type: "number", description: "Optional Y coordinate" },
      double: { type: "boolean", description: "Double click (default: false)" },
    }, additionalProperties: false,
  },
  async execute(args: { button?: "left" | "right" | "middle"; x?: number; y?: number; double?: boolean }) {
    const { mouseClick } = await import("../browser/computer.ts");
    try { return await mouseClick(args.button || "left", args.x, args.y, args.double); }
    catch (e: any) { return `Mouse click error: ${e.message}`; }
  },
});

registerTool({
  name: "computer_keyboard_type",
  description: "Type text using the keyboard",
  source: "community",
  schema: {
    type: "object", properties: {
      text: { type: "string", description: "Text to type" },
    }, required: ["text"], additionalProperties: false,
  },
  async execute(args: { text: string }) {
    const { keyboardType } = await import("../browser/computer.ts");
    try { return await keyboardType(args.text); }
    catch (e: any) { return `Keyboard type error: ${e.message}`; }
  },
});

registerTool({
  name: "computer_keyboard_press",
  description: "Press a special key: enter, tab, escape, ctrl+c, alt+f4, f1-f12, etc.",
  source: "community",
  schema: {
    type: "object", properties: {
      key: { type: "string", description: "Key name (enter, tab, ctrl+c, alt+f4, f5, etc.)" },
    }, required: ["key"], additionalProperties: false,
  },
  async execute(args: { key: string }) {
    const { keyboardPress } = await import("../browser/computer.ts");
    try { return await keyboardPress(args.key); }
    catch (e: any) { return `Key press error: ${e.message}`; }
  },
});

registerTool({
  name: "computer_screenshot",
  description: "Take a screenshot of the desktop (not browser). Returns file path.",
  source: "community",
  schema: {
    type: "object", properties: {
      region: { type: "string", description: "Optional region as 'x,y,width,height'" },
    }, additionalProperties: false,
  },
  async execute(args: { region?: string }) {
    const { desktopScreenshot } = await import("../browser/computer.ts");
    try {
      let region: { x: number; y: number; width: number; height: number } | undefined;
      if (args.region) {
        const parts = args.region.split(",").map(Number);
        if (parts.length === 4) region = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      }
      return await desktopScreenshot(region);
    } catch (e: any) { return `Screenshot error: ${e.message}`; }
  },
});

registerTool({
  name: "computer_shell",
  description: "Execute a shell command (read-only recommended). Returns stdout+stderr.",
  source: "community",
  schema: {
    type: "object", properties: {
      command: { type: "string", description: "Command to execute" },
    }, required: ["command"], additionalProperties: false,
  },
  async execute(args: { command: string }) {
    const { shell } = await import("../browser/computer.ts");
    const result = await shell(args.command);
    let out = `Exit code: ${result.exitCode}`;
    if (result.stdout) out += `\nstdout:\n${result.stdout.slice(0, 5000)}`;
    if (result.stderr) out += `\nstderr:\n${result.stderr.slice(0, 2000)}`;
    return out;
  },
});

registerTool({
  name: "computer_mouse_position",
  description: "Get current mouse cursor position",
  source: "community",
  schema: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const { mousePosition, getScreenSize } = await import("../browser/computer.ts");
    try {
      const pos = await mousePosition();
      const screen = await getScreenSize();
      return `Mouse: (${pos.x}, ${pos.y}) / Screen: ${screen.width}x${screen.height}`;
    } catch (e: any) { return `Mouse position error: ${e.message}`; }
  },
});

// ═══════════════════════════════════════════════════════════════
// v0.6.0 — Email Bridge (6 tools)
// ═══════════════════════════════════════════════════════════════

registerTool({
  name: "email_send",
  description: "Send an email. Config: EMAIL_IMAP_HOST, EMAIL_IMAP_USER, EMAIL_IMAP_PASS in .env",
  source: "community",
  schema: {
    type: "object", properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Subject line" },
      body: { type: "string", description: "Email body (plain text)" },
    }, required: ["to", "subject", "body"], additionalProperties: false,
  },
  async execute(args: { to: string; subject: string; body: string }) {
    const { emailSend } = await import("../channel/email.ts");
    try { return await emailSend(args.to, args.subject, args.body); }
    catch (e: any) { return `Email error: ${e.message}`; }
  },
});

registerTool({
  name: "email_list",
  description: "List recent emails from INBOX",
  source: "community",
  schema: {
    type: "object", properties: {
      folder: { type: "string", description: "Folder name (default: INBOX)" },
      limit: { type: "number", description: "Max messages (default: 20)" },
    }, additionalProperties: false,
  },
  async execute(args: { folder?: string; limit?: number }) {
    const { emailList } = await import("../channel/email.ts");
    try {
      const msgs = await emailList(args.folder, args.limit || 20);
      return msgs.map(m => `  [${m.uid}] ${m.date.slice(0, 10)} ${m.from} — ${m.subject}`).join("\n");
    } catch (e: any) { return `Email list error: ${e.message}`; }
  },
});

registerTool({
  name: "email_read",
  description: "Read a full email by its UID number",
  source: "community",
  schema: {
    type: "object", properties: {
      uid: { type: "number", description: "Email UID from email_list" },
    }, required: ["uid"], additionalProperties: false,
  },
  async execute(args: { uid: number }) {
    const { emailRead } = await import("../channel/email.ts");
    try {
      const email = await emailRead(args.uid);
      return `From: ${email.from}\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.text.slice(0, 5000)}`;
    } catch (e: any) { return `Email read error: ${e.message}`; }
  },
});

registerTool({
  name: "email_reply",
  description: "Reply to an email by UID",
  source: "community",
  schema: {
    type: "object", properties: {
      uid: { type: "number", description: "Email UID to reply to" },
      body: { type: "string", description: "Reply body text" },
    }, required: ["uid", "body"], additionalProperties: false,
  },
  async execute(args: { uid: number; body: string }) {
    const { emailReply } = await import("../channel/email.ts");
    try { return await emailReply(args.uid, args.body); }
    catch (e: any) { return `Email reply error: ${e.message}`; }
  },
});

registerTool({
  name: "email_search",
  description: "Search emails by subject or sender",
  source: "community",
  schema: {
    type: "object", properties: {
      query: { type: "string", description: "Search keyword" },
    }, required: ["query"], additionalProperties: false,
  },
  async execute(args: { query: string }) {
    const { emailSearch } = await import("../channel/email.ts");
    try {
      const msgs = await emailSearch(args.query);
      return msgs.map(m => `  [${m.uid}] ${m.date.slice(0, 10)} ${m.from} — ${m.subject}`).join("\n") || "No results";
    } catch (e: any) { return `Email search error: ${e.message}`; }
  },
});

registerTool({
  name: "email_list_folders",
  description: "List all IMAP folders/mailboxes",
  source: "community",
  schema: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const { emailListFolders } = await import("../channel/email.ts");
    try {
      const folders = await emailListFolders();
      return folders.map(f => `  ${f}`).join("\n");
    } catch (e: any) { return `Email folders error: ${e.message}`; }
  },
});

// ═══════════════════════════════════════════════════════════════
// v0.6.0 — WhatsApp Bridge (5 tools)
// ═══════════════════════════════════════════════════════════════

registerTool({
  name: "whatsapp_connect",
  description: "Connect to WhatsApp Web. First time requires QR code scan from phone.",
  source: "community",
  schema: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const { whatsappConnect, getWhatsAppQR } = await import("../channel/whatsapp.ts");
    try {
      const result = await whatsappConnect();
      const qr = getWhatsAppQR();
      if (qr) return `${result}\n\nQR data URI: ${qr.slice(0, 200)}...`;
      return result;
    } catch (e: any) { return `WhatsApp error: ${e.message}`; }
  },
});

registerTool({
  name: "whatsapp_send",
  description: "Send a WhatsApp message to a phone number",
  source: "community",
  schema: {
    type: "object", properties: {
      phone: { type: "string", description: "Phone number with country code (e.g. +1234567890)" },
      message: { type: "string", description: "Message text" },
    }, required: ["phone", "message"], additionalProperties: false,
  },
  async execute(args: { phone: string; message: string }) {
    const { whatsappSend } = await import("../channel/whatsapp.ts");
    try { return await whatsappSend(args.phone, args.message); }
    catch (e: any) { return `WhatsApp send error: ${e.message}`; }
  },
});

registerTool({
  name: "whatsapp_list_chats",
  description: "List recent WhatsApp chats",
  source: "community",
  schema: { type: "object", properties: {
    limit: { type: "number", description: "Max chats (default: 20)" },
  }, additionalProperties: false },
  async execute(args: { limit?: number }) {
    const { whatsappListChats } = await import("../channel/whatsapp.ts");
    try {
      const chats = await whatsappListChats(args.limit);
      return chats.map(c => `  ${c.id.slice(0, 30)}... | ${c.name} | ${c.unread} unread`).join("\n");
    } catch (e: any) { return `WhatsApp chats error: ${e.message}`; }
  },
});

registerTool({
  name: "whatsapp_get_messages",
  description: "Get recent messages from a WhatsApp chat by chat ID",
  source: "community",
  schema: {
    type: "object", properties: {
      chatId: { type: "string", description: "Chat ID (e.g. 1234567890@c.us or from whatsapp_list_chats)" },
      limit: { type: "number", description: "Max messages (default: 20)" },
    }, required: ["chatId"], additionalProperties: false,
  },
  async execute(args: { chatId: string; limit?: number }) {
    const { whatsappGetMessages } = await import("../channel/whatsapp.ts");
    try {
      const msgs = await whatsappGetMessages(args.chatId, args.limit);
      return msgs.map(m => `  [${new Date(m.timestamp * 1000).toISOString().slice(0, 19)}] ${m.senderName || m.from}: ${m.body.slice(0, 200)}`).join("\n");
    } catch (e: any) { return `WhatsApp messages error: ${e.message}`; }
  },
});

registerTool({
  name: "whatsapp_send_image",
  description: "Send an image on WhatsApp with a caption",
  source: "community",
  schema: {
    type: "object", properties: {
      phone: { type: "string", description: "Phone number" },
      caption: { type: "string", description: "Image caption" },
      imagePath: { type: "string", description: "Local path to image file" },
    }, required: ["phone", "caption", "imagePath"], additionalProperties: false,
  },
  async execute(args: { phone: string; caption: string; imagePath: string }) {
    const { whatsappSendImage } = await import("../channel/whatsapp.ts");
    try { return await whatsappSendImage(args.phone, args.caption, args.imagePath); }
    catch (e: any) { return `WhatsApp image error: ${e.message}`; }
  },
});

// ═══════════════════════════════════════════════════════════════
// v0.6.0 — Signal Bridge (3 tools)
// ═══════════════════════════════════════════════════════════════

registerTool({
  name: "signal_send",
  description: "Send a Signal message. Requires SIGNAL_PHONE in .env",
  source: "community",
  schema: {
    type: "object", properties: {
      recipient: { type: "string", description: "Phone number (+1234567890) or group ID" },
      message: { type: "string", description: "Message text" },
    }, required: ["recipient", "message"], additionalProperties: false,
  },
  async execute(args: { recipient: string; message: string }) {
    const { signalSend } = await import("../channel/signal.ts");
    try { return await signalSend(args.recipient, args.message); }
    catch (e: any) { return `Signal error: ${e.message}`; }
  },
});

registerTool({
  name: "signal_receive",
  description: "Receive recent Signal messages",
  source: "community",
  schema: { type: "object", properties: {
    limit: { type: "number", description: "Max messages (default: 10)" },
  }, additionalProperties: false },
  async execute(args: { limit?: number }) {
    const { signalReceive } = await import("../channel/signal.ts");
    try {
      const msgs = await signalReceive(args.limit);
      return msgs.map(m => `  [${new Date(m.timestamp).toISOString()}] ${m.source}: ${m.body.slice(0, 200)}`).join("\n") || "No messages";
    } catch (e: any) { return `Signal receive error: ${e.message}`; }
  },
});

registerTool({
  name: "signal_status",
  description: "Check Signal CLI status and registration",
  source: "community",
  schema: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const { signalStatus } = await import("../channel/signal.ts");
    try { return await signalStatus(); }
    catch { return "Signal CLI not available. See: https://github.com/AsamK/signal-cli"; }
  },
});

console.log("  ✓ Community skills loaded (64 tools)");
