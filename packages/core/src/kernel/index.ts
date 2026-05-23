/**
 * Kernel — Main entry point
 * 1:1 z CheetahClaws cc_kernel/__init__.py
 * 
 * The Kernel provides:
 * - AgentFS: Virtual file system for agents
 * - Ledger: Immutable event log
 * - Process: Process management for agent tasks
 * - Registry: Agent capability registry
 * - Mailbox: Inter-agent messaging
 */

import { join } from "node:path";
import { agentFS } from "./agentfs.ts";
import { ledger } from "./ledger.ts";

export interface KernelConfig {
  basePath?: string;
}

class Kernel {
  private initialized = false;

  init(config?: KernelConfig): void {
    if (this.initialized) return;
    const basePath = config?.basePath ?? join(process.cwd(), "kernel");
    agentFS.init(join(basePath, "agentfs"));
    ledger.init(join(basePath, "ledger"));
    this.initialized = true;
    console.log(`  ✓ Kernel initialized at ${basePath}`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
export const kernel = new Kernel();
export { agentFS } from "./agentfs.ts";
export { ledger } from "./ledger.ts";
