/**
 * Kernel — Agent File System (agentfs)
 * 1:1 z CheetahClaws cc_kernel/agentfs.py
 * 
 * Virtual file system for agents to store and share data
 * Each agent gets a private namespace + shared global namespace
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, unlinkSync, rmSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";

export interface AgentFSNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  modifiedAt: string;
  agentId?: string;
}

class AgentFS {
  private baseDir = "";

  init(basePath?: string): void {
    this.baseDir = basePath ?? join(process.cwd(), "kernel", "agentfs");
    mkdirSync(this.baseDir, { recursive: true });
    mkdirSync(join(this.baseDir, "global"), { recursive: true });
    console.log(`  ✓ AgentFS initialized at ${this.baseDir}`);
  }

  private agentDir(agentId: string): string {
    const dir = join(this.baseDir, "agents", agentId);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  private globalDir(): string {
    return join(this.baseDir, "global");
  }

  /**
   * Write a file in an agent's private namespace
   */
  writeAgentFile(agentId: string, fileName: string, content: string): boolean {
    try {
      const fullPath = join(this.agentDir(agentId), fileName);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
      return true;
    } catch { return false; }
  }

  /**
   * Read a file from an agent's private namespace
   */
  readAgentFile(agentId: string, fileName: string): string | null {
    try {
      const fullPath = join(this.agentDir(agentId), fileName);
      if (!existsSync(fullPath)) return null;
      return readFileSync(fullPath, "utf-8");
    } catch { return null; }
  }

  /**
   * List files in an agent's private namespace
   */
  listAgentFiles(agentId: string): AgentFSNode[] {
    return this.scanDir(this.agentDir(agentId), agentId);
  }

  /**
   * Write a file in the global (shared) namespace
   */
  writeGlobalFile(fileName: string, content: string): boolean {
    try {
      const fullPath = join(this.globalDir(), fileName);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
      return true;
    } catch { return false; }
  }

  /**
   * Read a file from the global namespace
   */
  readGlobalFile(fileName: string): string | null {
    try {
      const fullPath = join(this.globalDir(), fileName);
      if (!existsSync(fullPath)) return null;
      return readFileSync(fullPath, "utf-8");
    } catch { return null; }
  }

  /**
   * List files in the global namespace
   */
  listGlobalFiles(): AgentFSNode[] {
    return this.scanDir(this.globalDir());
  }

  /**
   * Delete a file
   */
  delete(agentId: string | null, fileName: string): boolean {
    try {
      const base = agentId ? this.agentDir(agentId) : this.globalDir();
      const fullPath = join(base, fileName);
      if (!existsSync(fullPath)) return false;
      unlinkSync(fullPath);
      return true;
    } catch { return false; }
  }

  /**
   * Share a file from agent namespace to global namespace
   */
  shareToGlobal(agentId: string, fileName: string): boolean {
    const content = this.readAgentFile(agentId, fileName);
    if (content === null) return false;
    return this.writeGlobalFile(`${agentId}--${fileName}`, content);
  }

  private scanDir(dir: string, agentId?: string): AgentFSNode[] {
    if (!existsSync(dir)) return [];
    const results: AgentFSNode[] = [];
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = join(dir, entry.name);
        results.push({
          name: entry.name,
          path: relative(this.baseDir, fullPath),
          type: entry.isDirectory() ? "dir" : "file",
          size: entry.isFile() ? statSync(fullPath).size : 0,
          modifiedAt: statSync(fullPath).mtime.toISOString(),
          agentId,
        });
      }
    } catch { /* skip */ }
    return results;
  }
}

export const agentFS = new AgentFS();
