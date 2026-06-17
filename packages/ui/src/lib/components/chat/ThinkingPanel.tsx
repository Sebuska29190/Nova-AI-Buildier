/**
 * ThinkingPanel — Collapsible reasoning display
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";

interface ThinkingPanelProps {
  content: string;
  isStreaming?: boolean;
}

export function ThinkingPanel({ content, isStreaming = false }: ThinkingPanelProps) {
  const [expanded, setExpanded] = useState(isStreaming);

  if (!content && !isStreaming) return null;

  return (
    <div className="my-2 rounded-lg border border-[rgba(139,92,246,0.15)] bg-[rgba(139,92,246,0.03)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(139,92,246,0.05)] transition-colors"
      >
        <Brain size={12} className="text-[#8b5cf6]" />
        <span className="text-[11px] text-[#94a3b8] font-medium">
          {isStreaming ? "Thinking..." : "Thinking"}
        </span>
        {isStreaming && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] animate-pulse" />
        )}
        <span className="ml-auto text-[#475569]">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>
      {expanded && content && (
        <div className="px-3 pb-3 border-t border-[rgba(139,92,246,0.1)]">
          <p className="mt-2 text-[11px] text-[#94a3b8] italic leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}
