// Demo: Memory system — save, search, and manage memories
// Run with: bun run demos/demo-memory.ts
import { memoryStore } from "../packages/core/src/memory/store.ts";

function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Memory System Demo           ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  memoryStore.init();

  // Save memories
  const memories = [
    { name: "user-name", content: "User's name is Alex", tags: ["user", "identity"], scope: "user" as const, importance: "high" as const },
    { name: "user-prefs", content: "User prefers dark mode and concise responses", tags: ["user", "preferences"], scope: "user" as const, importance: "medium" as const },
    { name: "project-goals", content: "Project Nova aims to be a full-featured AI agent platform", tags: ["project", "goals"], scope: "project" as const, importance: "high" as const },
    { name: "api-keys", content: "API keys are stored in .env file", tags: ["config", "security"], scope: "project" as const, importance: "high" as const },
    { name: "tech-stack", content: "Built with Bun, TypeScript, Hono, SQLite, Svelte", tags: ["project", "tech"], scope: "project" as const, importance: "medium" as const },
  ];

  for (const m of memories) {
    const saved = memoryStore.save(m.name, m.content, m.tags, m.scope, m.importance);
    console.log(`  ✓ Saved: ${saved.name} [${saved.scope}/${saved.importance}]`);
  }

  // Search memories
  console.log("\n  Searching for 'user'...");
  const userResults = memoryStore.search("user");
  for (const r of userResults) {
    console.log(`    📝 ${r.name}: ${r.content.slice(0, 60)}`);
  }

  console.log("\n  Searching for 'project'...");
  const projectResults = memoryStore.search("project");
  for (const r of projectResults) {
    console.log(`    📝 ${r.name}: ${r.content.slice(0, 60)}`);
  }

  // List all memories
  console.log(`\n  All memories (${memoryStore.getAll().length}):`);
  for (const m of memoryStore.getAll()) {
    console.log(`    [${m.scope}] ${m.name} — ${m.content.slice(0, 50)}`);
  }

  console.log("\n  Demo complete.\n");
}

main();
