/**
 * AgentActivityPanel — Right sidebar showing agent's real-time activity
 * Inspired by OpenCode/Claude Code activity panels
 */
import { useState, useEffect, useRef } from "react";
import { Activity, Clock, Zap, FileText, ChevronDown, ChevronRight, Check, X, Loader2, FolderGit2 } from "lucide-react";
import { ToolCallCard } from "./ToolCallCard";

interface AgentActivityPanelProps {
  status: "idle" | "thinking" | "acting" | "done" | "error";
  toolCalls: Array<{
    tool: string;
    args?: any;
    result?: string;
    success?: boolean;
    duration?: number;
    timestamp: number;
  }>;
  duration: number;
  tokens?: { input: number; output: number };
}

const STATUS_CONFIG = {
  idle: { label: "Idle", color: "#475569", bg: "rgba(71,85,105,0.1)" },
  thinking: { label: "Thinking...", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  acting: { label: "Working...", color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  done: { label: "Done", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  error: { label: "Error", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function extractFilePath(tool: string, args: any): string | null {
  if (!args) return null;
  const a = typeof args === "string" ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : args;
  const path = a.path || a.file || a.dir;
  if (!path) return null;
  // Shorten: keep last 2 segments
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.length > 2 ? ".../" + parts.slice(-2).join("/") : path;
}

export function AgentActivityPanel({ status, toolCalls, duration, tokens }: AgentActivityPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAllTools, setShowAllTools] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const config = STATUS_CONFIG[status];

  // Stats
  const readCount = toolCalls.filter(t => t.tool.includes("read") || t.tool.includes("list")).length;
  const editCount = toolCalls.filter(t => t.tool.includes("write") || t.tool.includes("edit")).length;
  const runCount = toolCalls.filter(t => t.tool.includes("run") || t.tool.includes("exec")).length;
  const searchCount = toolCalls.filter(t => t.tool.includes("search")).length;
  const otherCount = toolCalls.length - readCount - editCount - runCount - searchCount;
  const successCount = toolCalls.filter(t => t.success !== false).length;
  const failCount = toolCalls.length - successCount;
  const totalToolDuration = toolCalls.reduce((acc, t) => acc + (t.duration || 0), 0);

  // Unique files accessed
  const files = [...new Set(
    toolCalls
      .map(t => extractFilePath(t.tool, t.args))
      .filter(Boolean)
  )].slice(0, 8);

  const visibleTools = showAllTools ? toolCalls : toolCalls.slice(-8);

  // Auto-scroll to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [toolCalls.length]);

  return (
    <div className="w-72 border-l border-[rgba(255,255,255,0.06)] bg-[rgba(18,18,26,0.95)] flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-[#6366f1]" />
          <span className="text-[11px] font-semibold text-white">Agent Activity</span>
        </div>
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{ color: config.color, background: config.bg }}
        >
          {status === "thinking" || status === "acting" ? (
            <Loader2 size={10} className="animate-spin" />
          ) : status === "done" ? (
            <Check size={10} />
          ) : status === "error" ? (
            <X size={10} />
          ) : null}
          {config.label}
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-4 py-2.5 border-b border-[rgba(255,255,255,0.04)] grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <Zap size={10} className="text-[#6366f1]" />
          <span className="text-[10px] text-[#8892a8]">{toolCalls.length} tools</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={10} className="text-[#475569]" />
          <span className="text-[10px] text-[#8892a8]">{formatDuration(duration)}</span>
        </div>
        {tokens && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#475569]">IN:</span>
              <span className="text-[10px] text-[#8892a8]">{(tokens.input / 1000).toFixed(1)}K</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#475569]">OUT:</span>
              <span className="text-[10px] text-[#8892a8]">{(tokens.output / 1000).toFixed(1)}K</span>
            </div>
          </>
        )}
      </div>

      {/* Tool Breakdown */}
      {toolCalls.length > 0 && (
        <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.04)] flex flex-wrap gap-1.5">
          {readCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(59,130,246,0.1)] text-[#3b82f6] border border-[rgba(59,130,246,0.15)]">
              {readCount} read{readCount !== 1 ? "s" : ""}
            </span>
          )}
          {editCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(34,197,94,0.1)] text-[#22c55e] border border-[rgba(34,197,94,0.15)]">
              {editCount} edit{editCount !== 1 ? "s" : ""}
            </span>
          )}
          {runCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(139,92,246,0.1)] text-[#8b5cf6] border border-[rgba(139,92,246,0.15)]">
              {runCount} run{runCount !== 1 ? "s" : ""}
            </span>
          )}
          {searchCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(245,158,11,0.1)] text-[#f59e0b] border border-[rgba(245,158,11,0.15)]">
              {searchCount} search{searchCount !== 1 ? "es" : ""}
            </span>
          )}
          {otherCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(148,163,184,0.1)] text-[#94a3b8] border border-[rgba(148,163,184,0.15)]">
              {otherCount} other
            </span>
          )}
          {failCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(239,68,68,0.1)] text-[#ef4444] border border-[rgba(239,68,68,0.15)]">
              {failCount} failed
            </span>
          )}
        </div>
      )}

      {/* Files Accessed */}
      {files.length > 0 && (
        <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.04)]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FolderGit2 size={10} className="text-[#475569]" />
            <span className="text-[9px] text-[#475569] uppercase tracking-wider">Files</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {files.map((f, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.03)] text-[#64748b] font-mono truncate max-w-[180px]">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tool Activity Log */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-4 py-2 flex items-center justify-between hover:bg-[rgba(255,255,255,0.02)] transition-colors"
        >
          <span className="text-[9px] text-[#475569] uppercase tracking-wider">Activity Log</span>
          {expanded ? <ChevronDown size={10} className="text-[#475569]" /> : <ChevronRight size={10} className="text-[#475569]" />}
        </button>

        {expanded && (
          <div ref={logRef} className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5 min-h-0">
            {visibleTools.length === 0 ? (
              <div className="text-[10px] text-[#475569] text-center py-4">
                {status === "idle" ? "Waiting for task..." : "Starting..."}
              </div>
            ) : (
              visibleTools.map((tc, i) => (
                <ToolCallCard
                  key={`${tc.timestamp}-${i}`}
                  tool={tc.tool}
                  args={tc.args}
                  success={tc.success}
                  duration={tc.duration}
                  status={i === visibleTools.length - 1 && status === "acting" ? "running" : "done"}
                />
              ))
            )}
            {status === "thinking" && (
              <div className="flex items-center gap-2 py-1 text-xs text-[#f59e0b]">
                <Loader2 size={10} className="animate-spin" />
                <span className="text-[10px]">Analyzing...</span>
              </div>
            )}
          </div>
        )}

        {/* Show more button */}
        {toolCalls.length > 8 && !showAllTools && (
          <button
            onClick={() => setShowAllTools(true)}
            className="px-4 py-1.5 text-[10px] text-[#6366f1] hover:text-[#818cf8] transition-colors border-t border-[rgba(255,255,255,0.04)]"
          >
            Show all {toolCalls.length} tool calls
          </button>
        )}
      </div>

      {/* Total Tool Duration */}
      {totalToolDuration > 0 && (
        <div className="px-4 py-2 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <span className="text-[9px] text-[#475569]">Tool execution time</span>
          <span className="text-[10px] text-[#8892a8] font-mono">{formatDuration(totalToolDuration)}</span>
        </div>
      )}
    </div>
  );
}
