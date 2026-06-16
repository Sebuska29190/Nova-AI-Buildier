import type { ToolPlugin, ToolContext } from "@nova/sdk";
import { execSync } from "node:child_process";
import { bskyTools } from "../bsky/tools.ts";
import { socialTools } from "../social/tools.ts";

// ─── Dangerous Command Patterns (safety guard) ──────────────────
const DANGEROUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Windows system destruction
  { pattern: /\brm\s+-rf\s+(~?\s*\\|\/\s*$|\.)|\brmdir\s+\/s\s+(c:|d:)/i, reason: "Recursive delete of root/system drive is blocked" },
  { pattern: /\bformat\s+(c:|d:|e:)\b/i, reason: "Format of system drives is blocked" },
  { pattern: /\bdiskpart\b/i, reason: "diskpart (disk partitioning) is blocked" },
  { pattern: /\breg\s+(delete|add|import)\b/i, reason: "Registry modification is blocked" },
  { pattern: /\bshutdown\s+.*-s\b|\brestart-computer\b|\bstop-computer\b/i, reason: "System shutdown/restart is blocked" },
  { pattern: /\bdel\s+\/f\s+\/s\s+(c:|d:|\\|\/)/i, reason: "Force recursive delete of system drive is blocked" },

  // Cross-platform destruction
  { pattern: /\brm\s+-rf\s+(?:\/|\/\*)\b/, reason: "Recursive delete of root (/) is blocked" },
  { pattern: /\bchmod\s+777\s+\//, reason: "Changing permissions on root (/) is blocked" },
  { pattern: /\bchown\s+-R\s+\/\b/, reason: "Recursive chown on root (/) is blocked" },
  { pattern: /\bdd\s+if=\/dev\/zero\b|\bdd\s+if=\/dev\/random\b|\bdd\s+of=\/dev\/sda\b/i, reason: "Low-level disk write (dd) is blocked" },
  { pattern: /\bmkfs\b|\bfdisk\b|\bmkswap\b/i, reason: "Filesystem creation/partitioning is blocked" },
  { pattern: /\b:\(\)\s*\{.*:\s*\|.*:\s*&\s*\};\s*:/, reason: "Fork bomb detected and blocked" },
  { pattern: /\b>\/dev\/sda\b|\bmv\s+\/\s+\/dev\/null\b/i, reason: "Dangerous system manipulation blocked" },

  // Network abuse
  { pattern: /\b(?:ping|hping3|nping|slowloris)\s+-f\s+/i, reason: "Flooding network tools blocked" },

  // Crypto mining / malware signs
  { pattern: /\b(?:curl|wget)\s+.*(?:miner|cryptonight|xmrig)\b/i, reason: "Crypto miner download blocked" },
];

function checkDangerousCommand(cmd: string): string | null {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(cmd)) return reason;
  }
  return null;
}

const tools = new Map<string, ToolPlugin>();

export function registerTool(t: ToolPlugin): void {
  tools.set(t.name, t);
}

export function getTool(name: string): ToolPlugin | undefined {
  return tools.get(name);
}

export function listTools(): ToolPlugin[] {
  return [...tools.values()];
}

// Built-in: web fetch
registerTool({
  name: "web_fetch", description: "Fetch a URL and return text content",
  parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false },
  async execute(args, ctx) {
    const { url } = args as { url: string };
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Nova/1.0" } });
    return (await res.text()).slice(0, 15000);
  },
});

// Built-in: web search via DuckDuckGo
registerTool({
  name: "web_search", description: "Search the web via DuckDuckGo",
  parameters: { type: "object", properties: { query: { type: "string", description: "Search query" } }, required: ["query"], additionalProperties: false },
  async execute(args) {
    const { query } = args as { query: string };
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encoded}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Nova/1.0" },
    });
    const html = await res.text();
    // Extract result snippets
    const results: string[] = [];
    const regex = /<a[^>]*class="result-link"[^>]*>([^<]+)<\/a>\s*<span[^>]*class="result-snippet"[^>]*>([^<]+)<\/span>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
      results.push(`${m[1].trim()}: ${m[2].trim()}`);
      if (results.length >= 10) break;
    }
    return results.length > 0 ? results.join("\n") : "No results found";
  },
});

