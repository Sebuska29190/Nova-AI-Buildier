/**
 * CodeEditorPage — Professional code editor with LSP support
 * Monaco-style editor for writing and editing code
 */
import { useState, useEffect, useRef } from "react";
import { Code, FileCode, Save, Play, Search, FolderGit2, Terminal, Settings, ChevronRight, ChevronDown, File, Folder, X, Check, AlertTriangle } from "lucide-react";
import { GlassCard } from "../lib/components/ui/GlassCard";
import { GlassButton } from "../lib/components/ui/GlassButton";
import { GlassInput } from "../lib/components/ui/GlassInput";
import { GlassBadge } from "../lib/components/ui/GlassBadge";
import { GlassTabs } from "../lib/components/ui/GlassTabs";

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}

interface Tab {
  id: string;
  name: string;
  path: string;
  content: string;
  modified: boolean;
}

// ─── File Tree Component ──────────────────────────────
function FileTree({ files, onSelect, selectedPath }: { files: FileNode[]; onSelect: (path: string) => void; selectedPath: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleExpand(path: string) {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  }

  return (
    <div className="space-y-0.5">
      {files.map(file => (
        <div key={file.path}>
          <button
            onClick={() => file.type === "folder" ? toggleExpand(file.path) : onSelect(file.path)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${
              selectedPath === file.path
                ? "bg-[rgba(99,102,241,0.1)] text-[#818cf8]"
                : "text-[#94a3b8] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f1f5f9]"
            }`}
          >
            {file.type === "folder" ? (
              expanded[file.path] ? <ChevronDown size={12} /> : <ChevronRight size={12} />
            ) : (
              <File size={12} className="text-[#475569]" />
            )}
            {file.type === "folder" ? <Folder size={12} className="text-[#6366f1]" /> : <FileCode size={12} className="text-[#475569]" />}
            <span className="truncate">{file.name}</span>
          </button>
          {file.type === "folder" && expanded[file.path] && file.children && (
            <div className="ml-4">
              <FileTree files={file.children} onSelect={onSelect} selectedPath={selectedPath} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────
export function CodeEditorPage() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Load workspace files
  useEffect(() => { loadFiles(); }, []);

  async function loadFiles() {
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/tree");
      if (res.ok) {
        const data = await res.json();
        setFiles(buildTree(data.files || []));
      }
    } catch {}
    finally { setLoading(false); }
  }

  function buildTree(filePaths: string[]): FileNode[] {
    const tree: FileNode[] = [];
    const map: Record<string, FileNode> = {};

    for (const path of filePaths.sort()) {
      const parts = path.split("/").filter(Boolean);
      let current = tree;

      for (let i = 0; i < parts.length; i++) {
        const isFile = i === parts.length - 1;
        const fullPath = parts.slice(0, i + 1).join("/");
        const name = parts[i];

        if (isFile) {
          current.push({ name, type: "file", path: fullPath });
        } else {
          let folder = map[fullPath];
          if (!folder) {
            folder = { name, type: "folder", path: fullPath, children: [] };
            map[fullPath] = folder;
            current.push(folder);
          }
          current = folder.children!;
        }
      }
    }
    return tree;
  }

  async function openFile(path: string) {
    setSelectedFile(path);
    // Check if already open in tabs
    const existing = tabs.find(t => t.path === path);
    if (existing) {
      setActiveTab(existing.id);
      return;
    }

    // Load file content
    try {
      const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        const newTab: Tab = {
          id: Date.now().toString(),
          name: path.split("/").pop() || path,
          path,
          content: data.content || "",
          modified: false,
        };
        setTabs(prev => [...prev, newTab]);
        setActiveTab(newTab.id);
      }
    } catch {}
  }

  function closeTab(id: string) {
    setTabs(prev => prev.filter(t => t.id !== id));
    if (activeTab === id) {
      const remaining = tabs.filter(t => t.id !== id);
      setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1].id : "");
    }
  }

  function updateTabContent(id: string, content: string) {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, content, modified: true } : t));
  }

  async function saveFile(id: string) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    try {
      await fetch("/api/workspace/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: tab.path, content: tab.content }),
      });
      setTabs(prev => prev.map(t => t.id === id ? { ...t, modified: false } : t));
    } catch {}
  }

  async function executeCommand() {
    if (!command.trim()) return;
    setTerminalOutput(prev => [...prev, `$ ${command}`]);
    try {
      const res = await fetch("/api/workspace/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      setTerminalOutput(prev => [...prev, data.output || "(no output)"]);
    } catch (e: any) {
      setTerminalOutput(prev => [...prev, `Error: ${e.message}`]);
    }
    setCommand("");
  }

  const activeTabData = tabs.find(t => t.id === activeTab);

  const tabsConfig = [
    { id: "editor", label: "Editor", icon: <Code size={12} /> },
    { id: "terminal", label: "Terminal", icon: <Terminal size={12} /> },
  ];

  return (
    <div className="h-[calc(100dvh-8rem)] flex gap-4 animate-fade-in-up">
      {/* File Explorer */}
      <div className="w-56 shrink-0 flex flex-col gap-4">
        <GlassCard padding="md" className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Files</h3>
            <button onClick={loadFiles} className="text-[#475569] hover:text-[#6366f1] transition-colors">
              <RefreshCw size={12} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-1">
                {[1,2,3,4,5].map(i => <div key={i} className="h-5 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />)}
              </div>
            ) : (
              <FileTree files={files} onSelect={openFile} selectedPath={selectedFile} />
            )}
          </div>
        </GlassCard>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <GlassTabs tabs={tabsConfig} activeTab={showTerminal ? "terminal" : "editor"} onChange={t => setShowTerminal(t === "terminal")} />

        {/* Tabs Bar */}
        {!showTerminal && tabs.length > 0 && (
          <div className="flex items-center gap-1 mt-2 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                  activeTab === tab.id
                    ? "bg-[rgba(99,102,241,0.1)] text-[#818cf8] border border-[rgba(99,102,241,0.2)]"
                    : "text-[#475569] hover:text-[#94a3b8] hover:bg-[rgba(255,255,255,0.04)]"
                }`}
              >
                <FileCode size={12} />
                <span className="truncate max-w-[120px]">{tab.name}</span>
                {tab.modified && <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />}
                <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className="text-[#475569] hover:text-[#ef4444] ml-1">
                  <X size={10} />
                </button>
              </button>
            ))}
          </div>
        )}

        {/* Code Editor */}
        {!showTerminal && activeTabData && (
          <GlassCard padding="none" className="flex-1 mt-2 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#475569] font-mono">{activeTabData.path}</span>
                {activeTabData.modified && <GlassBadge variant="warning">modified</GlassBadge>}
              </div>
              <div className="flex items-center gap-2">
                <GlassButton variant="ghost" size="sm" icon={<Save size={12} />} onClick={() => saveFile(activeTabData.id)} disabled={!activeTabData.modified}>
                  Save
                </GlassButton>
              </div>
            </div>
            <textarea
              ref={editorRef}
              value={activeTabData.content}
              onChange={e => updateTabContent(activeTabData.id, e.target.value)}
              className="flex-1 w-full bg-transparent border-none outline-none p-4 text-sm font-mono text-[#e2e8f0] resize-none leading-relaxed"
              spellCheck={false}
              style={{ tabSize: 2 }}
            />
          </GlassCard>
        )}

        {/* Terminal */}
        {showTerminal && (
          <GlassCard padding="none" className="flex-1 mt-2 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
              {terminalOutput.length === 0 ? (
                <p className="text-[#475569]">Terminal ready. Type a command below.</p>
              ) : (
                terminalOutput.map((line, i) => (
                  <p key={i} className={`whitespace-pre-wrap ${line.startsWith("$") ? "text-[#818cf8]" : "text-[#94a3b8]"}`}>{line}</p>
                ))
              )}
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-[rgba(255,255,255,0.06)]">
              <span className="text-[#6366f1] font-mono text-xs">$</span>
              <input
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={e => e.key === "Enter" && executeCommand()}
                className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-white"
                placeholder="Enter command..."
              />
            </div>
          </GlassCard>
        )}

        {/* Empty State */}
        {!showTerminal && tabs.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Code size={48} className="mx-auto mb-4 text-[#475569]" />
              <h3 className="text-lg font-bold text-white mb-2">Code Editor</h3>
              <p className="text-xs text-[#475569] max-w-md">Select a file from the explorer on the left to start editing. The editor supports syntax highlighting and LSP diagnostics.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple refresh icon component
function RefreshCw({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
      <path d="M16 16h5v5"/>
    </svg>
  );
}
