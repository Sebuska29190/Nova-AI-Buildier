// Demo: Basic chat with Nova agent
// Run with: bun run demos/demo-chat.ts
import { runAgent } from "../packages/core/src/agent/runner.ts";
import { sessionManager } from "../packages/core/src/session/manager.ts";
import { agentStore } from "../packages/core/src/agent/store.ts";
import { registry } from "../packages/core/src/plugin/registry.ts";

async function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Chat Demo                    ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  sessionManager.init(":memory:");
  agentStore.init(":memory:");
  agentStore.create({ name: "demo", description: "Demo agent", modelRef: "deepseek/deepseek-chat", emoji: "🤖" });

  const models = registry.listModels();
  console.log(`  Models available: ${models.length}`);
  models.slice(0, 5).forEach((m) => console.log(`    ${m.ref}`));

  const session = sessionManager.createSession("deepseek/deepseek-chat");
  console.log(`\n  Session: ${session.id.slice(0, 8)}`);

  try {
    const result = await runAgent({
      sessionId: session.id,
      message: "Say hello and introduce yourself briefly.",
      modelRef: "deepseek/deepseek-chat",
      tools: true,
    });
    console.log(`\n  Response:\n  ${result.text}\n`);
  } catch (e: any) {
    console.log(`  Note: ${e.message} (API key may not be set)`);
    console.log("  Set DEEPSEEK_API_KEY env var to run this demo.\n");
  }
}

main();