// Built-in: time
registerTool({
  name: "get_current_time", description: "Get current date and time",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() { return new Date().toISOString(); },
});

// Built-in: calculator — safe math parser (no eval / new Function)
registerTool({
  name: "calculate", description: "Evaluate a mathematical expression",
  parameters: { type: "object", properties: { expression: { type: "string", description: "Math expression to evaluate" } }, required: ["expression"], additionalProperties: false },
  async execute(args) {
    const { expression } = args as { expression: string };
    try {
      const result = safeEvalMath(expression);
      return String(result);
    } catch { return `Error evaluating: ${expression}`; }
  },
});

/**
 * Safe math expression evaluator — only allows numbers, operators, parentheses, and whitespace.
 * No eval(), no new Function(), no code execution.
 * Supports: + - * / ( ) . % and basic math constants (pi, e).
 */
function safeEvalMath(expr: string): number {
  // Strip whitespace and normalize
  const sanitized = expr.trim().toLowerCase();

  // Only allow: digits, decimal points, operators, parentheses, spaces, %,
  // and the words "pi" and "e"
  const allowed = /^[\d.+\-*\/()%\s pie]+$/;
  if (!allowed.test(sanitized)) {
    throw new Error("Expression contains disallowed characters");
  }

  // Block function calls, brackets, dots (except decimal), quotes, template literals
  const dangerous = /[a-z]{2,}/g;
  const words = sanitized.match(dangerous) || [];
  for (const w of words) {
    if (w !== "pi" && w !== "e") {
      throw new Error(`Unknown identifier: "${w}"`);
    }
  }

  // Replace constants
  let expr2 = sanitized
    .replace(/\bpi\b/g, String(Math.PI))
    .replace(/\be\b/g, String(Math.E));

  // Simple recursive descent parser — only arithmetic
  // Use a small Shunting-yard to avoid eval entirely
  const tokens = tokenize(expr2);
  const result = parseExpression(tokens);
  return result;
}

