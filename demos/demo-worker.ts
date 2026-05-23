// Demo: Worker system — create and manage work jobs with parallel tasks
// Run with: bun run demos/demo-worker.ts
import { createWorkJob, getWorkJobs, getWorkJob } from "../packages/core/src/worker/manager.ts";
import { sessionManager } from "../packages/core/src/session/manager.ts";
import { agentStore } from "../packages/core/src/agent/store.ts";

async function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Worker System Demo           ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  sessionManager.init(":memory:");
  agentStore.init(":memory:");
  agentStore.create({ name: "worker-demo", description: "Worker demo agent", modelRef: "deepseek/deepseek-chat" });

  // Create work jobs
  const jobs = [
    createWorkJob("Research AI trends", [
      "Research latest LLM developments",
      "Summarize top AI news this week",
      "List emerging AI tools",
    ]),
    createWorkJob("Code review tasks", [
      "Review authentication module",
      "Check API endpoint security",
      "Validate input sanitization",
    ]),
  ];

  console.log(`  Created ${jobs.length} work jobs:`);
  for (const j of jobs) {
    const doneCount = j.tasks.filter((t: any) => t.status === "done").length;
    console.log(`    📋 ${j.title} (${j.tasks.length} tasks) — ${j.status} (${doneCount}/${j.tasks.length} done)`);
    for (const t of j.tasks) {
      console.log(`       • ${t.description}`);
    }
  }

  // List all jobs
  const allJobs = getWorkJobs();
  console.log(`\n  All jobs (${allJobs.length}):`);
  for (const j of allJobs) {
    const doneCount = j.tasks.filter((t: any) => t.status === "done").length;
    console.log(`    [${j.status}] ${j.title} — ${doneCount}/${j.tasks.length} tasks completed`);
  }

  // Get specific job
  const job = getWorkJob(jobs[0].id);
  if (job) {
    console.log(`\n  Job details: ${job.title}`);
    console.log(`  Status: ${job.status}`);
    const doneCount = job.tasks.filter((t: any) => t.status === "done").length;
    console.log(`  Progress: ${doneCount}/${job.tasks.length} tasks`);
  }

  console.log("\n  Demo complete.\n");
}

main();
