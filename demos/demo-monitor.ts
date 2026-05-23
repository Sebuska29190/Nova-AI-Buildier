// Demo: Monitor/subscription system — subscribe to topics and monitor sources
// Run with: bun run demos/demo-monitor.ts
import { subscribe, listSubscriptions, unsubscribe } from "../packages/core/src/monitor/scheduler.ts";

function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Monitor/Subscription Demo    ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  // Subscribe to topics
  const subs = [
    subscribe("AI news", ["hackernews", "reddit"], 30),
    subscribe("Tech trends", ["github", "devto"], 60),
    subscribe("Market updates", ["trading"], 15),
    subscribe("Security alerts", ["github", "reddit"], 10),
  ];

  console.log(`  Created ${subs.length} subscriptions:`);
  for (const s of subs) {
    console.log(`    📡 ${s.topic} (every ${s.interval}m) — sources: ${s.sources.join(", ")}`);
  }

  // List all subscriptions
  const allSubs = listSubscriptions();
  console.log(`\n  Active subscriptions (${allSubs.length}):`);
  for (const s of allSubs) {
    console.log(`    🔔 ${s.topic} — ${s.sources.join(", ")} [every ${s.interval}m]`);
  }

  // Unsubscribe
  const removed = unsubscribe(subs[2].id);
  console.log(`\n  ${removed ? "✓ Unsubscribed from Market updates" : "✗ Failed to unsubscribe"}`);

  const remaining = listSubscriptions();
  console.log(`  Remaining subscriptions: ${remaining.length}`);

  console.log("\n  Demo complete.\n");
}

main();
