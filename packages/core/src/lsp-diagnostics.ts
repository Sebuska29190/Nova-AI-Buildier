import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

interface Diagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

/**
 * Run diagnostics on a file after write/edit.
 * Returns array of diagnostics or empty array if clean.
 */
export function runDiagnostics(filePath: string, workspaceRoot: string): Diagnostic[] {
  const ext = filePath.split(".").pop()?.toLowerCase();

  try {
    if (ext === "ts" || ext === "tsx") {
      return runTsc(filePath, workspaceRoot);
    } else if (ext === "js" || ext === "jsx") {
      return runEslint(filePath, workspaceRoot);
    } else if (ext === "py") {
      return runPyCompile(filePath);
    } else if (ext === "json") {
      return runJsonValidate(filePath);
    } else if (ext === "yaml" || ext === "yml") {
      return runYamlValidate(filePath);
    }
  } catch {
    // Silently fail — diagnostics are non-blocking
  }

  return [];
}

function runTsc(filePath: string, root: string): Diagnostic[] {
  try {
    const result = execSync(`npx -y tsc --noEmit --pretty false 2>&1 || true`, {
      cwd: root,
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      shell: true,
      encoding: "utf-8",
      windowsHide: true,
    });
    return parseTscOutput(result, filePath);
  } catch {
    return [];
  }
}

function parseTscOutput(output: string, targetFile: string): Diagnostic[] {
  const results: Diagnostic[] = [];
  const lines = output.split("\n");
  for (const line of lines) {
    // Format: "path/file.ts(line,column): error TS2345: message"
    const match = line.match(/^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);
    if (match) {
      const file = match[1].trim();
      // Only report errors for the target file to avoid noise
      if (!file.endsWith(targetFile.replace(/\\/g, "/").split("/").pop() || "")) continue;
      results.push({
        file: file.split("/").pop() || file,
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        message: `${match[5]}: ${match[6]}`,
        severity: match[4] as "error" | "warning",
      });
    }
  }
  return results;
}

function runEslint(filePath: string, root: string): Diagnostic[] {
  try {
    execSync(`npx eslint "${filePath}" --format compact 2>&1 || true`, {
      cwd: root,
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      shell: true,
      encoding: "utf-8",
      windowsHide: true,
    });
  } catch {}
  return [];
}

function runPyCompile(filePath: string): Diagnostic[] {
  try {
    execSync(`python -c "import py_compile; py_compile.compile('${filePath.replace(/'/g, "'\\''")}', doraise=True)" 2>&1 || true`, {
      timeout: 10000,
      shell: true,
      encoding: "utf-8",
      windowsHide: true,
    });
  } catch {}
  return [];
}

function runJsonValidate(filePath: string): Diagnostic[] {
  try {
    const content = require("fs").readFileSync(filePath, "utf-8");
    JSON.parse(content);
  } catch (e: any) {
    return [{
      file: filePath.split("/").pop() || filePath,
      line: 0,
      column: 0,
      message: `Invalid JSON: ${e.message}`,
      severity: "error",
    }];
  }
  return [];
}

function runYamlValidate(filePath: string): Diagnostic[] {
  try {
    execSync(`python -c "import yaml; yaml.safe_load(open('${filePath.replace(/'/g, "'\\''")}'))" 2>&1 || true`, {
      timeout: 10000,
      shell: true,
      encoding: "utf-8",
      windowsHide: true,
    });
  } catch {}
  return [];
}

/**
 * Format diagnostics as a human-readable string for the agent footer.
 */
export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return "";
  const errors = diagnostics.filter(d => d.severity === "error");
  const warnings = diagnostics.filter(d => d.severity === "warning");
  const parts: string[] = [];
  if (errors.length > 0) {
    parts.push(`❌ ${errors.length} error${errors.length > 1 ? "s" : ""}`);
    for (const e of errors) {
      parts.push(`  L${e.line}:${e.column} — ${e.message}`);
    }
  }
  if (warnings.length > 0) {
    parts.push(`⚠️ ${warnings.length} warning${warnings.length > 1 ? "s" : ""}`);
    for (const w of warnings) {
      parts.push(`  L${w.line}:${w.column} — ${w.message}`);
    }
  }
  return parts.join("\n");
}
