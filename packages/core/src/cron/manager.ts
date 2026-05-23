/**
 * Natural-Language Cron Scheduler
 *
 * Users describe jobs in natural language, and the scheduler
 * persists them and executes via background agents.
 *
 * Inspired by Hermes Agent cron subsystem.
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { registerTool } from "../plugin/tools.ts";
import { agentScheduler as AgentScheduler } from "../agent/scheduler.ts";

const db = new Database("nova.db");
db.run("PRAGMA journal_mode = WAL");
db.run(`CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  schedule TEXT NOT NULL, -- cron expression or ISO recurrence
  channel_id TEXT,
  agent_id TEXT,
  next_run TEXT NOT NULL,
  last_run TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
)`);

interface CronJob {
  id: string;
  description: string;
  schedule: string;
  channelId?: string;
  agentId?: string;
  nextRun: string;
  lastRun?: string;
  enabled: boolean;
  createdAt: string;
}

function parseNaturalSchedule(description: string): { cronExpr: string; intervalMs: number } | null {
  const lower = description.toLowerCase();

  // Every X minutes
  const everyMin = lower.match(/every\s+(\d+)\s*min/);
  if (everyMin) {
    const m = parseInt(everyMin[1]);
    if (m === 5) return { cronExpr: `*/5 * * * *`, intervalMs: 5 * 60 * 1000 };
    if (m === 10) return { cronExpr: `*/10 * * * *`, intervalMs: 10 * 60 * 1000 };
    if (m === 15) return { cronExpr: `*/15 * * * *`, intervalMs: 15 * 60 * 1000 };
    if (m === 30) return { cronExpr: `*/30 * * * *`, intervalMs: 30 * 60 * 1000 };
    return { cronExpr: `*/${m} * * * *`, intervalMs: m * 60 * 1000 };
  }

  // Every X hours
  const everyHour = lower.match(/every\s+(\d+)\s*hour/);
  if (everyHour) {
    const h = parseInt(everyHour[1]);
    return { cronExpr: `0 */${h} * * *`, intervalMs: h * 60 * 60 * 1000 };
  }

  // Daily at HH:MM
  const dailyAt = lower.match(/(?:daily|every day|each day)\s*(?:at)?\s*(\d{1,2}):?(\d{2})?/);
  if (dailyAt) {
    const hour = parseInt(dailyAt[1]);
    const min = parseInt(dailyAt[2] || "0");
    return { cronExpr: `${min} ${hour} * * *`, intervalMs: 24 * 60 * 60 * 1000 };
  }

  // At HH:MM every day
  const atTime = lower.match(/at\s+(\d{1,2}):(\d{2})(?:am|pm)?\s*(?:every day|daily)?/);
  if (atTime) {
    let hour = parseInt(atTime[1]);
    if (lower.includes("pm") && hour < 12) hour += 12;
    if (lower.includes("am") && hour === 12) hour = 0;
    const min = parseInt(atTime[2]);
    return { cronExpr: `${min} ${hour} * * *`, intervalMs: 24 * 60 * 60 * 1000 };
  }

  // Every N seconds (for testing)
  const everySec = lower.match(/every\s+(\d+)\s*sec/);
  if (everySec) {
    const s = parseInt(everySec[1]);
    return { cronExpr: `* * * * *`, intervalMs: s * 1000 };
  }

  return null; // Manual cron expression
}

class CronManager {
  private timer?: ReturnType<typeof setInterval>;

  start() {
    this.timer = setInterval(() => this.tick(), 10_000); // Check every 10s
    console.log("[cron] Scheduler started");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  createJob(job: Omit<CronJob, "id" | "enabled" | "createdAt">): CronJob {
    const id = randomUUID().slice(0, 12);
    const now = new Date().toISOString();
    db.run(
      "INSERT INTO cron_jobs (id, description, schedule, channel_id, agent_id, next_run, enabled, created_at) VALUES (?,?,?,?,?,?,1,?)",
      [id, job.description, job.schedule, job.channelId || null, job.agentId || null, job.nextRun, now]
    );
    console.log(`[cron] Created job ${id}: ${job.description} (next: ${job.nextRun})`);
    return { ...job, id, enabled: true, createdAt: now };
  }

  listJobs(): CronJob[] {
    const rows = db.query("SELECT * FROM cron_jobs WHERE enabled = 1 ORDER BY next_run").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      description: r.description,
      schedule: r.schedule,
      channelId: r.channel_id,
      agentId: r.agent_id,
      nextRun: r.next_run,
      lastRun: r.last_run,
      enabled: r.enabled === 1,
      createdAt: r.created_at,
    }));
  }

  deleteJob(id: string): boolean {
    const result = db.run("DELETE FROM cron_jobs WHERE id = ?", [id]);
    return (result.changes ?? 0) > 0;
  }

  private async tick() {
    const now = new Date().toISOString();
    const due = db.query("SELECT * FROM cron_jobs WHERE enabled = 1 AND next_run <= ? ORDER BY next_run LIMIT 5").all(now) as any[];

    for (const row of due) {
      console.log(`[cron] Executing job ${row.id}: ${row.description}`);
      db.run("UPDATE cron_jobs SET last_run = ? WHERE id = ?", [now, row.id]);

      // Schedule next run
      const parsed = parseNaturalSchedule(row.description);
      if (parsed) {
        const next = new Date(Date.now() + parsed.intervalMs).toISOString();
        db.run("UPDATE cron_jobs SET next_run = ? WHERE id = ?", [next, row.id]);
      }

      // Execute via background agent
      try {
        const agentId = row.agent_id || "cron-worker";
        AgentScheduler.runAgent(agentId, {
          task: row.description,
        });
      } catch (e) {
        console.warn(`[cron] Failed to run job ${row.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}

