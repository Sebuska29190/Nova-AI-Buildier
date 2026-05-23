// Demo: MCP Client — Model Context Protocol server management
// Run with: bun run demos/demo-mcp.ts
import { mcpManager } from "../packages/core/src/mcp/client.ts";

async function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova MCP Client Demo              ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  // Load configs
  mcpManager.loadConfigs();
  console.log("  MCP configs loaded");

  // List configured servers
  const tools = mcpManager.getTools();
  console.log(`  Available MCP tools: ${tools.length}`);

  console.log("\n  MCP servers can be configured in mcp.json:");
  console.log('  {');
  console.log('    "mcpServers": {');
  console.log('      "my-server": {');
  console.log('        "command": "node",');
  console.log('        "args": ["server.js"],');
  console.log('        "env": { "KEY": "value" }');
  console.log('      }');
  console.log('    }');
  console.log('  }');

  console.log("\n  Demo complete.\n");
}

main();
