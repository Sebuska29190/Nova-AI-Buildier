import { randomUUID } from "node:crypto";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { emitEvent } from "../event-bus/index.ts";
import { safeMessage } from "../errors.ts";

export interface WorkTask {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "done" | "failed" | "cancelled";
  assignedAgent?: string;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkJob {
  id: string;
  title: string;
  tasks: WorkTask[];
  status: "running" | "done" | "failed" | "cancelled";
  modelRef?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), "data");
const JOBS_PATH = join(DATA_DIR, "worker-jobs.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadJobs(): WorkJob[] {
  try {
    if (existsSync(JOBS_PATH)) {
      const raw = readFileSync(JOBS_PATH, "utf-8");
      return JSON.parse(raw) as WorkJob[];
    }
  } catch { /* corrupted — start fresh */ }
  return [];
}

function saveJobs(jobs: WorkJob[]): void {
  ensureDataDir();
  writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2), "utf-8");
}

// ─── In-memory store (synced to disk) ────────────────────────────────────────

const jobs = new Map<string, WorkJob>();

// Abort controllers for cancellation
const abortControllers = new Map<string, AbortController>();

// SSE clients for live streaming
const sseClients = new Set<(event: string, data: any) => void>();

function notifySSE(event: string, data: any): void {
  for (const send of sseClients) {
    try { send(event, data); } catch {}
  }
}

export function subscribeSSE(send: (event: string, data: any) => void): () => void {
  sseClients.add(send);
  return () => sseClients.delete(send);
}

// Load persisted jobs on startup
const persisted = loadJobs();
for (const j of persisted) {
  // Restore as completed — don't re-run
  if (j.status === "running") j.status = "failed";
  jobs.set(j.id, j);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getWorkJobs(): WorkJob[] {
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getWorkJob(id: string): WorkJob | undefined {
  return jobs.get(id);
}

export function createWorkJob(title: string, tasks: string[], modelRef?: string): WorkJob {
  const id = randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const job: WorkJob = {
    id, title, status: "running", createdAt: now, updatedAt: now,
    modelRef: modelRef || "deepseek/deepseek-chat",
    tasks: tasks.map((desc) => ({
      id: randomUUID().slice(0, 8), description: desc,
      status: "pending", createdAt: now, updatedAt: now,
    })),
  };
  jobs.set(id, job);
  persist();
  notifySSE("job_created", { job });
  executeJob(job).catch(() => {});
  return job;
}

export function cancelWorkJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.status !== "running") return false;

  // Abort the current task execution
  const ctrl = abortControllers.get(id);
  if (ctrl) ctrl.abort();

  job.status = "cancelled";
  job.updatedAt = new Date().toISOString();
  for (const task of job.tasks) {
    if (task.status === "pending" || task.status === "in_progress") {
      task.status = "cancelled";
      task.updatedAt = new Date().toISOString();
    }
  }
  persist();
  notifySSE("job_updated", { job });
  return true;
}

export function deleteWorkJob(id: string): boolean {
  const ok = jobs.delete(id);
  if (ok) {
    persist();
    notifySSE("job_deleted", { id });
  }
  return ok;
}

// ─── Execution ───────────────────────────────────────────────────────────────

async function executeJob(job: WorkJob): Promise<void> {
  const ctrl = new AbortController();
  abortControllers.set(job.id, ctrl);

  for (const task of job.tasks) {
    // Check cancellation before each task
    if (ctrl.signal.aborted) {
      job.status = "cancelled";
      job.updatedAt = new Date().toISOString();
      persist();
      notifySSE("job_updated", { job });
      return;
    }

    task.status = "in_progress";
    task.updatedAt = new Date().toISOString();
    persist();
    notifySSE("task_updated", { jobId: job.id, task });

    try {
      const result = await executeTask(task, job.modelRef, ctrl.signal);
      if (ctrl.signal.aborted) {
        task.status = "cancelled";
      } else {
        task.status = "done";
        task.result = result;
      }
      emitEvent({
        type: "event", kind: "tool_result", sessionId: job.id,
        data: { toolCallId: task.id, name: task.description, result: result.slice(0, 200) },
      });
    } catch (e: unknown) {
      if (ctrl.signal.aborted) {
        task.status = "cancelled";
      } else {
        task.status = "failed";
        task.error = safeMessage(e);
      }
      emitEvent({
        type: "event", kind: "message", sessionId: job.id,
        data: { step: "error", text: `Task ${task.description} failed: ${safeMessage(e)}` },
      });
    }

    task.updatedAt = new Date().toISOString();
    persist();
    notifySSE("task_updated", { jobId: job.id, task });
  }

  job.status = job.tasks.every((t) => t.status === "done") ? "done"
    : job.tasks.some((t) => t.status === "cancelled") ? "cancelled"
    : "failed";
  job.updatedAt = new Date().toISOString();
  abortControllers.delete(job.id);
  persist();
  notifySSE("job_updated", { job });
}

async function executeTask(task: WorkTask, modelRef?: string, signal?: AbortSignal): Promise<string> {
  const prompt = `You are an expert developer. Implement the following task:

${task.description}

Return ONLY the implementation code or solution. Be concise and complete.`;

  try {
    const { registry } = await import("../plugin/registry.ts");
    const resolved = registry.resolveModel(modelRef || "deepseek/deepseek-chat");
    if (!resolved) return `Model not available. Task: ${task.description}`;

    let response = "";
    await resolved.provider.stream({
      model: resolved.model.id,
      messages: [
        { role: "system", content: "You are an expert developer. Implement tasks concisely and correctly." },
        { role: "user", content: prompt },
      ],
      signal,
      onChunk: (chunk) => {
        if (chunk.type === "text") response += chunk.text;
        if (chunk.type === "error") throw new Error(chunk.message);
      },
    });

    return response || `Implementation for: ${task.description}`;
  } catch (e: unknown) {
    if (signal?.aborted) throw new Error("Cancelled");
    return `Task error: ${safeMessage(e)}`;
  }
}

function persist(): void {
  saveJobs([...jobs.values()]);
}
