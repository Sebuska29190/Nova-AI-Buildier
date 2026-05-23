// Demo: Workspace system — user-selectable folder for agent file operations
// Run with: bun run demos/demo-workspace.ts
import { workspaceManager } from "../packages/core/src/workspace/manager.ts";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Workspace System Demo        ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  // Create a temp workspace directory
  const tmpDir = join(process.cwd(), ".nova-demo-workspace");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  // Set workspace root
  const ok = workspaceManager.setRoot(tmpDir);
  console.log(`  Workspace set: ${ok ? "✓" : "✗"}`);
  console.log(`  Root: ${workspaceManager.getRoot()}`);
  console.log(`  Active: ${workspaceManager.isActive()}`);

  // Write files
  console.log("\n  Writing files...");
  workspaceManager.writeFile("hello.txt", "Hello, Nova Workspace!");
  workspaceManager.writeFile("src/index.ts", "console.log('Hello from workspace');");
  workspaceManager.writeFile("src/utils/helpers.ts", "export function greet(name: string) { return `Hello ${name}`; }");
  workspaceManager.writeFile("README.md", "# My Project\n\nThis is a test project.");
  console.log("  ✓ hello.txt");
  console.log("  ✓ src/index.ts");
  console.log("  ✓ src/utils/helpers.ts");
  console.log("  ✓ README.md");

  // Read file
  console.log("\n  Reading hello.txt...");
  const content = workspaceManager.readFile("hello.txt");
  console.log(`  Content: "${content}"`);

  // List files
  console.log("\n  Listing all files...");
  const files = workspaceManager.listFiles();
  for (const f of files) {
    console.log(`    📄 ${f.path} (${f.size} bytes)`);
  }

  // Get tree
  console.log("\n  File tree:");
  console.log(workspaceManager.getTree());

  // Search files
  console.log("  Searching for *.ts files...");
  const tsFiles = workspaceManager.searchFiles("*.ts");
  for (const f of tsFiles) {
    console.log(`    🔍 ${f}`);
  }

  // Get state
  const state = workspaceManager.getState();
  if (state) {
    console.log(`\n  Workspace state:`);
    console.log(`    Files: ${state.fileCount}`);
    console.log(`    Dirs: ${state.dirCount}`);
  }

  // Cleanup
  workspaceManager.clear();
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  console.log("\n  Demo complete.\n");
}

main();
