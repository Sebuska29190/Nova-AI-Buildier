// Demo: Kernel system — AgentFS virtual filesystem + Event Ledger
// Run with: bun run demos/demo-kernel.ts
import { kernel, agentFS, ledger } from "../packages/core/src/kernel/index.ts";

function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Kernel System Demo           ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  // Init kernel
  kernel.init({ basePath: ":memory:" });
  console.log(`  Kernel initialized: ${kernel.isInitialized()}`);

  // AgentFS: write agent files
  console.log("\n  AgentFS: Writing agent files...");
  agentFS.writeAgentFile("agent-1", "goals.md", "# Goals\n1. Help users\n2. Learn continuously");
  agentFS.writeAgentFile("agent-1", "notes.md", "# Notes\n- Remember user preferences");
  agentFS.writeAgentFile("agent-2", "config.md", "# Config\nModel: deepseek-chat");

  console.log("  ✓ agent-1/goals.md written");
  console.log("  ✓ agent-1/notes.md written");
  console.log("  ✓ agent-2/config.md written");

  // AgentFS: read agent files
  console.log("\n  AgentFS: Reading agent files...");
  const goals = agentFS.readAgentFile("agent-1", "goals.md");
  console.log(`  agent-1/goals.md: ${goals?.slice(0, 50)}...`);

  // AgentFS: share to global
  console.log("\n  AgentFS: Sharing to global...");
  agentFS.shareToGlobal("agent-1", "goals.md");
  console.log("  ✓ agent-1/goals.md shared to global");

  // Ledger: append entries
  console.log("\n  Ledger: Recording events...");
  const entry1 = ledger.append({ agentId: "agent-1", action: "file_write", target: "goals.md", status: "completed", detail: "Wrote goals.md" });
  const entry2 = ledger.append({ agentId: "agent-1", action: "file_read", target: "notes.md", status: "completed", detail: "Read notes.md" });
  const entry3 = ledger.append({ agentId: "agent-2", action: "config_update", target: "config.md", status: "completed", detail: "Updated model config" });
  const entry4 = ledger.append({ agentId: "agent-1", action: "tool_call", target: "web_search", status: "failed", detail: "Timeout error" });

  console.log(`  ✓ ${entry1.action} (${entry1.status})`);
  console.log(`  ✓ ${entry2.action} (${entry2.status})`);
  console.log(`  ✓ ${entry3.action} (${entry3.status})`);
  console.log(`  ✓ ${entry4.action} (${entry4.status})`);

  // Ledger: query
  console.log("\n  Ledger: Query by agent-1...");
  const agent1Entries = ledger.query({ agentId: "agent-1" });
  console.log(`  ${agent1Entries.length} entries for agent-1`);

  // Ledger: query by status
  console.log("\n  Ledger: Query failed actions...");
  const failedEntries = ledger.query({ status: "failed" });
  console.log(`  ${failedEntries.length} failed entries`);

  // Ledger: stats
  console.log("\n  Ledger: Statistics...");
  const stats = ledger.getStats();
  console.log(`  Total entries: ${stats.total}`);
  console.log(`  By agent: ${JSON.stringify(stats.byAgent)}`);
  console.log(`  By action: ${JSON.stringify(stats.byAction)}`);

  console.log("\n  Demo complete.\n");
}

main();
