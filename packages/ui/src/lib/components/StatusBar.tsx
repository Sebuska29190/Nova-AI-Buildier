import { Folder } from "lucide-react";

interface StatusBarProps {
  connected: boolean;
  version: string;
  selectedModel: string;
  models: Array<{ id: string }>;
  workspaceName: string;
  onWorkspacePick: () => void;
}

export function StatusBar({
  connected, version, selectedModel, models, workspaceName, onWorkspacePick,
}: StatusBarProps) {
  return (
    <header className="h-14 border-b border-gray-800 flex items-center justify-between px-6 z-10 bg-[#0e1117]/70 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500 active-dot" />
        <span className="text-xs font-mono text-gray-400">
          Agent Status: <strong className="text-white">deepseek-v4-flash {connected ? "(active)" : "(offline)"}</strong>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={selectedModel}
          className="bg-[#161b22] border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-teal-500/50 transition-all"
          onChange={() => {}}
        >
          <option value="deepseek-chat">deepseek-chat (v4-flash)</option>
          <option value="deepseek-coder">deepseek-coder-v2</option>
          <option value="nova-ai-builder">Nova AI Builder</option>
        </select>

        <button
          onClick={onWorkspacePick}
          className="flex items-center gap-2 bg-[#161b22] hover:bg-[#1c2333] border border-gray-800 rounded-lg px-3.5 py-1.5 text-xs text-gray-300 transition-all"
        >
          <Folder size={14} className="text-teal-400" />
          <span>{workspaceName || "No folder selected"}</span>
        </button>

        <button className="bg-[#161b22] hover:bg-gray-800 text-gray-300 border border-gray-800 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all">
          New Chat
        </button>
      </div>
    </header>
  );
}