type Token = { type: "num"; value: number } | { type: "op"; value: string } | { type: "paren"; value: "(" | ")" };

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) { num += s[i]; i++; }
      tokens.push({ type: "num", value: parseFloat(num) });
      continue;
    }
    if ("+-*/%".includes(c)) {
      tokens.push({ type: "op", value: c });
      i++;
      continue;
    }
    if (c === "(" || c === ")") {
      tokens.push({ type: "paren", value: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected character: "${c}"`);
  }
  return tokens;
}

function parseExpression(tokens: Token[], minPrec = 0): number {
  let left = parsePrimary(tokens);
  while (tokens.length > 0) {
    const tok = tokens[0];
    if (tok.type !== "op") break;
    const prec = opPrecedence(tok.value);
    if (prec < minPrec) break;
    tokens.shift();
    const right = parseExpression(tokens, prec + 1);
    switch (tok.value) {
      case "+": left += right; break;
      case "-": left -= right; break;
      case "*": left *= right; break;
      case "/":
        if (right === 0) throw new Error("Division by zero");
        left /= right; break;
      case "%": left %= right; break;
    }
  }
  return left;
}

function parsePrimary(tokens: Token[]): number {
  const tok = tokens.shift();
  if (!tok) throw new Error("Unexpected end of expression");
  if (tok.type === "num") return tok.value;
  if (tok.type === "paren" && tok.value === "(") {
    const val = parseExpression(tokens, 0);
    const close = tokens.shift();
    if (!close || close.type !== "paren" || close.value !== ")") throw new Error("Missing closing parenthesis");
    return val;
  }
  throw new Error(`Unexpected token: ${JSON.stringify(tok)}`);
}

function opPrecedence(op: string): number {
  switch (op) { case "+": case "-": return 1; case "*": case "/": case "%": return 2; default: return 0; }
}

// ─── Workspace File Tools ────────────────────────────────────
import { workspaceManager } from "../workspace/manager.ts";

/** Guard: check workspace and return root path or error message */
function workspaceGuard(): { ok: false; msg: string } | { ok: true; root: string } {
  if (!workspaceManager.isActive()) {
    return { ok: false, msg: "❌ No workspace folder is set. Open the 📁 Workspace panel in the chat UI and set a folder, or ask the user to set one." };
  }
  return { ok: true, root: workspaceManager.getRoot() };
}

registerTool({
  name: "workspace_set_root",
  description: "Set the workspace root folder for file operations",
  parameters: { type: "object", properties: { path: { type: "string", description: "Absolute path to the workspace root folder" } }, required: ["path"], additionalProperties: false },
  async execute(args) {
    const { path } = args as { path: string };
    workspaceManager.setRoot(path);
    return `✅ Workspace root set to: ${path}`;
  },
});

registerTool({
  name: "workspace_get_state",
  description: "Show current workspace status — root folder, file/dir counts",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const state = workspaceManager.getState();
    const active = state && state.active;
    if (!active) return "❌ No workspace folder is set. Open the 📁 Workspace panel in the chat UI and set a folder.";
    const folders = state.folders.length > 1
      ? "\n- Folders: " + state.folders.length + "\n" + state.folders.map(f => `  - \`${f}\``).join("\n")
      : "";
    return `**Workspace:** \`${state.rootDir}\`${folders}\n- Active: ✅\n- Files: ${state.fileCount}\n- Directories: ${state.dirCount}\n- Created: ${state.createdAt}`;
  },
});

registerTool({
  name: "workspace_list_files",
  description: "List files and directories in the workspace, with optional depth and extension filter",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Subdirectory to list (default: root)" },
      depth: { type: "number", description: "Max directory depth (default: 2, max: 5)" },
      ext: { type: "string", description: "Filter by file extension e.g. .ts, .py (optional)" },
    },
    additionalProperties: false,
  },
  async execute(args) {
    const guard = workspaceGuard();
    if (!guard.ok) return guard.msg;
    const { path = "", depth = 2, ext } = args as { path?: string; depth?: number; ext?: string };
    const maxDepth = Math.min(depth || 2, 5);
    const files = workspaceManager.listFiles(path as string, { ext: ext as string | undefined, maxDepth });
    if (files.length === 0) return "(empty — no files found)";
    const lines = files.map(f =>
      `${f.type === "dir" ? "📁" : "📄"} ${f.path}${f.type === "dir" ? "/" : ""} ${f.type === "file" ? `(${(f.size / 1024).toFixed(1)} KB)` : ""}`
    );
    return lines.join("\n");
  },
});

registerTool({
  name: "workspace_read_file",
  description: "Read the full contents of a file from the workspace (max 1 MB)",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative file path from workspace root, e.g. src/main.ts" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  async execute(args) {
    const guard = workspaceGuard();
    if (!guard.ok) return guard.msg;
    const { path } = args as { path: string };
    const content = workspaceManager.readFile(path);
    if (content === null) return `Error: File "${path}" not found, is empty, or exceeds 1 MB. Use workspace_list_files to check available files.`;
    return content;
  },
});

registerTool({
  name: "workspace_write_file",
  description: "Create or overwrite a file in the workspace. Creates parent directories automatically.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative file path, e.g. src/index.ts" },
      content: { type: "string", description: "Full file content to write" },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
  async execute(args) {
    const guard = workspaceGuard();
    if (!guard.ok) return guard.msg;
    const { path, content } = args as { path: string; content: string };
    const ok = workspaceManager.writeFile(path, content);
    if (!ok) return `Error: Failed to write "${path}". Check permissions and path validity.`;
    return `✅ Written ${content.length} bytes to \`${path}\``;
  },
});

