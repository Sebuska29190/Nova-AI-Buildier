// Web terminal (PTY) — xterm.js via WebSocket
// Uses Bun's native WebSocket (Bun.serve) to avoid ws library abortHandshake bug
import type { Server } from "node:http";
import { spawn } from "node:child_process";
import { issueToken, verifyToken } from "../auth/jwt.ts";

export function setupTerminal(server: Server): void {
  try {
    const { WebSocketServer } = require("ws");
    const wss = new WebSocketServer({ noServer: true });

    // Intercept upgrade events — handle /terminal ourselves
    server.on("upgrade", (req: any, socket: any, head: any) => {
      const url = req.url || "";
      if (url === "/terminal" || url.startsWith("/terminal?")) {
        // Token verification — skip if no token for local dev convenience
        const query = new URL(url, "http://localhost").searchParams;
        const token = query.get("token");
        if (token && !verifyToken(token)) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws: any) => {
          handleConnection(ws);
        });
      }
    });

    console.log("  Terminal WS:  /terminal (WebSocket attached)");
  } catch (err: unknown) {
    console.error("  Terminal WS: failed to set up:", err instanceof Error ? err.message : String(err));
  }
}

function handleConnection(ws: any): void {
  console.log("  Terminal WS: client connected");

  const isWin = process.platform === "win32";
  const shell = isWin ? "cmd.exe" : "/bin/bash";
  const args = isWin ? [] : ["-i"];
  let closed = false;
  let term: any = null;

  const safeSend = (data: string) => { if (!closed) try { ws.send(data); } catch {} };

  try {
    term = spawn(shell, args, {
      env: { ...process.env, TERM: "xterm-256color" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    ws.on("message", (data: Buffer | string) => {
      if (!term.killed && term.stdin) {
        term.stdin.write(typeof data === "string" ? data : data.toString());
      }
    });

    term.stdout?.on("data", (data: Buffer) => safeSend(data.toString()));
    term.stderr?.on("data", (data: Buffer) => safeSend(data.toString()));

    term.on("error", (err) => {
      if (closed) return;
      const msg = err?.message || String(err ?? "Unknown process error");
      console.error("  Terminal: process error:", msg.slice(0, 200));
      safeSend(`\r\n\x1b[31mProcess error: ${msg}\x1b[0m\r\n`);
    });

    ws.on("close", () => {
      closed = true;
      if (term && !term.killed) term.kill();
    });

    term.on("exit", (code) => {
      if (closed) return;
      closed = true;
      console.log(`  Terminal: process exited (code ${code})`);
      safeSend(`\r\n\x1b[33mProcess exited (code ${code})\x1b[0m\r\n`);
      try { if (ws.readyState === 1) ws.close(); } catch {}
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e ?? "Unknown terminal error");
    console.error("  Terminal: setup error:", msg.slice(0, 200));
    safeSend(`\r\n\x1b[31mTerminal error: ${msg}\x1b[0m\r\n`);
    closed = true;
  }
}
