import { useState, useEffect, useCallback } from "react";

export function WorkspacePage() {
  const [rootDir, setRootDir] = useState("");
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { loadWorkspace(); }, []);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/status");
      if (res.ok) {
        const data = await res.json();
        if (data.rootDir) {
          setRootDir(data.rootDir);
          setActive(true);
          setFileTree(data.tree || []);
        }
      }
    } catch (e) {
      console.error("Failed to load workspace", e);
    } finally {
      setLoading(false);
    }
  }

  async function browseFolder() {
    if ("showDirectoryPicker" in window) {
      try {
        const dir = await (window as any).showDirectoryPicker();
        setRootDir(dir.name);
        await setWorkspace(dir.name);
        return;
      } catch { /* user cancelled */ }
    }
    setShowModal(true);
  }

  async function setWorkspace(path: string) {
    try {
      const res = await fetch("/api/workspace/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (res.ok) {
        setActive(true);
        setRootDir(path);
        await refreshTree();
      }
    } catch (e) {
      console.error("Failed to set workspace", e);
    }
  }

  async function refreshTree() {
    try {
      const res = await fetch("/api/workspace/tree");
      if (res.ok) {
        const data = await res.json();
        setFileTree(data.tree || []);
      }
    } catch (e) {
      console.error("Failed to refresh tree", e);
    }
  }

  async function readFile(path: string) {
    setSelectedFile(path);
    try {
      const res = await fetch(`/api/workspace/read?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content || "");
      } else {
        setFileContent(`// Error reading file: ${res.status}`);
      }
    } catch (e: any) {
      setFileContent(`// Error: ${e.message}`);
    }
  }

  async function writeFile(path: string, content: string) {
    try {
      await fetch("/api/workspace/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      await refreshTree();
    } catch (e) {
      console.error("Failed to write file", e);
    }
  }

  async function deleteFile(path: string) {
    try {
      await fetch("/api/workspace/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (selectedFile === path) {
        setSelectedFile("");
        setFileContent("");
      }
      await refreshTree();
    } catch (e) {
      console.error("Failed to delete file", e);
    }
  }

  const renderTree = useCallback((nodes: any[], depth = 0): React.ReactNode => {
    if (!nodes || nodes.length === 0) return null;
    return nodes.map((n) => (
      <div key={n.path}>
        <div
          onClick={() => n.type === "directory" ? null : readFile(n.path)}
          className={`flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer transition-all ${
            selectedFile === n.path ? "text-white bg-[#121824]" : "text-slate-400 hover:text-white"
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <svg className={`w-4 h-4 ${n.type === "directory" ? "text-[#00f2fe]" : "text-amber-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {n.type === "directory" ? (
              <><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><circle cx="12" cy="13" r="2"/><path d="M12 11v-2"/><path d="M10 13H8"/><path d="M16 13h-2"/></>
            ) : (
              <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></>
            )}
          </svg>
          <span>{n.name}</span>
        </div>
        {n.children && renderTree(n.children, depth + 1)}
      </div>
    ));
  }, [selectedFile]);

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Project Workspace Architecture</h2>
          <p className="text-xs text-slate-400">Map local directory trees directly for AI file system orchestration.</p>
        </div>
        <button onClick={browseFolder} className="btn-premium px-4 py-2 rounded-lg text-xs flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/><circle cx="12" cy="13" r="2"/><path d="M12 11v-2"/><path d="M10 13H8"/><path d="M16 13h-2"/>
          </svg>
          Map Directory System
        </button>
      </div>

      {!active ? (
        /* Unmapped State */
        <div className="glass-panel rounded-xl p-10 mb-6 text-center border-dashed border-slate-800">
          <svg className="w-10 h-10 text-slate-600 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
          </svg>
          <h3 className="text-sm font-bold text-white mb-1">Unmapped Workspace</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">Integrate local system pathways, allowing agents to analyze, build, test and refactor codebase systems securely.</p>
          <button onClick={browseFolder} className="bg-[#0c101c] hover:bg-[#121829] text-white border border-slate-800 px-4 py-2 rounded-lg text-xs font-semibold transition-all">
            Initialize Native Picker
          </button>
        </div>
      ) : (
        /* File Tree Structure */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1 glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Project Directory</span>
              <svg onClick={refreshTree} className="w-3.5 h-3.5 text-slate-500 hover:text-white cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </div>
            <div className="space-y-1 text-xs font-mono max-h-[60vh] overflow-y-auto">
              {fileTree.length > 0 ? renderTree(fileTree) : (
                <div className="text-slate-500 text-center py-4">Empty directory</div>
              )}
            </div>
          </div>
          <div className="col-span-2 glass-panel rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span className="text-xs font-bold text-white font-mono">{selectedFile || "No file selected"}</span>
                </div>
                {selectedFile && (
                  <span className="text-[9px] bg-emerald-950/40 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/30 font-mono">Sync Complete</span>
                )}
              </div>
              {selectedFile ? (
                <pre className="bg-[#020408] p-4 rounded-lg font-mono text-xs text-slate-300 overflow-x-auto border border-slate-900 max-h-[50vh] overflow-y-auto">
                  <code>{fileContent}</code>
                </pre>
              ) : (
                <div className="bg-[#020408] p-10 rounded-lg text-center border border-slate-900">
                  <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><circle cx="11.5" cy="12.5" r="2.5"/><path d="M13 17.5l-5 5"/><path d="M8 22.5v-5h5"/>
                  </svg>
                  <p className="text-xs text-slate-500">Select a file from the project tree to view its contents</p>
                </div>
              )}
            </div>
            {selectedFile && (
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => deleteFile(selectedFile)} className="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3.5 py-1.5 rounded text-xs transition-all">Delete</button>
                <button onClick={() => writeFile(selectedFile, fileContent)} className="btn-premium px-3.5 py-1.5 rounded text-xs">Save Changes</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-slate-800 max-w-md w-full rounded-xl overflow-hidden shadow-2xl">
            <div className="bg-[#05080f] px-4 py-3 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <svg className="w-4 h-4 text-[#00f2fe]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                <span className="text-xs font-bold tracking-wide uppercase font-mono">System Directory Picker</span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-all">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-400 mb-4">Enter a workspace target path for autonomous agent builds:</p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="/path/to/project"
                  value={rootDir}
                  onChange={(e) => setRootDir(e.target.value)}
                  className="flex-1 bg-[#020408]/60 border border-slate-800 rounded px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe] font-mono"
                />
                <button onClick={async () => { await setWorkspace(rootDir); setShowModal(false); }} className="btn-premium px-4 py-2 rounded-lg text-xs font-semibold">Set Path</button>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowModal(false)} className="bg-[#020408] hover:bg-slate-900 text-slate-400 border border-slate-850 px-4 py-2 rounded-lg text-xs font-semibold transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
