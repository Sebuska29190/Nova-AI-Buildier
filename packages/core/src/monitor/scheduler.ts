// Monitor/subscription system — topic-based monitoring (1:1 z CheetahClaws)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface Subscription {
  id: string; topic: string; sources: string[];
  interval: number; // minutes
  lastRun?: string;
}

const DB_PATH = join(process.cwd(), "subscriptions.json");
let subs: Subscription[] = [];
let loaded = false;

function load(): void {
  if (loaded) return;
  if (existsSync(DB_PATH)) { try { subs = JSON.parse(readFileSync(DB_PATH, "utf-8")); } catch {} }
  loaded = true;
}

function save(): void { writeFileSync(DB_PATH, JSON.stringify(subs, null, 2)); }

export function subscribe(topic: string, sources: string[], interval: number): Subscription {
  load();
  const sub: Subscription = { id: Date.now().toString(36), topic, sources, interval };
  subs.push(sub);
  save();
  return sub;
}

export function listSubscriptions(): Subscription[] { load(); return [...subs]; }

export function unsubscribe(id: string): boolean {
  load();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  subs.splice(idx, 1);
  save();
  return true;
}
