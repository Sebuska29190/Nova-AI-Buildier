// Demo: Session management — create, append, list, resume sessions
// Run with: bun run demos/demo-session.ts
import { sessionManager } from "../packages/core/src/session/manager.ts";

function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Session Management Demo      ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  sessionManager.init(":memory:");

  // Create sessions
  const session1 = sessionManager.createSession("deepseek/deepseek-chat", { agentId: "agent-1", systemPrompt: "You are a helpful assistant." });
  const session2 = sessionManager.createSession("anthropic/claude-sonnet-4", { agentId: "agent-2" });

  console.log(`  Session 1: ${session1.id.slice(0, 8)} — ${session1.modelRef}`);
  console.log(`  Session 2: ${session2.id.slice(0, 8)} — ${session2.modelRef}`);

  // Append messages
  sessionManager.append(session1.id, "user", "What is the capital of France?");
  sessionManager.append(session1.id, "assistant", "The capital of France is Paris.");
  sessionManager.append(session1.id, "user", "What is its population?");
  sessionManager.append(session1.id, "assistant", "Paris has a population of approximately 2.1 million people within the city limits.");

  sessionManager.append(session2.id, "user", "Explain quantum computing.");
  sessionManager.append(session2.id, "assistant", "Quantum computing uses qubits to perform computations...");

  // List all sessions
  const allSessions = sessionManager.listSessions();
  console.log(`\n  All sessions (${allSessions.length}):`);
  for (const s of allSessions) {
    const transcript = sessionManager.getTranscript(s.id);
    console.log(`    📝 ${s.id.slice(0, 8)} — ${s.modelRef} (${transcript.length} messages)`);
  }

  // Get transcript
  const transcript = sessionManager.getTranscript(session1.id);
  console.log(`\n  Transcript for session ${session1.id.slice(0, 8)}:`);
  for (const msg of transcript) {
    console.log(`    [${msg.role}] ${msg.content.slice(0, 60)}${msg.content.length > 60 ? "..." : ""}`);
  }

  // Save to knowledge base
  sessionManager.saveToKnowledge(session1.id);
  console.log(`\n  ✓ Saved session ${session1.id.slice(0, 8)} to knowledge base`);

  console.log("\n  Demo complete.\n");
}

main();