registerTool({
  name: "workspace_edit_file",
  description: "Find exact text in a file and replace it. Uses first occurrence. Good for surgical edits.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative file path" },
      old_string: { type: "string", description: "Exact text to find (must match byte-for-byte)" },
      new_string: { type: "string", description: "Replacement text" },
    },
    required: ["path", "old_string", "new_string"],
    additionalProperties: false,
  },
  async execute(args) {
    const guard = workspaceGuard();
    if (!guard.ok) return guard.msg;
    const { path, old_string, new_string } = args as { path: string; old_string: string; new_string: string };
    const content = workspaceManager.readFile(path);
    if (content === null) return `Error: File "${path}" not found.`;
    if (!content.includes(old_string)) return `Error: old_string not found in "${path}". Check exact whitespace.`;
    const updated = content.replace(old_string, new_string);
    const ok = workspaceManager.writeFile(path, updated);
    if (!ok) return `Error: Failed to write updated "${path}".`;
    const linesChanged = content.split("\n").length;
    return `✅ Edited \`${path}\` — replaced 1 occurrence (${linesChanged} line file).`;
  },
});

registerTool({
  name: "workspace_delete_file",
  description: "Delete a file or empty directory from the workspace",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative path to file or directory to delete" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  async execute(args) {
    const guard = workspaceGuard();
    if (!guard.ok) return guard.msg;
    const { path } = args as { path: string };
    const ok = workspaceManager.delete(path);
    if (!ok) return `Error: "${path}" not found or could not be deleted.`;
    return `✅ Deleted \`${path}\``;
  },
});

registerTool({
  name: "workspace_search_files",
  description: "Search for files by name pattern (case-insensitive, e.g. 'config' finds all files containing 'config')",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Filename pattern to search for" },
      path: { type: "string", description: "Subdirectory to restrict search (optional)" },
    },
    required: ["pattern"],
    additionalProperties: false,
  },
  async execute(args) {
    const guard = workspaceGuard();
    if (!guard.ok) return guard.msg;
    const { pattern, path = "" } = args as { pattern: string; path?: string };
    const results = workspaceManager.searchFiles(pattern, path);
    if (results.length === 0) return `No files matching "${pattern}" found.`;
    return results.map(r => `📄 ${r}`).join("\n") + `\n\n(${results.length} file(s) found)`;
  },
});

registerTool({
  name: "workspace_run_command",
  description: "Run a shell command inside the workspace directory. Use for git, npm, pip, build, test, etc.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to execute" },
      timeout: { type: "number", description: "Timeout in seconds (default: 30, max: 120)" },
    },
    required: ["command"],
    additionalProperties: false,
  },
  async execute(args) {
    const guard = workspaceGuard();
    if (!guard.ok) return guard.msg;
    const { command, timeout = 30 } = args as { command: string; timeout?: number };

    // ── Safety guard: block dangerous / destructive commands ──────
    const danger = checkDangerousCommand(command);
    if (danger) return `❌ Blocked: ${danger}`;

    const maxTimeout = Math.min(timeout, 120) * 1000;
    try {
      const output = execSync(command, {
        cwd: guard.root,
        timeout: maxTimeout,
        maxBuffer: 5 * 1024 * 1024,
        shell: true,
        encoding: "utf-8",
        windowsHide: true,
      });
      const result = (output || "").trim();
      if (!result) return `✅ Command completed (no output)`;
      // Truncate to avoid tool response bloat
      return result.length > 5000 ? result.slice(0, 5000) + `\n\n... (${result.length - 5000} more chars)` : result;
    } catch (e: unknown) {
      const err = e as any;
      const stderr = err.stderr?.toString().trim() || err.message || "Unknown error";
      return `❌ Command failed: ${stderr.slice(0, 2000)}`;
    }
  },
});

