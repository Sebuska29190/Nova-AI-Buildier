// Demo: Research with 22 sources
// Run with: bun run demos/demo-research.ts
import { research, listSources } from "../packages/core/src/research/engine.ts";

async function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Research Demo                ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  const sources = listSources();
  console.log(`  Research sources (${sources.length}):`);
  sources.forEach((s) => console.log(`    ${s.enabled ? "✓" : "○"} ${s.name}`));

  console.log("\n  Searching for 'quantum computing'...\n");
  try {
    const results = await research("quantum computing", ["arxiv", "wikipedia", "hackernews"]);
    console.log(`  ${results.length} result(s):\n`);
    results.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.title}`);
      console.log(`     ${r.url}`);
      console.log(`     Source: ${r.source} | Score: ${r.score || "N/A"}`);
      console.log();
    });
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }
}

main();
