// Demo: Trading analysis
// Run with: bun run demos/demo-trading.ts
import { analyzeSymbol } from "../packages/core/src/trading/analyzer.ts";

async function main() {
  console.log("\n  ╔══════════════════════════════════════╗");
  console.log("  ║     Nova Trading Demo                 ║");
  console.log("  ╚══════════════════════════════════════╝\n");

  const symbols = ["AAPL", "BTC", "ETH"];
  for (const symbol of symbols) {
    console.log(`  Analyzing ${symbol}...`);
    try {
      const result = await analyzeSymbol(symbol);
      console.log(`  Symbol: ${result.symbol}`);
      if (result.price) console.log(`  Price: $${result.price}`);
      if (result.change) console.log(`  Change: ${result.change}`);
      console.log(`  Recommendation: ${result.recommendation}`);
      console.log(`  Reason: ${result.reason}`);
      console.log();
    } catch (e: any) {
      console.log(`  ${symbol}: ${e.message}\n`);
    }
  }
}

main();
