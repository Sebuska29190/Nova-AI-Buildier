// Terminal runner — execute shell commands via API (for bridges)
import { spawn } from "node:child_process";

const sessions = new Map<string, { proc: any; output: string }>();

export function runTerminal(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.platform === "win32" ? "cmd.exe" : "/bin/bash",
      process.platform === "win32" ? ["/c", command] : ["-c", command],
      { timeout: 30000 } as any
    );
    let out = "", err = "";
    (proc.stdout as any)?.on("data", (d: Buffer) => { out += d.toString(); });
    (proc.stderr as any)?.on("data", (d: Buffer) => { err += d.toString(); });
    (proc as any).on("close", (code: number) => {
      resolve(out + (err ? `\nstderr: ${err.slice(0, 1000)}` : ""));
    });
    (proc as any).on("error", reject);
  });
}