// ─── Multi-Folder Management ──────────────────────────────────

registerTool({
  name: "workspace_add_folder",
  description: "Add a folder to the workspace (multi-folder support). Resolves and adds the path.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative path to the folder to add" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  async execute(args) {
    const guard = workspaceGuard();
    if (!guard.ok) return guard.msg;
    const { path } = args as { path: string };
    const ok = workspaceManager.addFolder(path);
    if (!ok) return `❌ Failed to add folder: "${path}" (already exists or invalid).`;
    return `✅ Added folder: \`${path}\``;
  },
});

registerTool({
  name: "workspace_remove_folder",
  description: "Remove a folder from the workspace (cannot remove the primary rootDir).",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path of the folder to remove" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  async execute(args) {
    const guard = workspaceGuard();
    if (!guard.ok) return guard.msg;
    const { path } = args as { path: string };
    const ok = workspaceManager.removeFolder(path);
    if (!ok) return `❌ Failed to remove folder: "${path}" (primary rootDir cannot be removed, or not found).`;
    return `✅ Removed folder: \`${path}\``;
  },
});

registerTool({
  name: "workspace_list_folders",
  description: "List all folders in the current workspace.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const guard = workspaceGuard();
    if (!guard.ok) return guard.msg;
    const folders = workspaceManager.getFolders();
    if (folders.length === 0) return "No folders in workspace.";
    return folders.map((f, i) => `${i === 0 ? "📁" : "📂"} ${i === 0 ? "(primary) " : ""}\`${f}\``).join("\n");
  },
});

// ─── Sub-Agent Tool ──────────────────────────────────────────────
registerTool({
  name: "spawn_sub_agent",
  description: "Spawn a sub-agent to handle a specialized subtask. The sub-agent runs with its own session and returns a text result. Use for parallel work: research, analysis, validation, etc.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "A descriptive name for this sub-agent task (e.g. 'code-reviewer', 'bug-hunter')" },
      systemPrompt: { type: "string", description: "System prompt/instructions for the sub-agent" },
      message: { type: "string", description: "The task/message to send to the sub-agent" },
      modelRef: { type: "string", description: "Optional model reference (defaults to deepseek/deepseek-chat)" },
    },
    required: ["name", "systemPrompt", "message"],
    additionalProperties: false,
  },
  async execute(args: { name: string; systemPrompt: string; message: string; modelRef?: string }) {
    const { spawnSubAgent } = await import("../multi-agent/subagent.ts");
    const result = await spawnSubAgent(
      { id: `sub-${args.name}-${Date.now()}`, name: args.name, systemPrompt: args.systemPrompt, modelRef: args.modelRef || "deepseek/deepseek-chat" },
      args.message,
    );
    return result || "(no response from sub-agent)";
  },
});

// ─── Video Editor Tools ─────────────────────────────────────────
registerTool({
  name: "analyze_video_clips",
  description: "Analyze video clips: get duration, resolution, file size. Returns formatted info for each file. Use before generating an edit plan.",
  parameters: { type: "object", properties: { files: { type: "array", items: { type: "string" }, description: "Array of file paths to analyze" } }, required: ["files"], additionalProperties: false },
  async execute(args: { files: string[] }) {
    const { analyzeClips } = await import("../video/editor-tools.ts");
    return analyzeClips(args.files);
  },
});

registerTool({
  name: "execute_video_plan",
  description: "Execute a video editing plan using FFmpeg. The plan must specify scenes (clips with trim, speed, effects), captions, music, resolution, and output filename. Returns the output path of the rendered video.",
  parameters: {
    type: "object",
    properties: {
      plan: { type: "object", description: "JSON editing plan with scenes, captions, music, resolution, fps, output" },
      workspaceDir: { type: "string", description: "Workspace directory where clips are located" },
    },
    required: ["plan", "workspaceDir"],
    additionalProperties: false,
  },
  async execute(args: { plan: any; workspaceDir: string }) {
    const { executeEditPlan } = await import("../video/editor-tools.ts");
    const path = await executeEditPlan(args.plan, args.workspaceDir);
    return `Video rendered: ${path}`;
  },
});

