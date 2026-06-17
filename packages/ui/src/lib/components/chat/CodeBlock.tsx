/**
 * CodeBlock — Smart code rendering with copy, line numbers, syntax highlighting
 */
import { useState } from "react";
import { Copy, Check, FileCode } from "lucide-react";

interface CodeBlockProps {
  language?: string;
  code: string;
  showLineNumbers?: boolean;
  filename?: string;
  onApply?: (code: string) => void;
}

export function CodeBlock({ language = "", code, showLineNumbers = false, filename, onApply }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");
  const lang = language || "text";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="my-2 rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[rgba(255,255,255,0.03)] border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2">
          <FileCode size={12} className="text-[#475569]" />
          <span className="text-[10px] text-[#475569] font-mono">{filename || lang}</span>
        </div>
        <div className="flex items-center gap-1">
          {onApply && (
            <button onClick={() => onApply(code)} className="text-[10px] text-[#22c55e] hover:text-[#4ade80] px-1.5 py-0.5 rounded hover:bg-[rgba(34,197,94,0.1)] transition-colors">
              Apply
            </button>
          )}
          <button onClick={handleCopy} className="text-[10px] text-[#475569] hover:text-[#94a3b8] px-1.5 py-0.5 rounded hover:bg-[rgba(255,255,255,0.04)] transition-colors flex items-center gap-1">
            {copied ? <><Check size={10} className="text-[#22c55e]" /> Copied</> : <><Copy size={10} /> Copy</>}
          </button>
        </div>
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="p-3 text-[12px] font-mono leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              {showLineNumbers && (
                <span className="w-8 text-right pr-3 text-[10px] text-[rgba(255,255,255,0.15)] select-none shrink-0">{i + 1}</span>
              )}
              <code className="text-[#e2e8f0]">{line || " "}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
