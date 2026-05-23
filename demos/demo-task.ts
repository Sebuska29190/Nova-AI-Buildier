// Demo: Task system — create, list, update, and manage tasks
// Run with: bun run demos/demo-task.ts
import { createTask, listTasks, updateTask, deleteTask } from "../packages/core/src/task/store.ts";
import type { TaskStatus } from "../packages/core/src/task/store.ts";

function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Task System Demo             ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  // Create tasks
  const tasks = [
    createTask("Implement user authentication", "Add JWT-based auth with login/register endpoints", "high", ["backend", "security"]),
    createTask("Design dashboard UI", "Create responsive dashboard with charts and tables", "medium", ["frontend", "ui"]),
    createTask("Write API documentation", "Document all REST endpoints with examples", "medium", ["docs"]),
    createTask("Add unit tests", "Achieve 80% code coverage", "high", ["testing"]),
    createTask("Fix login bug", "Users cannot login with special characters in password", "high", ["bug", "security"]),
    createTask("Optimize database queries", "Slow queries identified in session management", "low", ["performance"]),
  ];

  console.log(`  Created ${tasks.length} tasks:`);
  for (const t of tasks) {
    console.log(`    [${t.priority}] ${t.title} — ${t.status}`);
  }

  // List by status
  const pendingStatus: TaskStatus = "todo";
  console.log(`\n  Pending tasks (${listTasks(pendingStatus).length}):`);
  for (const t of listTasks(pendingStatus)) {
    console.log(`    📋 ${t.title} (${t.priority})`);
  }

  // Update task status
  const loginBug = tasks[4];
  updateTask(loginBug.id, { status: "in_progress" });
  console.log(`\n  ✓ Updated: ${loginBug.title} → in_progress`);

  const authTask = tasks[0];
  updateTask(authTask.id, { status: "done" });
  console.log(`  ✓ Updated: ${authTask.title} → done`);

  // List completed
  const doneStatus: TaskStatus = "done";
  console.log(`\n  Completed tasks (${listTasks(doneStatus).length}):`);
  for (const t of listTasks(doneStatus)) {
    console.log(`    ✅ ${t.title}`);
  }

  // Delete a task
  deleteTask(tasks[5].id);
  console.log(`\n  ✓ Deleted: ${tasks[5].title}`);
  console.log(`  Remaining tasks: ${listTasks().length}`);

  console.log("\n  Demo complete.\n");
}

main();
