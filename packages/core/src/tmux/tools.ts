/**
 * Tmux Tools — terminal multiplexer integration
 * 1:1 z CheetahClaws tmux tools
 * 
 * Provides:
 * - Session management (create/list/kill)
 * - Window management
 * - Command execution in tmux panes
 * - Output capture
 */

import { execSync, spawn } from "node:child_process";

export interface TmuxSession {
  name: string;
  created: string;
  windows: number;
}

/**
 * Check if tmux is available
 */
export function tmuxAvailable(): boolean {
  try {
    execSync("tmux -V", { stdio: "ignore", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * List all tmux sessions
 */
export function listSessions(): TmuxSession[] {
  try {
    const output = execSync("tmux list-sessions -F '#{session_name}|#{session_created}|#{session_windows}'", {
      encoding: "utf-8",
      timeout: 3000,
    });
    return output.trim().split("\n").filter(Boolean).map((line) => {
      const [name, created, windows] = line.split("|");
      return {
        name,
        created: created ? new Date(parseInt(created) * 1000).toISOString() : "",
        windows: parseInt(windows || "0"),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Create a new tmux session
 */
export function createSession(name: string, startDir?: string): boolean {
  try {
    const cmd = startDir
      ? `tmux new-session -d -s ${name} -c "${startDir}"`
      : `tmux new-session -d -s ${name}`;
    execSync(cmd, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill a tmux session
 */
export function killSession(name: string): boolean {
  try {
    execSync(`tmux kill-session -t ${name}`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Send a command to a tmux pane
 */
export function sendKeys(session: string, command: string, window?: number, pane?: number): boolean {
  try {
    const target = window !== undefined
      ? `${session}:${window}.${pane ?? 0}`
      : session;
    execSync(`tmux send-keys -t ${target} "${command}" Enter`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Capture pane content
 */
export function capturePane(session: string, window?: number, pane?: number): string {
  try {
    const target = window !== undefined
      ? `${session}:${window}.${pane ?? 0}`
      : session;
    const output = execSync(`tmux capture-pane -t ${target} -p`, {
      encoding: "utf-8",
      timeout: 3000,
    });
    return output;
  } catch {
    return "";
  }
}

/**
 * Split window horizontally
 */
export function splitHorizontal(session: string, window?: number): boolean {
  try {
    const target = window !== undefined ? `${session}:${window}` : `${session}:0`;
    execSync(`tmux split-window -h -t ${target}`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Split window vertically
 */
export function splitVertical(session: string, window?: number): boolean {
  try {
    const target = window !== undefined ? `${session}:${window}` : `${session}:0`;
    execSync(`tmux split-window -v -t ${target}`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a command in a new tmux window and capture output
 */
export function runInTmux(session: string, command: string, timeout = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const proc = spawn("tmux", ["send-keys", "-t", session, command, "Enter"], {
        timeout,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let output = "";
      const startTime = Date.now();

      const interval = setInterval(() => {
        try {
          const pane = capturePane(session);
          if (pane) output = pane;
          if (Date.now() - startTime > timeout) {
            clearInterval(interval);
            resolve(output);
          }
        } catch {
          clearInterval(interval);
          resolve(output);
        }
      }, 500);

      proc.on("error", (err) => {
        clearInterval(interval);
        reject(err);
      });

      // Auto-stop after timeout
      setTimeout(() => {
        clearInterval(interval);
        resolve(output);
      }, timeout);
    } catch (e: unknown) {
      reject(e);
    }
  });
}

/**
 * Get tmux status line
 */
export function getStatus(): string {
  try {
    return execSync("tmux display-message -p '#S: #{session_windows} windows'", {
      encoding: "utf-8",
      timeout: 2000,
    }).trim();
  } catch {
    return "tmux not available";
  }
}
