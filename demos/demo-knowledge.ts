// Demo: Knowledge Base
// Run with: bun run demos/demo-knowledge.ts
import { knowledgeBase } from "../packages/core/src/knowledge/store.ts";

async function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Knowledge Base Demo          ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  knowledgeBase.init("./nova-knowledge-demo");

  // Save some entries
  const e1 = knowledgeBase.save({
    title: "Quantum Computing Basics",
    content: "Quantum computing uses qubits instead of bits. Key concepts: superposition, entanglement.",
    tags: ["quantum", "computing", "basics"],
  });
  console.log(`  Saved: ${e1.title} (${e1.id.slice(0, 8)})`);

  const e2 = knowledgeBase.saveBugFix(
    "Fixed memory leak in WebSocket handler",
    "Event listeners not being cleaned up on connection close",
    "Added cleanup in close handler",
    ["gateway/websocket.ts"],
  );
  console.log(`  Saved: ${e2.title} (${e2.id.slice(0, 8)})`);

  // Search
  const results = knowledgeBase.search("quantum");
  console.log(`\n  Search results for 'quantum': ${results.length}`);
  results.forEach((r) => console.log(`    [${r.category}] ${r.title}`));

  // Stats
  const stats = knowledgeBase.getStats();
  console.log("\n  Knowledge Base Stats:");
  for (const [cat, count] of Object.entries(stats)) {
    console.log(`    ${cat}: ${count} entries`);
  }

  // List by category
  const bugFixes = knowledgeBase.listByCategory("bug-fix");
  console.log(`\n  Bug fixes: ${bugFixes.length}`);
  bugFixes.forEach((b) => console.log(`    ${b.title}`));

  console.log();
}

main();
