// MCP Client — Model Context Protocol (stdio/SSE/HTTP)
import { spawn } from "node:child_process";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface MCPServerConfig {
  name: string;
  transport: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface MCPTool {
  serverName: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

class MCPManager {
  private servers = new Map<string, MCPServerConfig>();
  private tools = new Map<string, MCPTool>();

  loadConfigs(): void {
    const paths = [
      join(process.cwd(), ".mcp.json"),
      join(process.cwd(), "mcp.json"),
    ];
    for (const p of paths) {
      if (existsSync(p)) {
        try {
          const data = JSON.parse(readFileSync(p, "utf-8"));
          for (const [name, cfg] of Object.entries(data.mcpServers || {})) {
            const c = cfg as any;
            this.servers.set(name, {
              name, transport: c.type || "stdio",
              command: c.command, args: c.args, url: c.url, env: c.env,
            });
          }
        } catch {}
      }
    }
  }

  getTools(): MCPTool[] {
    return [...this.tools.values()];
  }

  async startServer(name: string): Promise<void> {
    const cfg = this.servers.get(name);
    if (!cfg) throw new Error(`MCP server '${name}' not found`);
    if (cfg.transport === "stdio" && cfg.command) {
      const proc = spawn(cfg.command, cfg.args || [], {
        env: { ...process.env, ...cfg.env } as any,
      });
      // Simple stdio MCP initialization
      const initReq = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {} } };
      proc.stdin?.write(JSON.stringify(initReq) + "\n");

      let buf = "";
      proc.stdout?.on("data", (data: Buffer) => {
        buf += data.toString();
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            if (msg.result?.capabilities?.tools) {
              // Server supports tools — send tools/list
              const listReq = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };
              proc.stdin?.write(JSON.stringify(listReq) + "\n");
            }
            if (msg.id === 2 && msg.result?.tools) {
              for (const t of msg.result.tools) {
                this.tools.set(`${name}:${t.name}`, {
                  serverName: name, name: t.name,
                  description: t.description, inputSchema: t.inputSchema || {},
                });
              }
            }
          } catch {}
        }
      });
    }
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    const server = this.servers.get(serverName);
    if (!server) return JSON.stringify({ error: `MCP server "${serverName}" not found` });

    const message = JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now().toString(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    });

    // Spawn the server process if not already running and send the tool call over stdio
    return new Promise((resolve, reject) => {
      const proc = spawn(server.command!, server.args || [], {
        env: { ...process.env, ...server.env } as any,
      });
      const timeout = setTimeout(() => {
        proc.kill();
        resolve(JSON.stringify({ error: "MCP tool timeout" }));
      }, 30000);
      proc.stdin!.write(message + "\n");
      proc.stdout!.once("data", (data: Buffer) => {
        clearTimeout(timeout);
        proc.kill();
        resolve(data.toString());
      });
      proc.stdout!.once("error", (err: Error) => {
        clearTimeout(timeout);
        proc.kill();
        reject(err.message);
      });
    });
  }
}

export const mcpManager = new MCPManager();