export const cronManager = new CronManager();

// ─── Register tools ────────────────────────────────────────────

registerTool({
  name: "cron_create",
  description:
    "Create a recurring background job described in natural language. Examples: 'check weather every day at 8am', 'summarize news every 6 hours', 'run healthcheck every 30 minutes'.",
  parameters: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "Natural language description of the job and its schedule",
      },
      channel_id: {
        type: "string",
        description: "Optional channel to send results to (e.g. telegram chat id)",
      },
    },
    required: ["description"],
    additionalProperties: false,
  },
  async execute(args: { description: string; channel_id?: string }) {
    const parsed = parseNaturalSchedule(args.description);
    if (!parsed) {
      return [
        `❌ Could not parse schedule from: "${args.description}"`,
        ``,
        `Supported formats:`,
        `- "every 30 minutes"`,
        `- "every 6 hours"`,
        `- "daily at 8:00"`,
        `- "every day at 9am"`,
        `- "at 14:30 every day"`,
        ``,
        `Or provide a cron expression directly.`,
      ].join("\n");
    }

    const nextRun = new Date(Date.now() + parsed.intervalMs).toISOString();
    const job = cronManager.createJob({
      description: args.description,
      schedule: parsed.cronExpr,
      channelId: args.channel_id,
      nextRun,
    });

    return [
      `✅ Cron job created!`,
      `- ID: ${job.id}`,
      `- Schedule: ${parsed.cronExpr} (every ${parsed.intervalMs / 60000} min)`,
      `- Next run: ${nextRun}`,
      `- Status: ${job.enabled ? "active" : "paused"}`,
    ].join("\n");
  },
});

registerTool({
  name: "cron_list",
  description: "List all active cron jobs",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const jobs = cronManager.listJobs();
    if (jobs.length === 0) return "No active cron jobs.";

    const lines = [`📅 Active cron jobs (${jobs.length}):`];
    jobs.forEach((j, i) => {
      const next = new Date(j.nextRun).toLocaleString();
      const last = j.lastRun ? new Date(j.lastRun).toLocaleString() : "never";
      lines.push(`${i + 1}. [${j.id}] ${j.description}`);
      lines.push(`   Next: ${next} | Last: ${last}`);
    });
    return lines.join("\n");
  },
});

registerTool({
  name: "cron_delete",
  description: "Delete a cron job by ID",
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "Job ID" } },
    required: ["id"],
    additionalProperties: false,
  },
  async execute(args: { id: string }) {
    const ok = cronManager.deleteJob(args.id);
    return ok ? `✅ Deleted cron job ${args.id}` : `❌ Job ${args.id} not found.`;
  },
});
