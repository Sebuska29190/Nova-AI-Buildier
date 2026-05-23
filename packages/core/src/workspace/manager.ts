/**
 * File Workspace System — user-selectable folder for agent to work on files
 * 1:1 z CheetahClaws workspace management philosophy
 * 
 * The user selects a workspace folder, and the agent can:
 * - Read/write files in that folder
 * - Create new files and directories
 * - Run commands in that folder
 * - Track changes and maintain context
 * 
 * Supports multi-folder workspaces (like VS Code / OpenCode).
 * The first folder is the "primary" rootDir (writes go there).
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, unlinkSync, rmSync, appendFileSync } from "node:fs";
import { join, relative, resolve, extname, basename, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { knowledgeBase } from "../knowledge/store.ts";

export interface WorkspaceFile {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
  type: "file" | "dir";
}

export interface WorkspaceState {
  rootDir: string;
  folders: string[];
  active: boolean;
  createdAt: string;
  fileCount: number;
  dirCount: number;
}

class WorkspaceManager {
  private rootDir = "";
  private folders: string[] = [];
  private active = false;
  private createdAt = "";

  /**
   * Set the workspace primary directory (also sets up multi-folder array)
   */
  setRoot(dir: string): boolean {
    try {
      const resolved = resolve(dir);
      if (!existsSync(resolved)) {
        mkdirSync(resolved, { recursive: true });
      }
      this.rootDir = resolved;
      // Initialize folders with primary if empty
      if (this.folders.length === 0) {
        this.folders = [resolved];
      }
      this.active = true;
      this.createdAt = new Date().toISOString();

      // Create .nova workspace metadata
      const metaDir = join(this.rootDir, ".nova");
      mkdirSync(metaDir, { recursive: true });
      writeFileSync(join(metaDir, "workspace.json"), JSON.stringify({
        createdAt: this.createdAt,
        version: "0.1",
        folders: this.folders,
      }, null, 2), "utf-8");

      // Log to knowledge base
      knowledgeBase.save({
        title: `Workspace Set: ${this.rootDir}`,
        content: `Workspace initialized at \`${this.rootDir}\`\n\nFolders: ${this.folders.length}\nCreated: ${this.createdAt}`,
        category: "config",
        tags: ["workspace", "filesystem"],
        source: "workspace",
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current workspace state
   */
  getState(): WorkspaceState | null {
    if (!this.active || !this.rootDir) return null;
    const stats = this.scan();
    return {
      rootDir: this.rootDir,
      folders: [...this.folders],
      active: this.active,
      createdAt: this.createdAt,
      fileCount: stats.files,
      dirCount: stats.dirs,
    };
  }

  /**
   * Check if workspace is active
   */
  isActive(): boolean {
    return this.active && this.rootDir.length > 0;
  }

  /**
   * Get the workspace primary root directory
   */
  getRoot(): string {
    return this.rootDir;
  }

  /**
   * Clear the workspace — reset all state
   */
  clear(): void {
    this.rootDir = "";
    this.folders = [];
    this.active = false;
    this.createdAt = "";
  }

  // ─── Multi-Folder API ───────────────────────────────────────

  /**
   * Get all workspace folders
   */
  getFolders(): string[] {
    return [...this.folders];
  }

  /**
   * Add a folder to the workspace
   */
  addFolder(dir: string): boolean {
    try {
      const resolved = resolve(dir);
      if (!existsSync(resolved)) {
        mkdirSync(resolved, { recursive: true });
      }
      // Avoid duplicates
      const norm = resolved.replace(/[\\/]+$/, "").toLowerCase();
      if (this.folders.some(f => f.replace(/[\\/]+$/, "").toLowerCase() === norm)) {
        return false;
      }
      this.folders.push(resolved);
      this.saveMetadata();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove a folder from the workspace (cannot remove the primary rootDir)
   */
  removeFolder(dir: string): boolean {
    try {
      const resolved = resolve(dir);
      const norm = resolved.replace(/[\\/]+$/, "").toLowerCase();
      const primaryNorm = resolve(this.rootDir).replace(/[\\/]+$/, "").toLowerCase();
      // Cannot remove primary folder
      if (norm === primaryNorm) return false;
      const idx = this.folders.findIndex(f => f.replace(/[\\/]+$/, "").toLowerCase() === norm);
      if (idx === -1) return false;
      this.folders.splice(idx, 1);
      this.saveMetadata();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Replace all folders (list must include the primary rootDir)
   */
  setFolders(dirs: string[]): boolean {
    try {
      const resolved = dirs.map(d => resolve(d));
      const primaryNorm = resolve(this.rootDir).replace(/[\\/]+$/, "").toLowerCase();
      if (!resolved.some(r => r.replace(/[\\/]+$/, "").toLowerCase() === primaryNorm)) {
        // Ensure primary is always included
        resolved.unshift(this.rootDir);
      }
      this.folders = resolved;
      this.saveMetadata();
      return true;
    } catch {
      return false;
    }
  }

  private saveMetadata(): void {
    if (!this.rootDir) return;
    try {
      const metaDir = join(this.rootDir, ".nova");
      mkdirSync(metaDir, { recursive: true });
      writeFileSync(join(metaDir, "workspace.json"), JSON.stringify({
        createdAt: this.createdAt,
        version: "0.1",
        folders: this.folders,
      }, null, 2), "utf-8");
    } catch { /* best-effort */ }
  }

  // ─── Path Resolution ─────────────────────────────────────────

  /**
   * Resolve a path relative to workspace primary root
   */
  resolvePath(relativePath: string): string {
    return join(this.rootDir, relativePath);
  }

  /**
   * Find which folder a relative path belongs to.
   * Searches all workspace folders. Returns the first match.
   */
  resolveAcrossFolders(relativePath: string): string | null {
    for (const folder of this.folders) {
      const fullPath = resolve(folder, relativePath);
      if (existsSync(fullPath)) {
        // Verify it's safe (within the folder)
        const folderNorm = resolve(folder).replace(/[\\/]$/, "");
        const pathNorm = resolve(fullPath).replace(/[\\/]$/, "");
        if (pathNorm.startsWith(folderNorm + "\\") ||
            pathNorm.startsWith(folderNorm + "/") ||
            pathNorm === folderNorm) {
          return fullPath;
        }
      }
    }
    return null;
  }

  /**
   * Validate that a resolved path stays inside any workspace folder.
   * Returns the safe absolute path and which folder it belongs to, or null.
   */
  safePath(relativePath: string): { fullPath: string; folder: string } | null {
    for (const folder of this.folders) {
      const fullPath = resolve(folder, relativePath);
      const folderNorm = resolve(folder).replace(/[\\/]$/, "");
      const pathNorm = resolve(fullPath).replace(/[\\/]$/, "");
      if (pathNorm.startsWith(folderNorm + "\\") ||
          pathNorm.startsWith(folderNorm + "/") ||
          pathNorm === folderNorm) {
        return { fullPath, folder };
      }
    }
    return null;
  }

  // ─── File Operations ─────────────────────────────────────────

  /**
   * List files in the workspace across all folders
   */
  listFiles(subDir = "", filter?: { ext?: string; maxDepth?: number }): WorkspaceFile[] {
    const results: WorkspaceFile[] = [];
    const seen = new Set<string>();
    for (const folder of this.folders) {
      const targetDir = subDir ? join(folder, subDir) : folder;
      if (!existsSync(targetDir)) continue;
      const files = this.scanDir(targetDir, filter?.maxDepth ?? 3, filter?.ext);
      for (const f of files) {
        const key = f.path.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          results.push(f);
        }
      }
    }
    return results;
  }

  /**
   * Read a file from any workspace folder (safe — prevents path traversal)
   */
  readFile(relativePath: string): string | null {
    try {
      const found = this.resolveAcrossFolders(relativePath);
      if (!found) return null;
      if (!existsSync(found)) return null;
      if (statSync(found).size > 1024 * 1024) return null; // Skip files > 1MB
      return readFileSync(found, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Write a file in the primary workspace folder (creates directories as needed;
   * safe — prevents path traversal)
   */
  writeFile(relativePath: string, content: string): boolean {
    try {
      const primaryNorm = resolve(this.rootDir).replace(/[\\/]$/, "");
      const fullPath = resolve(this.rootDir, relativePath);
      const pathNorm = resolve(fullPath).replace(/[\\/]$/, "");
      if (!pathNorm.startsWith(primaryNorm + "\\") &&
          !pathNorm.startsWith(primaryNorm + "/") &&
          pathNorm !== primaryNorm) {
        // Try other folders — write to first folder that contains the path
        for (const folder of this.folders) {
          const candidate = resolve(folder, relativePath);
          const folderNorm = resolve(folder).replace(/[\\/]$/, "");
          const candNorm = resolve(candidate).replace(/[\\/]$/, "");
          if (candNorm.startsWith(folderNorm + "\\") ||
              candNorm.startsWith(folderNorm + "/") ||
              candNorm === folderNorm) {
            mkdirSync(dirname(candidate), { recursive: true });
            writeFileSync(candidate, content, "utf-8");
            return true;
          }
        }
        return false;
      }
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");

      // Log to knowledge base
      knowledgeBase.save({
        title: `File Created: ${relativePath}`,
        content: `Created file \`${relativePath}\` in workspace\n\n\`\`\`\n${content.slice(0, 500)}\n\`\`\``,
        category: "feature",
        tags: ["workspace", "file-created", extname(relativePath).replace(".", "")],
        source: "workspace",
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file or directory in any workspace folder (safe — prevents path traversal,
   * never allows deleting any workspace folder root)
   */
  delete(relativePath: string): boolean {
    try {
      const found = this.safePath(relativePath);
      if (!found) return false;
      // Never allow deleting any workspace folder root
      for (const folder of this.folders) {
        if (resolve(found.fullPath) === resolve(folder)) return false;
      }
      if (!existsSync(found.fullPath)) return false;
      const s = statSync(found.fullPath);
      if (s.isDirectory()) {
        rmSync(found.fullPath, { recursive: true, force: true });
      } else {
        unlinkSync(found.fullPath);
      }
      return true;
    } catch {
      return false;
    }
  }

  // ─── Search ──────────────────────────────────────────────────

  /**
   * Search for files by name pattern across all folders
   */
  searchFiles(pattern: string, subDir = ""): string[] {
    const results: string[] = [];
    const seen = new Set<string>();
    for (const folder of this.folders) {
      const targetDir = subDir ? join(folder, subDir) : folder;
      const searchIn = (dir: string) => {
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("node_modules")) {
              searchIn(fullPath);
            } else if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
              const key = relative(this.rootDir, fullPath).toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                results.push(relative(folder, fullPath));
              }
            }
          }
        } catch { /* skip */ }
      };
      searchIn(targetDir);
    }
    return results;
  }

  // ─── Internal ────────────────────────────────────────────────

  private scan(): { files: number; dirs: number } {
    let files = 0, dirs = 0;
    for (const folder of this.folders) {
      if (!existsSync(folder)) continue;
      try {
        const walk = (dir: string) => {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = join(dir, entry.name);
            if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
            if (entry.isDirectory()) { dirs++; walk(full); }
            else { files++; }
          }
        };
        walk(folder);
      } catch { /* skip */ }
    }
    return { files, dirs };
  }

  private scanDir(dir: string, maxDepth: number, extFilter?: string, depth = 0): WorkspaceFile[] {
    if (depth > maxDepth) return [];
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      const results: WorkspaceFile[] = [];
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push({
            path: relative(this.rootDir, fullPath),
            name: entry.name,
            size: 0,
            modifiedAt: statSync(fullPath).mtime.toISOString(),
            type: "dir",
          });
          results.push(...this.scanDir(fullPath, maxDepth, extFilter, depth + 1));
        } else if (!extFilter || entry.name.endsWith(extFilter)) {
          results.push({
            path: relative(this.rootDir, fullPath),
            name: entry.name,
            size: statSync(fullPath).size,
            modifiedAt: statSync(fullPath).mtime.toISOString(),
            type: "file",
          });
        }
      }
      return results;
    } catch {
      return [];
    }
  }
}

export const workspaceManager = new WorkspaceManager();
