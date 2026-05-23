// Checkpoint system — file backups and snapshots (1:1 z CheetahClaws)
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const CHECKPOINT_DIR = join(process.cwd(), "checkpoints");

export interface Snapshot {
  id: string; description: string;
  files: Array<{ path: string; backupPath: string }>;
  createdAt: string;
}

export function makeSnapshot(description: string, filePaths: string[]): Snapshot {
  mkdirSync(CHECKPOINT_DIR, { recursive: true });
  const id = Date.now().toString(36);
  const dir = join(CHECKPOINT_DIR, id);
  mkdirSync(dir, { recursive: true });

  const files = filePaths.map((fp) => {
    const backupPath = join(dir, Buffer.from(fp).toString("base64url"));
    if (existsSync(fp)) copyFileSync(fp, backupPath);
    return { path: fp, backupPath };
  });

  const snapshot: Snapshot = { id, description, files, createdAt: new Date().toISOString() };
  writeFileSync(join(dir, "snapshot.json"), JSON.stringify(snapshot, null, 2));
  return snapshot;
}

export function listSnapshots(): Snapshot[] {
  if (!existsSync(CHECKPOINT_DIR)) return [];
  return readdirSync(CHECKPOINT_DIR).map((id) => {
    try { return JSON.parse(readFileSync(join(CHECKPOINT_DIR, id, "snapshot.json"), "utf-8")); } catch { return null; }
  }).filter(Boolean);
}

export function rewindFiles(snapshotId: string): boolean {
  const dir = join(CHECKPOINT_DIR, snapshotId);
  if (!existsSync(dir)) return false;
  try {
    const meta: Snapshot = JSON.parse(readFileSync(join(dir, "snapshot.json"), "utf-8"));
    for (const f of meta.files) {
      if (existsSync(f.backupPath)) copyFileSync(f.backupPath, f.path);
    }
    return true;
  } catch { return false; }
}
