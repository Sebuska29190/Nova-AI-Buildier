/**
 * Kernel — Event Ledger
 * 1:1 z CheetahClaws cc_kernel/ledger.py
 * 
 * Immutable event log for tracking all agent actions
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

export interface LedgerEntry {
  id: string;
  timestamp: string;
  agentId: string;
  action: string;
  target: string;
  status: "started" | "completed" | "failed";
  detail: string;
}

class Ledger {
  private dbPath = "";

  init(basePath?: string): void {
    this.dbPath = basePath ?? join(process.cwd(), "kernel", "ledger");
    mkdirSync(this.dbPath, { recursive: true });
    console.log(`  ✓ Kernel Ledger initialized at ${this.dbPath}`);
  }

  /**
   * Append an entry to the ledger
   */
  append(entry: Omit<LedgerEntry, "id" | "timestamp">): LedgerEntry {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    const full: LedgerEntry = { id, timestamp, ...entry };

    const dateStr = timestamp.slice(0, 10);
    const logFile = join(this.dbPath, `${dateStr}.jsonl`);
    appendFileSync(logFile, JSON.stringify(full) + "\n", "utf-8");

    return full;
  }

  /**
   * Query ledger entries with filters
   */
  query(opts: { agentId?: string; action?: string; status?: string; limit?: number; since?: string }): LedgerEntry[] {
    const limit = opts.limit ?? 50;
    const results: LedgerEntry[] = [];

    try {
      const files = readdirSync(this.dbPath)
        .filter((f) => f.endsWith(".jsonl"))
        .sort()
        .reverse();

      for (const file of files) {
        if (results.length >= limit) break;
        if (opts.since && file < `${opts.since.slice(0, 10)}.jsonl`) continue;

        const content = readFileSync(join(this.dbPath, file), "utf-8");
        const lines = content.trim().split("\n").reverse();

        for (const line of lines) {
          if (results.length >= limit) break;
          try {
            const entry = JSON.parse(line) as LedgerEntry;
            if (opts.agentId && entry.agentId !== opts.agentId) continue;
            if (opts.action && entry.action !== opts.action) continue;
            if (opts.status && entry.status !== opts.status) continue;
            results.push(entry);
          } catch { /* skip malformed */ }
        }
      }
    } catch { /* skip */ }

    return results;
  }

  /**
   * Get summary statistics
   */
  getStats(): { total: number; byAgent: Record<string, number>; byAction: Record<string, number> } {
    const byAgent: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    let total = 0;

    try {
      const files = readdirSync(this.dbPath).filter((f) => f.endsWith(".jsonl"));
      for (const file of files) {
        const content = readFileSync(join(this.dbPath, file), "utf-8");
        for (const line of content.trim().split("\n")) {
          try {
            const entry = JSON.parse(line);
            total++;
            byAgent[entry.agentId] = (byAgent[entry.agentId] || 0) + 1;
            byAction[entry.action] = (byAction[entry.action] || 0) + 1;
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }

    return { total, byAgent, byAction };
  }
}

export const ledger = new Ledger();
