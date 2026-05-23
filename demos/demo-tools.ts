// Demo: Tool system — list and execute built-in tools
// Run with: bun run demos/demo-tools.ts
import { listTools, getTool } from "../packages/core/src/plugin/tools.ts";

async function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Tool System Demo             ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  // List all tools
  const tools = listTools();
  console.log(`  Registered tools (${tools.length}):`);
  for (const t of tools) {
    console.log(`    🔧 ${t.name} — ${t.description || "No description"}`);
  }

  // Execute get_current_time
  console.log("\n  Executing get_current_time...");
  const timeTool = getTool("get_current_time");
  if (timeTool) {
    try {
      const timeResult = await timeTool.execute({}, {});
      console.log(`  Result: ${timeResult}`);
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Execute calculate
  console.log("\n  Executing calculate(2 + 2)...");
  const calcTool = getTool("calculate");
  if (calcTool) {
    try {
      const calcResult = await calcTool.execute({ expression: "2 + 2" }, {});
      console.log(`  Result: ${calcResult}`);
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Execute calculate with complex expression
  console.log("\n  Executing calculate((15 * 3) + (42 / 6))...");
  if (calcTool) {
    try {
      const calcResult = await calcTool.execute({ expression: "(15 * 3) + (42 / 6)" }, {});
      console.log(`  Result: ${calcResult}`);
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }

  console.log("\n  Demo complete.\n");
}

main();
