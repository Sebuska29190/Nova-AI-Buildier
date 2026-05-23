// Demo: Brainstorming engine — generate creative ideas on any topic
// Run with: bun run demos/demo-brainstorm.ts
import { brainstorm } from "../packages/core/src/brainstorm/engine.ts";

async function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Brainstorm Demo              ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  const topics = [
    "AI-powered developer tools",
    "Sustainable smart home features",
    "Gamification for learning platforms",
  ];

  for (const topic of topics) {
    console.log(`  💡 Topic: ${topic}`);
    try {
      const ideas = await brainstorm(topic);
      console.log(`     Generated ${ideas.length} ideas:`);
      for (const idea of ideas) {
        console.log(`       • ${idea.slice(0, 120)}${idea.length > 120 ? "..." : ""}`);
      }
    } catch (e: any) {
      console.log(`     ⚠ ${e.message}`);
    }
    console.log();
  }

  console.log("  Demo complete.\n");
}

main();
