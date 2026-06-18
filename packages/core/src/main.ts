#!/usr/bin/env bun
import { safeMessage } from "./errors.ts";
import { mcpManager } from "./mcp/client.ts";
import { config } from "dotenv";
import { join, resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serve as honoServe } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

// Global error handlers — prevent unhandled rejections from crashing the process
process.on("unhandledRejection", (reason, promise) => {
  console.error("  ⚠ Unhandled Rejection:", reason instanceof Error ? reason.message : String(reason));
});
process.on("uncaughtException", (err) => {
  const msg = err instanceof Error ? (err.message ?? "") : String(err ?? "Unknown");
  console.error("  ⚠ Uncaught Exception:", msg);
  if (err && typeof err === "object" && "stack" in (err as any)) {
    const stack = (err as any).stack;
    if (typeof stack === "string") {
      console.error("  ⚠ Stack:", stack.split("\n").slice(0, 8).filter(Boolean).join("\n  "));
    }
  }
});

for (const p of [join(process.cwd(), ".env"), join(process.cwd(), ".env.local")]) {
  if (existsSync(p)) { config({ path: p }); break; }
}

import { createRouter } from "./api/routes.ts";
import { registry } from "./plugin/registry.ts";
import { sessionManager } from "./session/manager.ts";
import { agentStore } from "./agent/store.ts";
import { agentMemory } from "./agent/memory.ts";
import { chamberManager } from "./multi-agent/chamber.ts";
import { workflowEngine } from "./workflow/engine.ts";
import { usageTracker } from "./monitor/usage.ts";
import { authManager } from "./auth/manager.ts";
import { memoryStore } from "./memory/store.ts";
import { loadProviderConfigs } from "./config/provider-config.ts";
import "./search/web.ts"; // registers web_search tool
import "./plugin/community-skills.ts"; // registers 20 community tools
import "./plugin/tools_session_search.ts"; // FTS5 session search tool
import "./skill/self-improve.ts"; // Auto-skill creation tools
import { cronManager } from "./cron/manager.ts"; // Cron scheduler (registers tools)
import "./log/capture.ts"; // Log capture system (intercepts console.log/warn/error)
import "./multi-agent/tools_parallel.ts"; // Parallel sub-agent tool
import "./skill/hub.ts"; // Skill Hub (agentskills.io integration)
import "./plugin/community-plugins.ts"; // registers community plugin registry
import "./git/tools.ts"; // registers 11 git tools
import "./memory/knowledge-graph.ts"; // registers 6 knowledge graph tools
import "./agent/goal-decomposition.ts"; // registers 4 goal decomposition tools
import "./analytics/dashboard.ts"; // registers 4 analytics tools
import { initializeMesh } from "./agent-mesh/index.ts"; // Agent Mesh Protocol
// Crypto modules removed in Nexus AI v2.0
import deepseekPlugin from "../../provider-deepseek/src/index.ts";
import anthropicProvider from "../../provider-anthropic/src/index.ts";
import openaiProvider from "../../provider-openai/src/index.ts";
import geminiProvider from "../../provider-gemini/src/index.ts";
import ollamaProvider from "../../provider-ollama-v2/src/index.ts";
import qwenProvider from "../../provider-qwen/src/index.ts";
import zhipuProvider from "../../provider-zhipu/src/index.ts";
import kimiProvider from "../../provider-kimi/src/index.ts";
import minimaxProvider from "../../provider-minimax/src/index.ts";
import lmstudioProvider from "../../provider-lmstudio/src/index.ts";
import grokProvider from "../../provider-grok/src/index.ts";
import customProvider from "../../provider-custom/src/index.ts";

console.log("\n  ╔═══════════════════════════════════════╗");
console.log("  ║       Nexus AI v2.0 — Connected        ║");
console.log("  ╚═══════════════════════════════════════╝\n");

// Init stores
sessionManager.init(process.env.NOVA_DB_PATH);
agentStore.init(process.env.NOVA_DB_PATH);
memoryStore.init();
agentMemory.init(process.env.NOVA_DB_PATH);
chamberManager.init(process.env.NOVA_DB_PATH);
workflowEngine.init(process.env.NOVA_DB_PATH);
usageTracker.init(process.env.NOVA_DB_PATH);
authManager.init();

// ─── Set default workspace ─────────────────────────────────────
import { workspaceManager } from "./workspace/manager.ts";
if (!workspaceManager.getRoot()) {
  workspaceManager.setRoot(process.cwd());
  console.log(`  ✓ Default workspace set to: ${process.cwd()}`);
}

