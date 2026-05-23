// Demo: Checkpoint system — create snapshots and rewind files
// Run with: bun run demos/demo-checkpoint.ts
import { makeSnapshot, listSnapshots, rewindFiles } from "../packages/core/src/checkpoint/store.ts";
import { writeFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Checkpoint Demo              ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  // Create a temp workspace
  const tmpDir = join(process.cwd(), ".nova-demo-checkpoint");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  const testFile = join(tmpDir, "test.txt");
  writeFileSync(testFile, "Version 1: Initial content");

  console.log("  Created test file with 'Version 1: Initial content'");

  // Create snapshot
  const snap1 = makeSnapshot("Initial version", [testFile]);
  console.log(`  ✓ Snapshot 1: ${snap1.id.slice(0, 8)} — ${snap1.description}`);

  // Modify file
  writeFileSync(testFile, "Version 2: Modified content");
  console.log("  Modified file to 'Version 2: Modified content'");

  const snap2 = makeSnapshot("Modified version", [testFile]);
  console.log(`  ✓ Snapshot 2: ${snap2.id.slice(0, 8)} — ${snap2.description}`);

  // Modify again
  writeFileSync(testFile, "Version 3: Final content");
  console.log("  Modified file to 'Version 3: Final content'");

  // List snapshots
  console.log(`\n  All snapshots (${listSnapshots().length}):`);
  for (const s of listSnapshots()) {
    console.log(`    📸 ${s.id.slice(0, 8)} — ${s.description} (${s.files.length} files)`);
  }

  // Rewind to first snapshot
  console.log(`\n  Rewinding to snapshot ${snap1.id.slice(0, 8)}...`);
  const rewound = rewindFiles(snap1.id);
  console.log(`  ${rewound ? "✓ Rewound successfully" : "✗ Rewind failed"}`);

  // Verify content
  const content = readFileSync(testFile, "utf-8");
  console.log(`  File content: "${content}"`);
  console.log(`  ${content === "Version 1: Initial content" ? "✓ Content matches snapshot" : "✗ Content mismatch"}`);

  // Cleanup
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {}

  console.log("\n  Demo complete.\n");
}

main();
