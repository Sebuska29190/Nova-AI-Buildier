/**
 * AgentWorkPanel — Live agent execution viewer (like OpenClaw)
 * Shows tool calls, results, progress, and final output in real-time via SSE
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Wrench, CheckCircle2, XCircle, Loader2, Brain, Terminal, ChevronDown, ChevronRight, Clock, BarChart3, Send, StopCircle } from "lucide-react";

interface ToolEvent {
  type: string;
  data: {
    name?: string;
    arguments?: Record<string, unknown>;
    toolCallId?: string;
    toolName?: string;
    success?: boolean;
    durationMs?: number;
    error?: string;
    resultPreview?: string;
    iteration?: number;
  };
  ts: number;
}

interface AgentWorkState {
  tools: Array<{
    name: string;
    args: Record<string, unknown>;
    status: "running" | "done" | "error";
    durationMs?: number;
    error?: string;
    resultPreview?: string;
  }>;
  status: "idle" | "running" | "done" | "error";
  totalTools: number;
  thinking: string;
  finalOutput: string;
  error: string;
  startTime: number | null;
}

interface Props {
  runId: string;
  agentName?: string;
  className?: string;
  onComplete?: (output: string) => void;
}

export function AgentWorkPanel({ runId, agentName, className = "", onComplete }: Props) {
  const [state, setState] = useState<AgentWorkState>({
    tools: [],
    status: "idle",
    totalTools: 0,
    thinking: "",
    finalOutput: "",
    error: "",
    startTime: null,
  });
  const [expanded, setExpanded] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [steerMsg, setSteerMsg] = useState("");

  const sendSteer = useCallback(async () => {
    if (!steerMsg.trim() || !runId) return;
    try {
      await fetch(`/api/agents/runs/${runId}/steer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: steerMsg.trim() }),
      });
      setSteerMsg("");
    } catch {}
  }, [steerMsg, runId]);

  const stopRun = useCallback(async () => {
    if (!runId) return;
    try {
      await fetch(`/api/agents/runs/${runId}/stop`, { method: "POST" });
      setState(prev => ({ ...prev, status: "done" }));
    } catch {}
  }, [runId]);
  const evSourceRef = useRef<EventSource | null>(null);

  // Connect to SSE
  useEffect(() => {
    if (!runId) return;
    setState(prev => ({ ...prev, status: "running", startTime: Date.now() }));

    const es = new EventSource(`/api/agents/runs/${runId}/events`);
    evSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const event: ToolEvent = JSON.parse(e.data);

        if (event.type === "done") {
          setState(prev => ({ ...prev, status: "done" }));
          es.close();
          return;
        }
        if (event.type === "error") {
          setState(prev => ({ ...prev, status: "error", error: event.data.error || "Unknown error" }));
          es.close();
          return;
        }
        if (event.type === "thinking") {
          setState(prev => ({ ...prev, thinking: event.data.resultPreview || "" }));
          return;
        }
        if (event.type === "tool_call") {
          setState(prev => ({
            ...prev,
            status: "running",
            tools: [...prev.tools, {
              name: event.data.name || "unknown",
              args: event.data.arguments || {},
              status: "running",
            }],
          }));
          return;
        }
        if (event.type === "tool_result") {
          setState(prev => ({
            ...prev,
            tools: prev.tools.map((t, i) => {
              // Match by index — last running tool
              if (i === prev.tools.length - 1 && t.status === "running") {
                return {
                  ...t,
                  status: event.data.success ? "done" : "error",
                  durationMs: event.data.durationMs,
                  error: event.data.error,
                  resultPreview: event.data.resultPreview,
                };
              }
              return t;
            }),
            totalTools: prev.totalTools + 1,
          }));
          return;
        }
        if (event.type === "assistant") {
          setState(prev => ({ ...prev, finalOutput: event.data.text as string }));
          return;
        }
      } catch {}
    };

    es.onerror = () => {
      // SSE connection lost — poll for status
      setTimeout(() => {
        fetch(`/api/agents/runs/${runId}/status`)
          .then(r => r.json())
          .then(data => {
            if (data.status === "done" || data.status === "error" || data.status === "completed") {
              setState(prev => ({ ...prev, status: data.status }));
            }
          }).catch(() => {});
      }, 1000);
    };

    return () => { es.close(); };
  }, [runId]);

  // Elapsed timer
  useEffect(() => {
    if (state.status !== "running" || !state.startTime) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (state.startTime || 0)) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [state.status, state.startTime]);

  // Notify on complete
  useEffect(() => {
    if (state.status === "done" && state.finalOutput && onComplete) {
      onComplete(state.finalOutput);
    }
  }, [state.status, state.finalOutput]);

  const doneTools = state.tools.filter(t => t.status !== "running").length;
  const runningTools = state.tools.filter(t => t.status === "running").length;
  const errorTools = state.tools.filter(t => t.status === "error").length;

  if (state.status === "idle") return null;

  return (
    <div className={`glass-card rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[rgba(255,255,255,0.03)] border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            state.status === "done" ? "bg-[#22c55e]" :
            state.status === "error" ? "bg-[#ef4444]" :
            "bg-[#6366f1] animate-pulse"
          }`} />
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-[#6366f1]" />
            <span className="text-xs font-medium text-white">
              {agentName ? `${agentName} — ` : ""}
              {state.status === "done" ? "Completed" :
               state.status === "error" ? "Failed" :
               "Working…"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-[#4a5068] font-mono">
          {state.status === "running" && elapsed > 0 && (
            <span className="flex items-center gap-1"><Clock size={10} /> {elapsed}s</span>
          )}
          {doneTools > 0 && <span>{doneTools} tools</span>}
          {errorTools > 0 && <span className="text-[#ef4444]">{errorTools} failed</span>}
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="max-h-80 overflow-y-auto">
          {/* Error banner */}
          {state.error && (
            <div className="m-3 p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)]">
              <p className="text-xs text-[#ef4444]">{state.error}</p>
            </div>
          )}

          {/* Thinking */}
          {state.thinking && (
            <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-2 text-[9px] text-[#4a5068] mb-1">
                <Brain size={10} /> Thinking…
              </div>
              <p className="text-[10px] text-[#8892a8] line-clamp-3">{state.thinking}</p>
            </div>
          )}

          {/* Tool list */}
          {state.tools.length > 0 && (
            <div className="divide-y divide-[rgba(255,255,255,0.03)]">
              {state.tools.map((tool, i) => (
                <ToolEntry key={i} tool={tool} index={i} />
              ))}
            </div>
          )}

          {/* Live indicator */}
          {runningTools > 0 && (
            <div className="px-4 py-2 flex items-center gap-2">
              <Loader2 size={12} className="text-[#6366f1] animate-spin" />
              <span className="text-[9px] text-[#6366f1]">
                Working… {doneTools}/{state.tools.length} completed
              </span>
            </div>
          )}

          {/* Final output */}
          {state.finalOutput && (
            <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.06)] bg-[rgba(99,102,241,0.04)]">
              <div className="flex items-center gap-2 text-[9px] text-[#22c55e] mb-1">
                <CheckCircle2 size={10} /> Output
              </div>
              <p className="text-[10px] text-[#e2e8f0] whitespace-pre-wrap">{state.finalOutput.slice(0, 500)}</p>
            </div>
          )}

          {/* Steer & Stop — mid-execution intervention */}
          {state.status === "running" && (
            <div className="px-4 py-2 border-t border-[rgba(255,255,255,0.04)] flex items-center gap-2 bg-[rgba(0,0,0,0.15)]">
              <input
                value={steerMsg}
                onChange={e => setSteerMsg(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendSteer()}
                placeholder="Tell agent what to focus on…"
                className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-[#6366f1] placeholder:text-[#4a5068]"
              />
              <button
                onClick={sendSteer}
                disabled={!steerMsg.trim()}
                className="p-1.5 rounded-lg bg-[rgba(99,102,241,0.1)] text-[#6366f1] hover:bg-[rgba(99,102,241,0.2)] disabled:opacity-30 transition-all"
              >
                <Send size={12} />
              </button>
              <button
                onClick={stopRun}
                className="p-1.5 rounded-lg bg-[rgba(239,68,68,0.1)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)] transition-all"
                title="Stop agent"
              >
                <StopCircle size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tool Entry (single tool call) ──────────────────────────
function ToolEntry({ tool, index }: { tool: AgentWorkState["tools"][0]; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="px-4 py-2 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left"
      >
        {tool.status === "running" ? (
          <Loader2 size={10} className="text-[#6366f1] animate-spin shrink-0" />
        ) : tool.status === "error" ? (
          <XCircle size={10} className="text-[#ef4444] shrink-0" />
        ) : (
          <CheckCircle2 size={10} className="text-[#22c55e] shrink-0" />
        )}
        <span className="text-[10px] font-mono text-[#6366f1]">{tool.name}</span>
        {tool.durationMs && (
          <span className="text-[8px] text-[#4a5068]">{(tool.durationMs / 1000).toFixed(1)}s</span>
        )}
        {tool.status !== "running" && (
          <span className="ml-auto">
            {open ? <ChevronDown size={10} className="text-[#4a5068]" /> : <ChevronRight size={10} className="text-[#4a5068]" />}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-1 ml-5 pl-2 border-l border-[rgba(255,255,255,0.06)]">
          {Object.keys(tool.args).length > 0 && (
            <p className="text-[8px] text-[#4a5068] mb-1 font-mono">
              {JSON.stringify(tool.args, null, 2).slice(0, 200)}
            </p>
          )}
          {tool.resultPreview && (
            <p className="text-[9px] text-[#8892a8]">{tool.resultPreview}</p>
          )}
          {tool.error && (
            <p className="text-[9px] text-[#ef4444]">{tool.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