// ─── Shopping Agent Tool ─────────────────────────────────────────
registerTool({
  name: "search_products",
  description: "Search for products on French e-commerce websites. Returns product name, price, availability, and link. Works with adidas.fr, zalando.fr, amazon.fr, etc.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Product search query (in French or English). E.g. 'sac à main adidas femme'" },
      minPrice: { type: "number", description: "Minimum price in EUR (optional)" },
      maxPrice: { type: "number", description: "Maximum price in EUR (optional)" },
      site: { type: "string", description: "Specific site to search: 'adidas.fr', 'zalando.fr', 'amazon.fr', or 'all' (default)" },
      limit: { type: "number", description: "Max results (default: 10)" },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async execute(args: { query: string; minPrice?: number; maxPrice?: number; site?: string; limit?: number }) {
    const { searchProducts } = await import("../shopping/scraper.ts");
    const result = await searchProducts({
      query: args.query,
      minPrice: args.minPrice,
      maxPrice: args.maxPrice,
      site: args.site,
      limit: args.limit || 10,
    });

    if (result.error) return `No products found: ${result.error}`;
    if (result.products.length === 0) return "No products found. Try a different query or site.";

    const lines = [`🔍 Results for "${args.query}" in France (${args.site || "all sites"})`];
    if (args.minPrice !== undefined || args.maxPrice !== undefined) {
      lines.push(`💰 Price range: ${args.minPrice ?? 0}€ — ${args.maxPrice ?? "∞"}€`);
    }
    lines.push("");

    result.products.forEach((p, i) => {
      lines.push(`${i + 1}. **${p.title}**`);
      if (p.price !== "See site") lines.push(`   💰 Price: ${p.price}`);
      if (p.availability) lines.push(`   ${p.availability}`);
      lines.push(`   🔗 ${p.url}`);
      lines.push(`   📍 ${p.site}`);
      lines.push("");
    });

    return lines.join("\n");
  },
});

// ─── Computer Use Tools ─────────────────────────────────────────
// NOTE: computer_screenshot, computer_mouse_move, computer_mouse_click
// are registered in community-skills.ts (better implementations with
// await, error handling, and more features). Do NOT re-add here.

registerTool({
  name: "computer_type",
  description: "Type text at the current cursor position (sends keystrokes to active window).",
  parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
  async execute(args) { const cu = await import("../computer-use.ts"); return cu.typeText((args as any).text); },
});

registerTool({
  name: "computer_key_press",
  description: "Press a key: enter, tab, escape, backspace, delete, arrows, home, end, ctrl_c/v/x/a/z/s, alt_tab, etc.",
  parameters: { type: "object", properties: { key: { type: "string" } }, required: ["key"], additionalProperties: false },
  async execute(args) { const cu = await import("../computer-use.ts"); return cu.keyPress((args as any).key); },
});

registerTool({
  name: "computer_screen_size",
  description: "Get primary screen resolution (width x height).",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() { const cu = await import("../computer-use.ts"); const s = cu.getScreenSize(); return `📺 Screen: ${s.width}x${s.height}`; },
});

registerTool({
  name: "computer_cursor_pos",
  description: "Get current mouse cursor position.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() { const cu = await import("../computer-use.ts"); const p = cu.getCursorPos(); return `📍 Cursor: (${p.x}, ${p.y})`; },
});

registerTool({
  name: "computer_scroll",
  description: "Scroll mouse wheel. Positive=up, negative=down.",
  parameters: { type: "object", properties: { amount: { type: "number" } }, required: ["amount"], additionalProperties: false },
  async execute(args) { const cu = await import("../computer-use.ts"); return cu.scroll((args as any).amount); },
});

