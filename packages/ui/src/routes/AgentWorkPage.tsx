/**
 * AgentWorkPage — Live agent execution viewer
 * Shows real-time tool calls, progress, and results for a running agent
 */
import { useState } from "react";
import { ArrowLeft, RefreshCw, RotateCw } from "lucide-react";
import { AgentWorkPanel } from "../lib/components/agent/AgentWorkPanel";

export function AgentWorkPage() {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId") || "";
  const agentName = params.get("agent") || "";
  const [completed, setCompleted] = useState(false);

  const handleComplete = (output: string) => {
    setCompleted(true);
  };

  const handleBack = () => {
    window.history.back();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-[rgba(255,255,255,0.04)] flex items-center gap-4">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[#4a5068] hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-sm font-bold text-white">
            {agentName ? `${agentName} — Agent Work` : "Agent Work"}
          </h1>
          <p className="text-[9px] text-[#4a5068] font-mono">Run: {runId.slice(0, 12)}</p>
        </div>
        {completed && (
          <span className="ml-auto text-[9px] flex items-center gap-1 px-2 py-1 rounded-full bg-[rgba(34,197,94,0.1)] text-[#22c55e] border border-[rgba(34,197,94,0.2)]">
            <RefreshCw size={10} /> Complete
          </span>
        )}
      </div>

      {/* Work Panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {runId ? (
          <AgentWorkPanel
            runId={runId}
            agentName={agentName}
            onComplete={handleComplete}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RotateCw size={32} className="mx-auto mb-3 text-[#4a5068] animate-spin" />
              <p className="text-xs text-[#4a5068]">No active agent run</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
