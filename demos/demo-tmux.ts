// Demo: Tmux tools — session management and command execution
// Run with: bun run demos/demo-tmux.ts
import { tmuxAvailable, listSessions, getStatus } from "../packages/core/src/tmux/tools.ts";

function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Tmux Tools Demo              ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  const available = tmuxAvailable();
  console.log(`  Tmux available: ${available ? "✓" : "✗"}`);

  if (available) {
    const sessions = listSessions();
    console.log(`  Active sessions: ${sessions.length}`);
    for (const s of sessions) {
      console.log(`    💻 ${s.name} (${s.windows} windows)`);
    }

    const status = getStatus();
    console.log(`\n  Tmux status: ${status}`);
  } else {
    console.log("  Tmux is not installed or not available on this system.");
    console.log("  Install tmux to use these features.");
  }

  console.log("\n  Demo complete.\n");
}

main();
