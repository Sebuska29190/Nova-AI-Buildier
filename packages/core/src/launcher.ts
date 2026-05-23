import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ─── Types ────────────────────────────────────────────────────────
export interface ServiceStatus {
  name: string;
  label: string;
  running: boolean;
  url?: string;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────
const KIMU_COMPOSE = join(import.meta.dirname, "..", "..", "..", "infra", "kimu.yml");
const KIMU_HEALTH_URL = "http://localhost:3456/health";
const KIMU_UI_URL = "http://localhost:3457";
const COMPOSE_CMD = process.platform === "win32" ? "docker compose" : "docker compose";

// ─── Service registry (read by UI) ────────────────────────────────
let _services: ServiceStatus[] = [];

export function getServices(): ServiceStatus[] {
  return _services;
}

// ─── Kimu Lifecycle ──────────────────────────────────────────────
async function startKimu(): Promise<ServiceStatus> {
  const base: ServiceStatus = { name: "kimu", label: "🎬 Video Editor", running: false, url: KIMU_UI_URL };

  // 1. Check Docker
  try {
    execSync("docker --version", { stdio: "pipe", timeout: 5000 });
  } catch {
    return { ...base, error: "Docker not installed" };
  }

  // 2. Check if already running
  try {
    const health = await fetch(KIMU_HEALTH_URL, { signal: AbortSignal.timeout(3000) });
    if (health.ok) {
      console.log("  ✓ Kimu already running at", KIMU_UI_URL);
      return { ...base, running: true };
    }
  } catch { /* not running, proceed */ }

  // 3. Start via docker compose
  try {
    console.log("  🐳 Starting Kimu...");
    execSync(`"${COMPOSE_CMD}" -f "${KIMU_COMPOSE}" up -d`, { stdio: "pipe", timeout: 60000 });
  } catch (e: any) {
    return { ...base, error: `Docker compose failed: ${e.message?.slice(0, 100)}` };
  }

  // 4. Health check (max 60s)
  const start = Date.now();
  while (Date.now() - start < 60000) {
    try {
      const res = await fetch(KIMU_HEALTH_URL, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        console.log("  ✓ Kimu ready at", KIMU_UI_URL);
        return { ...base, running: true };
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 3000));
  }

  return { ...base, error: "Health check timeout (60s)" };
}

// ─── Master Launcher ──────────────────────────────────────────────
export async function launchAll(): Promise<ServiceStatus[]> {
  console.log("\n── Nova Launcher ──────────────────────────────");

  // Start Kimu
  const kimuStatus = await startKimu();
  _services = [kimuStatus];

  if (kimuStatus.running) {
    console.log(`  📡 Kimu UI: ${KIMU_UI_URL}`);
  } else {
    console.log(`  ⚠ Kimu offline: ${kimuStatus.error || "unknown"}`);
  }

  console.log("  ──────────────────────────────────────────────\n");
  return _services;
}
