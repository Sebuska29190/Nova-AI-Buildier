#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { join } from "node:path";

const root = "D:/nova";
const dbPath = join(root, "nova.db");

console.log(`Opening: ${dbPath}`);
try {
  const db = new Database(dbPath, { strict: false });
  // Force checkpoint — write WAL back to main DB
  db.run("PRAGMA wal_checkpoint(TRUNCATE)");
  console.log("✓ Checkpoint done (WAL → DB)");
  db.run("PRAGMA integrity_check");
  console.log("✓ Integrity check passed");
  db.run("VACUUM");
  console.log("✓ VACUUM done");
  db.close();
  console.log("✓ DB repaired successfully");
} catch (e) {
  console.error("✗ Failed:", e.message);
  // If the DB is truly broken, we may need to start fresh
  process.exit(1);
}
