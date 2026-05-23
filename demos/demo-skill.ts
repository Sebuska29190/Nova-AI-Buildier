// Demo: Skill system — load and inspect available skills
// Run with: bun run demos/demo-skill.ts
import { loadSkills } from "../packages/core/src/skill/loader.ts";

function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Skill System Demo            ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  const skills = loadSkills();
  console.log(`  Skills loaded: ${skills.length}`);

  if (skills.length === 0) {
    console.log("  No skills found. Create .md skill files to see them here.");
    console.log("\n  Expected format:");
    console.log('    ---');
    console.log('    name: my-skill');
    console.log('    description: What this skill does');
    console.log('    ---');
    console.log('    Skill instructions here...');
  } else {
    for (const s of skills) {
      console.log(`\n  📖 ${s.name}`);
      console.log(`     ${s.description || "No description"}`);
      console.log(`     ${s.prompt.slice(0, 100)}...`);
    }
  }

  console.log("\n  Demo complete.\n");
}

main();
