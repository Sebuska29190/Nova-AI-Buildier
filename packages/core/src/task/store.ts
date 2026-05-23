// Task system — CRUD + persistence (1:1 z CheetahClaws)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export interface Task {
  id: string; title: string; description?: string;
  status: TaskStatus; priority: "low" | "medium" | "high";
  tags: string[]; createdAt: string; updatedAt: string;
}

const DB_PATH = join(process.cwd(), "tasks.json");
let cache: Task[] = [];
let loaded = false;

function load(): void {
  if (loaded) return;
  if (existsSync(DB_PATH)) {
    try { cache = JSON.parse(readFileSync(DB_PATH, "utf-8")); } catch {}
  }
  loaded = true;
}

function save(): void {
  writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
}

export function createTask(title: string, desc?: string, priority: "low" | "medium" | "high" = "medium", tags: string[] = []): Task {
  load();
  const task: Task = { id: randomUUID().slice(0, 8), title, description: desc, status: "todo", priority, tags, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  cache.push(task);
  save();
  return task;
}

export function listTasks(status?: TaskStatus): Task[] {
  load();
  let result = [...cache];
  if (status) result = result.filter((t) => t.status === status);
  return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function updateTask(id: string, updates: Partial<Pick<Task, "status" | "title" | "description" | "priority" | "tags">>): Task | null {
  load();
  const idx = cache.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  cache[idx] = { ...cache[idx], ...updates, updatedAt: new Date().toISOString() };
  save();
  return cache[idx];
}

export function deleteTask(id: string): boolean {
  load();
  const idx = cache.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  cache.splice(idx, 1);
  save();
  return true;
}
