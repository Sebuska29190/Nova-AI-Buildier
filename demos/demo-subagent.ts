// Demo: Sub-agent system — spawn and communicate with sub-agents
// Run with: bun run demos/demo-subagent.ts
import { spawnSubAgent } from "../packages/core/src/multi-agent/subagent.ts";
import { sessionManager } from "../packages/core/src/session/manager.ts";
import { agentStore } from "../packages/core/src/agent/store.ts";

async function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Sub-Agent Demo               ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  sessionManager.init(":memory:");
  agentStore.init(":memory:");

  // Define sub-agents
  const agents = [
    { id: "coder-1", name: "Code Assistant", modelRef: "deepseek/deepseek-chat", systemPrompt: "You are a code assistant. Provide concise code solutions." },
    { id: "writer-1", name: "Writing Assistant", modelRef: "deepseek/deepseek-chat", systemPrompt: "You are a writing assistant. Help with content creation." },
  ];

  console.log("  Spawning sub-agents...\n");

  for (const a of agents) {
    try {
      const result = await spawnSubAgent(a, `Introduce yourself briefly as ${a.name}.`);
      console.log(`  🤖 ${a.name}:`);
      console.log(`     ${result.slice(0, 200)}`);
      console.log();
    } catch (e: any) {
      console.log(`  ⚠ ${a.name}: ${e.message} (API key may not be set)`);
      console.log();
    }
  }

  console.log("  Demo complete.\n");
}

main();