// ─── Auto-Loader: safety + monitored modules ───────────────────
import("./autoloader.ts").then(({ loadModules }) => {
  loadModules("safety").then((loaded) => {
    if (loaded.length > 0) console.log(`  ✓ Auto-loaded safety modules: ${loaded.join(", ")}`);
  }).catch(() => {});
  loadModules("monitored").then((loaded) => {
    if (loaded.length > 0) console.log(`  ✓ Auto-loaded monitored modules: ${loaded.join(", ")}`);
  }).catch(() => {});
});

// Init Knowledge Base
import { knowledgeBase } from "./knowledge/store.ts";
knowledgeBase.init(process.env.NOVA_KNOWLEDGE_PATH);

// Init Kernel (AgentFS + Ledger)
import { kernel } from "./kernel/index.ts";
kernel.init({ basePath: process.env.NOVA_KERNEL_PATH });

import type { ProviderPlugin } from "@nova/sdk";

// Load providers
const providerList: Array<[string, ProviderPlugin]> = [
  ["DeepSeek", deepseekPlugin as ProviderPlugin],
  ["Anthropic", anthropicProvider as ProviderPlugin],
  ["OpenAI", openaiProvider as ProviderPlugin],
  ["Gemini", geminiProvider as ProviderPlugin],
  ["Ollama", ollamaProvider as ProviderPlugin],
  ["Qwen", qwenProvider as ProviderPlugin],
  ["Zhipu", zhipuProvider as ProviderPlugin],
  ["Kimi", kimiProvider as ProviderPlugin],
  ["MiniMax", minimaxProvider as ProviderPlugin],
  ["LM Studio", lmstudioProvider as ProviderPlugin],
  ["Grok", grokProvider as ProviderPlugin],
  ["Custom", customProvider as ProviderPlugin],
];
for (const [name, plugin] of providerList) {
  try {
    registry.registerProvider(plugin);
    console.log(`  ✓ ${name} (${plugin.models.length} models)`);
  } catch (e: unknown) {
    console.log(`  ⚠ ${name}: ${safeMessage(e)}`);
  }
}

const modelCount = registry.listModels().length;
console.log(`  ${registry.providers.size} provider(s), ${modelCount} model(s) ready`);

// Restore saved provider API keys from config file
loadProviderConfigs();

// Seed default agent
const existingAgents = agentStore.list();
if (existingAgents.length === 0) {
  agentStore.create({ name: "default", description: "Default Nova agent", modelRef: "deepseek/deepseek-chat", emoji: "◇" });
}

// Seed auto_bug_fixer agent (1:1 z CheetahClaws)
import { seedAutoBugFixer } from "./agent/auto-bug-fixer.ts";
seedAutoBugFixer();

// Seed community agents from GitHub ecosystem
import { seedCommunityAgents } from "./agent/community-agents.ts";
seedCommunityAgents();

// Seed VoltAgent community agents (112 imported subagents)
import { seedVoltAgentAgents } from "./agent/community-agents-voltagent.ts";
seedVoltAgentAgents(agentStore);

// Init MCP servers from .mcp.json / mcp.json
mcpManager.loadConfigs();

const agentCount = agentStore.list().length;
console.log(`  ${agentCount} agent(s) configured\n`);

// Initialize Agent Mesh Protocol
initializeMesh().then(() => {}).catch((e) => console.warn(`  Mesh: init warning - ${e}`));

// ─── Auto-build UI ──────────────────────────────────────────────────────────
// Build the Svelte UI (packages/ui) on startup so the latest components are served
// Use a multi-strategy approach to locate the UI package directory reliably
function resolveUiDir(): string | null {
  // Strategy 1: import.meta.dirname (Bun — note: this is CWD, not file path!)
  if (import.meta.dirname) {
    // When running `bun run packages/core/src/main.ts`, import.meta.dirname = CWD = project root
    const fromRoot = resolve(import.meta.dirname, "packages", "ui");
    if (existsSync(join(fromRoot, "package.json"))) return fromRoot;
    const fromRootAlt = resolve(import.meta.dirname, "..", "packages", "ui");
    if (existsSync(join(fromRootAlt, "package.json"))) return fromRootAlt;
  }
  // Strategy 2: import.meta.url → fileURLToPath (works in all Bun/Node ESM contexts — gives actual file path)
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // __dirname = packages/core/src
    const fromUrl = resolve(__dirname, "..", "..", "..", "packages", "ui");
    if (existsSync(join(fromUrl, "package.json"))) return fromUrl;
    const fromUrlAlt = resolve(__dirname, "..", "..", "packages", "ui");
    if (existsSync(join(fromUrlAlt, "package.json"))) return fromUrlAlt;
  } catch {}
  // Strategy 3: process.cwd() — try common relative paths
  const cwd = process.cwd();
  const candidates = [
    resolve(cwd, "packages", "ui"),                          // monorepo root
    resolve(cwd, "..", "packages", "ui"),                    // one level up
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "package.json"))) return candidate;
  }
  return null;
}

