// Demo: Cron scheduler — schedule recurring jobs
// Run with: bun run demos/demo-cron.ts
import { addCronJob, listCronJobs, removeCronJob } from "../packages/core/src/cron/scheduler.ts";

function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Cron Scheduler Demo          ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  // Add cron jobs
  const jobs = [
    addCronJob("daily-summary", "0 9 * * *", "Generate daily summary report"),
    addCronJob("hourly-check", "0 * * * *", "Check for system updates"),
    addCronJob("weekly-backup", "0 2 * * 0", "Create weekly backup"),
    addCronJob("health-ping", "*/5 * * * *", "Send health check ping"),
  ];

  console.log(`  Created ${jobs.length} cron jobs:`);
  for (const j of jobs) {
    console.log(`    ⏰ ${j.name} — "${j.schedule}" → ${j.action}`);
  }

  // List all jobs
  const allJobs = listCronJobs();
  console.log(`\n  Active cron jobs (${allJobs.length}):`);
  for (const j of allJobs) {
    console.log(`    🔄 ${j.name} [${j.schedule}] — ${j.action}`);
  }

  // Remove a job
  const removed = removeCronJob("health-ping");
  console.log(`\n  ${removed ? "✓ Removed: health-ping" : "✗ Failed to remove"}`);

  const remaining = listCronJobs();
  console.log(`  Remaining jobs: ${remaining.length}`);

  console.log("\n  Demo complete.\n");
}

main();
