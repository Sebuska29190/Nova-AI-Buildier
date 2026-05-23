#!/usr/bin/env bun
import { unlinkSync, existsSync, statSync, copyFileSync } from "node:fs";
import { Database } from "bun:sqlite";
import { join } from "node:path";

const root = "D:/nova";
const dbPath = join(root, "nova.db");
const walPath = join(root, "nova.db-wal");
const shmPath = join(root, "nova.db-shm");

console.log("=== Nova DB Repair ===");

// Backup DB first
const backupPath = join(root, "nova.db.bak");
copyFileSync(dbPath, backupPath);
console.log(`1. Backed up DB to ${backupPath}`);

// Try to remove WAL/SHM
console.log("2. Removing WAL/SHM files...");
for (const f of [walPath, shmPath]) {
  try {
    if (existsSync(f)) {
      unlinkSync(f);
      console.log(`   Removed: ${f}`);
    }
  } catch (e: any) {
    if (e.code === "EBUSY") {
      console.log(`   BUSY (locked): ${f}`);
    } else {
      console.log(`   Error: ${f}: ${e.message}`);
    }
  }
}

// Try opening with WAL off
console.log("3. Opening database...");
try {
  const db = new Database(dbPath, { readwrite: true, create: false });
  db.run("PRAGMA journal_mode = DELETE");
  
  // Verify integrity
  const rows = db.query("PRAGMA integrity_check").all() as any[];
  console.log(`   Integrity: ${rows[0]?.[0] ?? "unknown"}`);
  
  // Show tables
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  console.log(`   Tables: ${tables.map((t: any) => t.name).join(", ")}`);
  
  // Session count
  const sessions = db.query("SELECT COUNT(*) as c FROM sessions").get() as any;
  console.log(`   Sessions: ${sessions?.c ?? 0}`);
  
  db.close();
  console.log("✓ Database repaired successfully!");
} catch (e: any) {
  console.log(`✗ Failed to open: ${e.message}`);
  
  // Last resort: copy fresh DB backup
  console.log("4. Trying backup DB from desktop...");
  const backupSrc = "C:/Users/Domowy/Desktop/dane/dane (2)/nova/nova.db";
  try {
    copyFileSync(backupSrc, dbPath);
    console.log("   Copied fresh DB from backup");
    
    // Remove any WAL from backup that may have been copied
    try { unlinkSync(walPath); } catch {}
    try { unlinkSync(shmPath); } catch {}
    
    const db2 = new Database(dbPath, { readwrite: true, create: false });
    const tables2 = db2.query("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    console.log(`   Tables: ${tables2.map((t: any) => t.name).join(", ")}`);
    db2.close();
    console.log("✓ Backup DB works!");
  } catch (e2: any) {
    console.log(`✗ Backup also failed: ${e2.message}`);
  }
}
