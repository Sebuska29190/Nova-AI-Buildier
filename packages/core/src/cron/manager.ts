/**
 * Natural-Language Cron Scheduler — Premium Edition
 *
 * Users describe jobs in natural language, and the scheduler
 * persists them and executes via background agents.
 * Full lifecycle: create, pause, resume, run-now, logs, delete.
 */
import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { registerTool } from "../plugin/tools.ts";
import { agentScheduler as AgentScheduler } from "../agent/scheduler.ts";
import { safeMessage } from "../errors.ts";

const db = new Database("nova.db");
db.run("PRAGMA journal_mode = WAL");
db.run(`CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  schedule TEXT NOT NULL,
  channel_id TEXT,
  agent_id TEXT,
  next_run TEXT NOT NULL,
  last_run TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
)`);
db.run(`CREATE TABLE IF NOT EXISTS cron_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  output TEXT,
  error TEXT,
  duration_ms INTEGER,
  FOREIGN KEY (job_id) REFERENCES cron_jobs(id)
)`);

export interface CronJob {
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

export interface CronRun {
  id: string;
  jobId: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "completed" | "error";
  output?: string;
  error?: string;
  durationMs?: number;
}

export function parseNaturalSchedule(description: string): { cronExpr: string; intervalMs: number } | null {
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
    this.timer = setInterval(() => this.tick(), 10_000);
    console.log("[cron] Scheduler started");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  // ─── CRUD ────────────────────────────────────────────────────────

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

  listJobs(includeDisabled = false): CronJob[] {
    const sql = includeDisabled
      ? "SELECT * FROM cron_jobs ORDER BY next_run"
      : "SELECT * FROM cron_jobs WHERE enabled = 1 ORDER BY next_run";
    const rows = db.query(sql).all() as any[];
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

  getJob(id: string): CronJob | null {
    const r = db.query("SELECT * FROM cron_jobs WHERE id = ?").get(id) as any;
    if (!r) return null;
    return {
      id: r.id, description: r.description, schedule: r.schedule,
      channelId: r.channel_id, agentId: r.agent_id,
      nextRun: r.next_run, lastRun: r.last_run,
      enabled: r.enabled === 1, createdAt: r.created_at,
    };
  }

  updateJob(id: string, fields: Partial<Pick<CronJob, "description" | "schedule" | "nextRun" | "channelId" | "agentId">>): boolean {
    const existing = this.getJob(id);
    if (!existing) return false;
    const set: string[] = [];
    const vals: any[] = [];
    if (fields.description !== undefined) { set.push("description = ?"); vals.push(fields.description); }
    if (fields.schedule !== undefined) { set.push("schedule = ?"); vals.push(fields.schedule); }
    if (fields.nextRun !== undefined) { set.push("next_run = ?"); vals.push(fields.nextRun); }
    if (fields.channelId !== undefined) { set.push("channel_id = ?"); vals.push(fields.channelId); }
    if (fields.agentId !== undefined) { set.push("agent_id = ?"); vals.push(fields.agentId); }
    if (set.length === 0) return true;
    vals.push(id);
    db.run(`UPDATE cron_jobs SET ${set.join(", ")} WHERE id = ?`, vals);
    console.log(`[cron] Updated job ${id}`);
    return true;
  }

  deleteJob(id: string): boolean {
    db.run("DELETE FROM cron_runs WHERE job_id = ?", [id]);
    const result = db.run("DELETE FROM cron_jobs WHERE id = ?", [id]);
    return (result.changes ?? 0) > 0;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────

  pauseJob(id: string): boolean {
    const result = db.run("UPDATE cron_jobs SET enabled = 0 WHERE id = ?", [id]);
    const ok = (result.changes ?? 0) > 0;
    if (ok) console.log(`[cron] Paused job ${id}`);
    return ok;
  }

  resumeJob(id: string): boolean {
    const row = db.query("SELECT * FROM cron_jobs WHERE id = ?").get(id) as any;
    if (!row) return false;
    // Recalculate next_run from schedule
    const parsed = parseNaturalSchedule(row.description);
    const nextRun = parsed
      ? new Date(Date.now() + parsed.intervalMs).toISOString()
      : new Date(Date.now() + 3600000).toISOString();
    db.run("UPDATE cron_jobs SET enabled = 1, next_run = ? WHERE id = ?", [nextRun, id]);
    console.log(`[cron] Resumed job ${id}, next: ${nextRun}`);
    return true;
  }

  async runNow(id: string): Promise<CronRun> {
    const job = this.getJob(id);
    if (!job) throw new Error(`Job not found: ${id}`);

    const runId = randomUUID().slice(0, 12);
    const startedAt = new Date().toISOString();
    db.run(
      "INSERT INTO cron_runs (id, job_id, started_at, status) VALUES (?,?,?,'running')",
      [runId, job.id, startedAt]
    );

    // Update last_run
    db.run("UPDATE cron_jobs SET last_run = ? WHERE id = ?", [startedAt, id]);

    const run: CronRun = { id: runId, jobId: job.id, startedAt, status: "running" };

    try {
      const agentId = job.agentId || "cron-worker";
      // Auto-create cron worker agent if needed
      const { agentStore } = await import("../agent/store.ts");
      if (!agentStore.get(agentId)) {
        agentStore.create({
          name: "Cron Worker",
          description: "Default agent for scheduled cron tasks",
          modelRef: "deepseek/deepseek-chat",
          systemPrompt: "You are a Nova cron worker. Execute the assigned task using available tools.",
          emoji: "⏰",
        });
      }

      const result = await AgentScheduler.startAgent(agentId, { task: job.description });
      const finishedAt = new Date().toISOString();
      const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

      run.status = "completed";
      run.finishedAt = finishedAt;
      run.output = `Agent run: ${result.runId} (session: ${result.sessionId})`;
      run.durationMs = durationMs;

      db.run(
        "UPDATE cron_runs SET finished_at = ?, status = 'completed', output = ?, duration_ms = ? WHERE id = ?",
        [finishedAt, run.output, durationMs, runId]
      );
    } catch (e: unknown) {
      const finishedAt = new Date().toISOString();
      const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
      const errMsg = safeMessage(e);

      run.status = "error";
      run.finishedAt = finishedAt;
      run.error = errMsg;
      run.durationMs = durationMs;

      db.run(
        "UPDATE cron_runs SET finished_at = ?, status = 'error', error = ?, duration_ms = ? WHERE id = ?",
        [finishedAt, errMsg, durationMs, runId]
      );
    }

    // Schedule next run if job is still enabled
    const updatedJob = this.getJob(id);
    if (updatedJob?.enabled) {
      const parsed = parseNaturalSchedule(job.description);
      if (parsed) {
        const next = new Date(Date.now() + parsed.intervalMs).toISOString();
        db.run("UPDATE cron_jobs SET next_run = ? WHERE id = ?", [next, id]);
      }
    }

    return run;
  }

  // ─── Run History ──────────────────────────────────────────────────

  getJobRuns(jobId: string, limit = 20): CronRun[] {
    const rows = db.query(
      "SELECT * FROM cron_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?"
    ).all(jobId, limit) as any[];
    return rows.map((r) => ({
      id: r.id, jobId: r.job_id,
      startedAt: r.started_at, finishedAt: r.finished_at,
      status: r.status, output: r.output, error: r.error,
      durationMs: r.duration_ms,
    }));
  }

  // ─── Scheduler Tick ──────────────────────────────────────────────

  private async tick() {
    const now = new Date().toISOString();
    const due = db.query(
      "SELECT * FROM cron_jobs WHERE enabled = 1 AND next_run <= ? ORDER BY next_run LIMIT 5"
    ).all(now) as any[];

    for (const row of due) {
      console.log(`[cron] Executing job ${row.id}: ${row.description}`);
      try {
        await this.runNow(row.id);
      } catch (e) {
        console.warn(`[cron] Failed to run job ${row.id}: ${safeMessage(e)}`);
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
  description: "List all cron jobs (active and paused)",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const jobs = cronManager.listJobs(true);
    if (jobs.length === 0) return "No cron jobs.";

    const lines = [`📅 Cron jobs (${jobs.length}):`];
    jobs.forEach((j, i) => {
      const next = new Date(j.nextRun).toLocaleString();
      const last = j.lastRun ? new Date(j.lastRun).toLocaleString() : "never";
      const status = j.enabled ? "active" : "paused";
      lines.push(`${i + 1}. [${status}] ${j.description}`);
      lines.push(`   Next: ${next} | Last: ${last} | ID: ${j.id}`);
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

registerTool({
  name: "cron_pause",
  description: "Pause a cron job by ID (stop scheduled runs without deleting)",
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "Job ID" } },
    required: ["id"],
    additionalProperties: false,
  },
  async execute(args: { id: string }) {
    const ok = cronManager.pauseJob(args.id);
    return ok ? `⏸️ Paused cron job ${args.id}` : `❌ Job ${args.id} not found.`;
  },
});

registerTool({
  name: "cron_resume",
  description: "Resume a paused cron job",
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "Job ID" } },
    required: ["id"],
    additionalProperties: false,
  },
  async execute(args: { id: string }) {
    const ok = cronManager.resumeJob(args.id);
    return ok ? `▶️ Resumed cron job ${args.id}` : `❌ Job ${args.id} not found.`;
  },
});

registerTool({
  name: "cron_run",
  description: "Run a cron job immediately (regardless of schedule)",
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "Job ID" } },
    required: ["id"],
    additionalProperties: false,
  },
  async execute(args: { id: string }) {
    try {
      const run = await cronManager.runNow(args.id);
      return `▶️ Triggered run for job ${args.id}\n  Run ID: ${run.id}\n  Status: ${run.status}\n  Duration: ${run.durationMs ?? "N/A"}ms\n  ${run.error ? `Error: ${run.error}` : `Output: ${run.output || "(no output)"}`}`;
    } catch (e) {
      return `❌ Failed: ${safeMessage(e)}`;
    }
  },
});

registerTool({
  name: "cron_logs",
  description: "View run history/logs for a cron job",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Job ID" },
      limit: { type: "number", description: "Max runs to show (default 10)" },
    },
    required: ["id"],
    additionalProperties: false,
  },
  async execute(args: { id: string; limit?: number }) {
    const runs = cronManager.getJobRuns(args.id, args.limit || 10);
    if (runs.length === 0) return `No runs for job ${args.id}.`;

    const lines = [`📋 Run history for ${args.id} (${runs.length} runs):`];
    runs.forEach((r, i) => {
      const started = new Date(r.startedAt).toLocaleString();
      const statusEmoji = r.status === "completed" ? "✅" : r.status === "error" ? "❌" : "⏳";
      lines.push(`${i + 1}. ${statusEmoji} ${started} — ${r.status}${r.durationMs ? ` (${r.durationMs}ms)` : ""}`);
      if (r.output) lines.push(`   Output: ${r.output.slice(0, 200)}`);
      if (r.error) lines.push(`   Error: ${r.error.slice(0, 200)}`);
    });
    return lines.join("\n");
  },
});
