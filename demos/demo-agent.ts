// Demo: Agent management — create, list, update agents
// Run with: bun run demos/demo-agent.ts
import { agentStore } from "../packages/core/src/agent/store.ts";

function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Agent Management Demo        ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  agentStore.init(":memory:");

  // Create agents
  const agents = [
    { name: "coder", description: "Code specialist", modelRef: "deepseek/deepseek-chat", emoji: "💻", skills: ["typescript", "python"] },
    { name: "writer", description: "Content writer", modelRef: "openai/gpt-4o", emoji: "✍️", skills: ["writing", "editing"] },
    { name: "researcher", description: "Research assistant", modelRef: "anthropic/claude-sonnet-4", emoji: "🔬", skills: ["research", "analysis"] },
    { name: "debugger", description: "Bug fixer", modelRef: "deepseek/deepseek-reasoner", emoji: "🐛", skills: ["debugging", "testing"] },
  ];

  for (const a of agents) {
    const created = agentStore.create(a);
    console.log(`  ✓ Created: ${created.emoji} ${created.name} (${created.id.slice(0, 8)})`);
  }

  // List all agents
  console.log(`\n  All agents (${agentStore.list().length}):`);
  for (const a of agentStore.list()) {
    console.log(`    ${a.emoji} ${a.name} — ${a.description} [${a.modelRef}]`);
  }

  // Update an agent
  const coder = agentStore.list().find((a) => a.name === "coder");
  if (coder) {
    agentStore.update(coder.id, { description: "Senior code specialist with full-stack expertise" });
    console.log(`\n  ✓ Updated: ${coder.emoji} ${coder.name}`);
  }

  // Show agent workspace files
  const first = agentStore.list()[0];
  console.log(`\n  Workspace files for ${first.name}:`);
  for (const f of agentStore.listFiles(first.id)) {
    console.log(`    📄 ${f.name}`);
  }

  console.log("\n  Demo complete.\n");
}

main();
