// Demo: Multi-agent collaboration
// Run with: bun run demos/demo-multi-agent.ts
import { fanOut, collaborativeRun } from "../packages/core/src/multi-agent/fanout.ts";
import { agentStore } from "../packages/core/src/agent/store.ts";

async function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Multi-Agent Demo             ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  agentStore.init(":memory:");
  agentStore.create({ name: "researcher", description: "Research agent", modelRef: "deepseek/deepseek-chat", emoji: "🔬" });
  agentStore.create({ name: "analyst", description: "Analysis agent", modelRef: "deepseek/deepseek-chat", emoji: "📊" });

  const agents = agentStore.list();
  console.log(`  Agents available: ${agents.length}`);
  agents.forEach((a) => console.log(`    ${a.emoji} ${a.name} (${a.id.slice(0, 8)})`));

  // Demo 1: Fan-out parallel tasks
  console.log("\n  Demo 1: Fan-out parallel tasks\n");
  if (agents.length >= 2) {
    const results = await fanOut([
      { id: "t1", agentId: agents[0].id, instruction: "Research quantum computing trends" },
      { id: "t2", agentId: agents[1].id, instruction: "Analyze market impact of AI" },
    ]);
    results.forEach((r) => {
      console.log(`  Agent: ${r.agentName}`);
      console.log(`  Result: ${r.result?.slice(0, 100) || "N/A"}`);
      if (r.error) console.log(`  Error: ${r.error}`);
      console.log();
    });
  }

  // Demo 2: Collaborative run
  console.log("  Demo 2: Collaborative orchestration\n");
  try {
    const collabResult = await collaborativeRun(
      "Plan a weekend hackathon project",
      agents.map((a) => a.id),
      "Focus on AI/ML projects",
    );
    console.log(`  Orchestration:\n  ${collabResult.orchestration.slice(0, 200)}...\n`);
    console.log(`  Agent results: ${collabResult.agentResults.length}\n`);
  } catch (e: any) {
    console.log(`  Note: ${e.message}\n`);
  }
}

main();
