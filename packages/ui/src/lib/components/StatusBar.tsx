import { Folder } from "lucide-react";

interface StatusBarProps {
  connected: boolean;
  version: string;
  selectedModel: string;
  models: Array<{ id: string }>;
  workspaceName: string;
  onWorkspacePick: () => void;
  onModelChange: (model: string) => void;
  onNewChat: () => void;
}

export function StatusBar({
  connected, version, selectedModel, models, workspaceName, onWorkspacePick, onModelChange, onNewChat,
}: StatusBarProps) {
  const modelLabel = (id: string) => {
    const short = id.split("/").pop() || id;
    return short.length > 24 ? short.slice(0, 24) + "..." : short;
  };

  return (
    <header className="h-14 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between px-6 z-10 bg-[rgba(18,18,26,0.7)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${connected ? "bg-[#22c55e] active-dot" : "bg-[#475569]"}`} />
        <span className="text-xs font-mono text-[#475569]">
          {connected ? (
            <><span className="text-[#00d4ff]">Nexus AI</span> v{version} · {modelLabel(selectedModel)}</>
          ) : (
            <span className="text-[#ef4444]">Disconnected</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={selectedModel}
          className="glass-input px-3 py-1.5 text-xs cursor-pointer"
          onChange={(e) => onModelChange(e.target.value)}
        >
          {models.length > 0 ? (
            models.map((m) => (
              <option key={m.id} value={m.id}>{modelLabel(m.id)}</option>
            ))
          ) : (
            <>
              <option value="deepseek/deepseek-chat">deepseek-chat</option>
              <option value="deepseek/deepseek-coder">deepseek-coder</option>
            </>
          )}
        </select>

        <button
          onClick={onWorkspacePick}
          className="btn-glass flex items-center gap-2 px-3.5 py-1.5 text-xs"
        >
          <Folder size={14} className="text-[#6366f1]" />
          <span>{workspaceName || "No folder selected"}</span>
        </button>

        <button
          onClick={onNewChat}
          className="btn-nova px-3.5 py-1.5 text-xs"
        >
          New Chat
        </button>
      </div>
    </header>
  );
}