registerTool({
  name: "computer_drag",
  description: "Drag mouse from (x1,y1) to (x2,y2) with smooth movement.",
  parameters: { type: "object", properties: { x1: { type: "number" }, y1: { type: "number" }, x2: { type: "number" }, y2: { type: "number" }, steps: { type: "number", default: 10 } }, required: ["x1", "y1", "x2", "y2"], additionalProperties: false },
  async execute(args) { const a = args as any; const cu = await import("../computer-use.ts"); return cu.mouseDrag(a.x1, a.y1, a.x2, a.y2, a.steps || 10); },
});

// ─── Kanban Orchestrator Tool ──────────────────────────────────
registerTool({
  name: "orchestrate",
  description: "Break down a complex task and delegate to specialized agents in parallel. Use when a task has multiple independent parts.",
  parameters: { type: "object", properties: { task: { type: "string", description: "The complex task to break down and execute" }, modelRef: { type: "string", default: "deepseek/deepseek-chat" } }, required: ["task"], additionalProperties: false },
  async execute(args: any) {
    const { orchestrate } = await import("../kanban-orchestrator.ts");
    const result = await orchestrate(args.task, args.modelRef);
    return result.summary;
  },
});

// ─── Checkpoint Tools ─────────────────────────────────────────
registerTool({
  name: "create_checkpoint",
  description: "Create a file backup snapshot before making changes. Restore with restore_checkpoint. Use before risky file operations.",
  parameters: { type: "object", properties: { description: { type: "string", default: "auto-checkpoint" }, files: { type: "array", items: { type: "string" }, description: "File paths to backup (optional — defaults to current workspace files)" } }, additionalProperties: false },
  async execute(args: any) {
    const { makeSnapshot, listSnapshots } = await import("../checkpoint/store.ts");
    const desc = args.description || `checkpoint_${Date.now()}`;
    const files = args.files || [];
    const snapshot = makeSnapshot(desc, files);
    return `✅ Checkpoint created: ${snapshot.id}\n${snapshot.description}\n${snapshot.files.length} file(s) backed up`;
  },
});

registerTool({
  name: "restore_checkpoint",
  description: "Restore files from a previous checkpoint. Use checkpoint ID from list_checkpoints.",
  parameters: { type: "object", properties: { id: { type: "string", description: "Checkpoint ID to restore from" } }, required: ["id"], additionalProperties: false },
  async execute(args: any) {
    const { rewindFiles, listSnapshots } = await import("../checkpoint/store.ts");
    const snapshots = listSnapshots();
    const snap = snapshots.find(s => s.id === args.id);
    if (!snap) return `❌ Checkpoint "${args.id}" not found. Use list_checkpoints to see available IDs.`;
    const count = rewindFiles(args.id);
    return `✅ Restored ${count} file(s) from checkpoint ${args.id} (${snap.description})`;
  },
});

registerTool({
  name: "list_checkpoints",
  description: "List all available file checkpoints/snapshots.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute() {
    const { listSnapshots } = await import("../checkpoint/store.ts");
    const snapshots = listSnapshots();
    if (snapshots.length === 0) return "No checkpoints available.";
    return snapshots.map(s => `- ${s.id}: ${s.description} (${s.files.length} files, ${new Date(s.createdAt).toLocaleString()})`).join("\n");
  },
});

// ── Bluesky Tools ──────────────────────────────────────────
for (const key of Object.keys(bskyTools)) {
  registerTool(bskyTools[key]);
}

// ── Social Media Tools ────────────────────────────────────
console.log(`[social] registering ${Object.keys(socialTools).length} tool(s)`);
for (const key of Object.keys(socialTools)) {
  registerTool(socialTools[key]);
  console.log(`[social] registered: ${key}`);
}

