/**
 * ToolCallCard — ZCode-style compact inline tool visualization
 * One-line entries with verb icons, not verbose cards
 */
import { FileText, FolderOpen, Search, Play, Terminal, Globe, Brain, Zap, Check, X } from "lucide-react";

interface ToolCallCardProps {
  tool: string;
  args?: any;
  result?: string;
  success?: boolean;
  duration?: number;
  status?: "running" | "done" | "error";
}

const VERB_MAP: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  workspace_read_file: { icon: FileText, color: "#3b82f6", label: "Read" },
  workspace_list_files: { icon: FolderOpen, color: "#3b82f6", label: "List" },
  workspace_write_file: { icon: FileText, color: "#22c55e", label: "Wrote" },
  workspace_edit_file: { icon: FileText, color: "#22c55e", label: "Edited" },
  workspace_run_command: { icon: Terminal, color: "#8b5cf6", label: "Run" },
  workspace_search_files: { icon: Search, color: "#f59e0b", label: "Searched" },
  workspace_get_state: { icon: FolderOpen, color: "#3b82f6", label: "Explored" },
  web_fetch: { icon: Globe, color: "#3b82f6", label: "Fetched" },
  web_search: { icon: Search, color: "#f59e0b", label: "Searched" },
  spawn_sub_agent: { icon: Brain, color: "#a78bfa", label: "Delegated" },
};

function getVerbInfo(tool: string) {
  return VERB_MAP[tool] || { icon: Zap, color: "#94a3b8", label: tool };
}

function getArgsSummary(tool: string, args: any): string {
  if (!args) return "";
  const a = typeof args === "string" ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : args;
  switch (tool) {
    case "workspace_read_file": return a.path || a.file || "";
    case "workspace_write_file": return a.path || a.file || "";
    case "workspace_edit_file": return a.path || a.file || "";
    case "workspace_list_files": return a.path || a.dir || "";
    case "workspace_search_files": return a.query || a.pattern || "";
    case "workspace_run_command": return a.command || a.cmd || "";
    case "web_fetch": return a.url || "";
    case "web_search": return a.query || "";
    default: return a.path || a.file || a.query || a.command || "";
  }
}

export function ToolCallCard({ tool, args, result, success, duration, status = "done" }: ToolCallCardProps) {
  const verb = getVerbInfo(tool);
  const Icon = verb.icon;
  const argsSummary = getArgsSummary(tool, args);

  // ZCode style: compact one-line entry
  return (
    <div className="flex items-center gap-2 py-1 text-xs text-[#94a3b8]">
      <Icon size={12} style={{ color: verb.color }} className="flex-shrink-0" />
      <span className="font-medium" style={{ color: verb.color }}>{verb.label}</span>
      {argsSummary && (
        <span className="text-[#475569] font-mono truncate">
          {argsSummary.length > 40 ? argsSummary.slice(0, 40) + "..." : argsSummary}
        </span>
      )}
      {status === "done" && success !== false && duration !== undefined && (
        <span className="text-[#22c55e] ml-auto flex-shrink-0">{duration}ms</span>
      )}
      {status === "done" && success === false && (
        <span className="text-[#ef4444] ml-auto flex-shrink-0">Failed</span>
      )}
      {status === "running" && (
        <span className="text-[#8b5cf6] ml-auto flex-shrink-0 animate-pulse">...</span>
      )}
    </div>
  );
}