const uiPkgDir = resolveUiDir();
const distDir = uiPkgDir ? join(uiPkgDir, "dist") : null;
if (distDir && existsSync(distDir) && existsSync(join(distDir, "index.html"))) {
  console.log("  ✓ UI dist ready");
} else if (uiPkgDir) {
  console.log("  ⚠ UI dist not found — run 'bun run build:ui' first");
} else {
  console.log("  ⚠ UI package not found, skipping UI");
}

import { setupWebSocket } from "./gateway/websocket.ts";
import { setupTerminal } from "./gateway/terminal.ts";
import { getHealthPayload, getReadyzPayload, getMetricsPayload } from "./health.ts";
import { channelManager } from "./channel/manager.ts";

// Build routes
const app = createRouter();

// Health check endpoints
app.get("/healthz", (c) => c.json(getHealthPayload()));
app.get("/readyz", (c) => c.json(getReadyzPayload()));
app.get("/metrics", (c) => c.json(getMetricsPayload()));

// Serve UI — static files excluding WebSocket paths
app.get("/favicon.ico", (c) => c.text("⏣", 200));
const uiDir = process.env.NOVA_UI_DIR ? join(process.cwd(), process.env.NOVA_UI_DIR) : undefined;
if (uiDir && existsSync(uiDir)) {
  app.get("/*", serveStatic({ root: uiDir }));
} else if (uiPkgDir) {
  const distDir = join(uiPkgDir, "dist");
  if (existsSync(distDir)) {
    app.get("/*", serveStatic({ root: distDir }));
  }
}

// Start
const desiredPort = parseInt(process.env.NOVA_PORT ?? "4123", 10);
const host = process.env.NOVA_HOST ?? "127.0.0.1";

// Try ports with automatic fallback — net.createServer test first to avoid hono crashes
import { createServer as netCreateServer } from "node:net";

async function tryStart(port: number): Promise<import("node:http").Server | null> {
  const free = await new Promise<boolean>((resolve) => {
    const s = netCreateServer();
    const timer = setTimeout(() => { try { s.close(); } catch {} resolve(false); }, 1000);
    s.once("error", () => { clearTimeout(timer); resolve(false); });
    s.once("listening", () => { clearTimeout(timer); s.close(); resolve(true); });
    s.listen(port, "127.0.0.1");
  });
  if (!free) return null;
  try {
    const server = honoServe({ fetch: app.fetch, port, hostname: host });
    return server as unknown as import("node:http").Server;
  } catch {
    return null;
  }
}

(async () => {
  let httpServer = await tryStart(desiredPort);
  if (!httpServer) {
    console.log(`  ⚠ Port ${desiredPort} in use, using auto-assigned port...`);
    httpServer = await tryStart(0);
  }
  if (!httpServer) {
    console.error(`  ✗ Could not start server. Free ports and restart.`);
    process.exit(1);
  }
  const port = (httpServer.address() as import("net").AddressInfo).port;
  console.log(`  Gateway:      http://${host}:${port}`);
  console.log(`  Chat API:     POST /v1/chat/completions`);
  console.log(`  Agent API:    POST /api/agent/send`);
  console.log(`  Models:       GET  /v1/models`);
  console.log(`  Sessions:     GET  /api/sessions`);
  console.log(`  Channels:     POST /api/channels/:id/start`);
  console.log(`  Tools:        GET  /api/tools`);
  console.log(`  UI:           http://localhost:${port}/\n`);
  setupWebSocket(httpServer);

  // Start cron scheduler (natural-language cron jobs)
  cronManager.start();
  setupTerminal(httpServer);
  console.log(`  WebSocket:    ws://localhost:${port}/ws`);
  console.log(`  Terminal:     ws://localhost:${port}/terminal`);
  console.log(`  Health:       GET /healthz, /readyz, /metrics`);

  channelManager.restoreSavedChannels().then(() => {
    console.log(`  Channels:     ${channelManager.getChannels().length} restored from config`);
  });

  // Initialize MCP servers (optional — don't crash if not configured)
  try {
    const mcp = await import("./mcp/client.ts");
    if (mcp.mcpManager?.loadConfigs) {
      mcp.mcpManager.loadConfigs();
      const servers = mcp.mcpManager.getServers?.() || [];
      if (servers.length > 0) {
        console.log(`  MCP:          ${servers.length} server(s) configured`);
      }
    }
  } catch (e) {
    console.warn("  MCP:          Not configured (optional)");
  }

  console.log("\n  ✅ Nexus AI is ready!\n");
})();
