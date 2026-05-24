/**
 * MCP Client — connect to MCP servers and expose their tools as Nova tools.
 * Supports stdio transport, OAuth token auth, and tool_override for replacing built-ins.
 */
import { spawn, ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { safeMessage } from "./errors.ts";

const DEBUG = process.env.NOVA_DEBUG === "1";
function debugLog(...args: any[]) { if (DEBUG) console.log("[MCP]", ...args); }

interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  auth?: { type: "oauth" | "token"; tokenUrl?: string; token?: string; clientId?: string; clientSecret?: string; scopes?: string[] };
  tool_overrides?: string[]; // Built-in tool names this server can replace
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<string>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

const MCP_CONFIG_PATH = join(process.cwd(), "config", "mcp-servers.json");
const MCP_AUTH_PATH = join(process.cwd(), "data", "mcp-auth.json");

let servers: Map<string, { process: ChildProcess; tools: MCPTool[]; config: MCPServerConfig }> = new Map();
let requestId = 1;

function loadConfig(): MCPServerConfig[] {
  try {
    if (existsSync(MCP_CONFIG_PATH)) {
      return JSON.parse(readFileSync(MCP_CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return [];
}

function loadAuthCache(): Record<string, string> {
  try {
    if (existsSync(MCP_AUTH_PATH)) return JSON.parse(readFileSync(MCP_AUTH_PATH, "utf-8"));
  } catch {}
  return {};
}

function saveAuthCache(cache: Record<string, string>) {
  const dir = dirname(MCP_AUTH_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(MCP_AUTH_PATH, JSON.stringify(cache, null, 2), "utf-8");
}

function sendRequest(proc: ChildProcess, method: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = requestId++;
    const req = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    const buf: string[] = [];

    const onData = (chunk: Buffer) => {
      buf.push(chunk.toString());
      const full = buf.join("");
      // MCP responses are newline-delimited JSON
      const lines = full.split("\n");
      for (const line of lines) {
        try {
          const resp: MCPResponse = JSON.parse(line);
          if (resp.id === id) {
            cleanup();
            if (resp.error) reject(new Error(resp.error.message));
            else resolve(resp.result);
            return;
          }
        } catch {}
      }
    };

    const cleanup = () => {
      proc.stdout?.removeListener("data", onData);
      proc.stderr?.removeListener("data", onError);
    };

    const onError = (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes("error") || text.includes("Error")) {
        console.warn(`[MCP] Server stderr: ${text.slice(0, 200)}`);
      }
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onError);
    proc.stdin?.write(req);

    setTimeout(() => { cleanup(); reject(new Error("MCP request timed out")); }, 30000);
  });
}

async function discoverTools(proc: ChildProcess): Promise<MCPTool[]> {
  const result = await sendRequest(proc, "tools/list");
  if (!result?.tools) return [];

  const authCache = loadAuthCache();

  return result.tools.map((t: any) => {
    const toolName = t.name as string;
    const handler = async (args: any): Promise<string> => {
      try {
        const callResult = await sendRequest(proc, "tools/call", { name: toolName, arguments: args });
        return callResult?.content?.map((c: any) => c.text || "").join("\n") || "(no result)";
      } catch (e: unknown) {
        return `Error calling MCP tool ${toolName}: ${(e as Error).message}`;
      }
    };
    return { name: `mcp_${toolName}`, description: t.description || `MCP tool: ${toolName}`, inputSchema: t.inputSchema || {}, handler };
  });
}

async function authOAuthFlow(config: MCPServerConfig, serverName: string): Promise<string | null> {
  if (!config.auth) return null;
  const cache = loadAuthCache();
  if (cache[serverName]) return cache[serverName];

  if (config.auth.type === "token" && config.auth.token) {
    cache[serverName] = config.auth.token;
    saveAuthCache(cache);
    return config.auth.token;
  }

  if (config.auth.type === "oauth" && config.auth.tokenUrl) {
    // Simple OAuth client credentials flow
    if (config.auth.clientId && config.auth.clientSecret) {
      try {
        const params = new URLSearchParams({
          grant_type: "client_credentials",
          client_id: config.auth.clientId,
          client_secret: config.auth.clientSecret,
          scope: (config.auth.scopes || []).join(" "),
        });
        const res = await fetch(config.auth.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.access_token) {
            cache[serverName] = data.access_token;
            saveAuthCache(cache);
            return data.access_token;
          }
        }
      } catch (e) {
        console.warn(`[MCP] OAuth failed for ${serverName}:`, e);
      }
    }
    return null;
  }

  return null;
}

/**
 * Initialize all configured MCP servers. Call once at startup.
 */
export async function initMCPServers(): Promise<void> {
  const configs = loadConfig();
  for (const cfg of configs) {
    const name = `${cfg.command}_${(cfg.args?.[0] || "").replace(/[^a-z0-9]/g, "_")}`;
    try {
      await startServer(name, cfg);
    } catch (e) {
      // Silent fail — MCP servers are optional
      debugLog(`MCP: ${name} — ${safeMessage(e)}`);
    }
  }
}

/**
 * Start a single MCP server and register its tools.
 */
export async function startServer(name: string, config: MCPServerConfig): Promise<void> {
  if (servers.has(name)) return;

  // Handle OAuth/token auth first
  const token = await authOAuthFlow(config, name);
  const env: Record<string, string> = { ...process.env as any, ...(config.env || {}) };
  if (token) env["MCP_TOKEN"] = token;

  const proc = spawn(config.command, config.args || [], {
    stdio: ["pipe", "pipe", "pipe"],
    env: env as any,
    shell: true,
    windowsHide: true,
  });

  proc.on("exit", (code) => {
    console.warn(`[MCP] Server ${name} exited with code ${code}`);
    servers.delete(name);
  });

  // Discover tools
  const tools = await discoverTools(proc);

  servers.set(name, { process: proc, tools, config });
  console.log(`[MCP] Server "${name}" started — ${tools.length} tools registered`);
}

/**
 * Register MCP tools into the Nova tool system.
 * Returns array of registered tool definitions for the model_tools registry.
 */
export function getMCPToolRegistrations(): Array<{ name: string; description: string; parameters: any; execute: (args: any) => Promise<string> }> {
  const registrations: Array<{ name: string; description: string; parameters: any; execute: (args: any) => Promise<string> }> = [];
  for (const [, server] of servers) {
    for (const tool of server.tools) {
      registrations.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || { type: "object", properties: {} },
        execute: tool.handler,
      });
    }
  }
  return registrations;
}

/**
 * Check if a built-in tool name should be overridden by an MCP server.
 * Returns the MCP tool if an override is configured.
 */
export function findOverride(toolName: string): MCPTool | undefined {
  for (const [, server] of servers) {
    if (server.config.tool_overrides?.includes(toolName)) {
      const overrideTool = server.tools.find(t => t.name === `mcp_${toolName}`);
      if (overrideTool) return overrideTool;
    }
  }
  return undefined;
}

/**
 * Stop all MCP servers. Call on shutdown.
 */
export async function stopAll(): Promise<void> {
  for (const [name, server] of servers) {
    try {
      server.process.kill();
    } catch {}
    console.log(`[MCP] Server "${name}" stopped`);
  }
  servers.clear();
}

/**
 * List connected MCP servers and their tool counts.
 */
export function listServers(): Array<{ name: string; toolCount: number; overrides: string[] }> {
  return [...servers.entries()].map(([name, s]) => ({
    name,
    toolCount: s.tools.length,
    overrides: s.config.tool_overrides || [],
  }));
}
