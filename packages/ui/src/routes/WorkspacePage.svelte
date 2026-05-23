<script lang="ts">
  import { onMount } from "svelte";

  let rootDir = $state("");
  let folders = $state<string[]>([]);
  let files = $state<string[]>([]);
  let active = $state(false);
  let loading = $state(true);
  let fileTree = $state<any[]>([]);
  let selectedFile = $state("");
  let fileContent = $state("");
  let showModal = $state(false);

  onMount(() => {
    loadWorkspace();
  });

  async function loadWorkspace() {
    loading = true;
    try {
      const res = await fetch("/api/workspace/status");
      if (res.ok) {
        const data = await res.json();
        if (data.rootDir) {
          rootDir = data.rootDir;
          active = true;
          fileTree = data.tree || [];
        }
      }
    } catch (e) {
      console.error("Failed to load workspace", e);
    } finally {
      loading = false;
    }
  }

  async function browseFolder() {
    if ("showDirectoryPicker" in window) {
      try {
        const dir = await (window as any).showDirectoryPicker();
        rootDir = dir.name;
        await setWorkspace(dir.name);
        return;
      } catch {}
    }
    showModal = true;
  }

  async function setWorkspace(path: string) {
    try {
      const res = await fetch("/api/workspace/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (res.ok) {
        active = true;
        rootDir = path;
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
        fileTree = data.tree || [];
      }
    } catch (e) {
      console.error("Failed to refresh tree", e);
    }
  }

  async function readFile(path: string) {
    selectedFile = path;
    try {
      const res = await fetch(`/api/workspace/read?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        fileContent = data.content || "";
      } else {
        fileContent = `// Error reading file: ${res.status}`;
      }
    } catch (e: any) {
      fileContent = `// Error: ${e.message}`;
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

  async function createFolder(path: string) {
    try {
      await fetch("/api/workspace/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      await refreshTree();
    } catch (e) {
      console.error("Failed to create folder", e);
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
        selectedFile = "";
        fileContent = "";
      }
      await refreshTree();
    } catch (e) {
      console.error("Failed to delete file", e);
    }
  }

  function closeModal() { showModal = false; }

  function renderTree(nodes: any[], depth = 0): string {
    if (!nodes || nodes.length === 0) return "";
    return nodes.map((n) => {
      const indent = "  ".repeat(depth);
      const icon = n.type === "directory" ? "folder" : "file-code";
      const color = n.type === "directory" ? "text-[#00f2fe]" : "text-amber-500";
      const isSelected = selectedFile === n.path;
      return `<div class="flex items-center gap-2 ${isSelected ? 'text-white bg-[#121824] rounded' : 'text-slate-400 hover:text-white'} cursor-pointer px-2 py-0.5 transition-all" onclick="window.__novaSelectFile?.('${n.path.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}')" style="padding-left: ${12 + depth * 16}px">
        <i data-lucide="${icon}" class="w-4 h-4 ${color}"></i>
        <span>${n.name}</span>
      </div>` + (n.children ? renderTree(n.children, depth + 1) : "");
    }).join("");
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">Project Workspace Architecture</h2>
      <p class="text-xs text-slate-400">Map local directory trees directly for AI file system orchestration.</p>
    </div>
    <button onclick={browseFolder} class="btn-premium px-4 py-2 rounded-lg text-xs flex items-center gap-2">
      <i data-lucide="folder-search" class="w-4 h-4"></i>
      Map Directory System
    </button>
  </div>

  {#if !active}
    <!-- Unmapped State -->
    <div class="glass-panel rounded-xl p-10 mb-6 text-center border-dashed border-slate-800">
      <i data-lucide="folder-git2" class="w-10 h-10 text-slate-600 mx-auto mb-4"></i>
      <h3 class="text-sm font-bold text-white mb-1">Unmapped Workspace</h3>
      <p class="text-xs text-slate-500 max-w-sm mx-auto mb-4">Integrate local system pathways, allowing agents to analyze, build, test and refactor codebase systems securely.</p>
      <button onclick={browseFolder} class="bg-[#0c101c] hover:bg-[#121829] text-white border border-slate-800 px-4 py-2 rounded-lg text-xs font-semibold transition-all">
        Initialize Native Picker
      </button>
    </div>
  {:else}
    <!-- File Tree Structure -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="col-span-1 glass-panel rounded-xl p-4">
        <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Project Directory</span>
          <i data-lucide="refresh-cw" onclick={refreshTree} class="w-3.5 h-3.5 text-slate-500 hover:text-white cursor-pointer"></i>
        </div>
        <div class="space-y-1 text-xs font-mono max-h-[60vh] overflow-y-auto">
          {#if fileTree.length > 0}
            {#each fileTree as item}
              <div>
                <div
                  onclick={() => item.type === "directory" ? null : readFile(item.path)}
                  class="flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer transition-all {selectedFile === item.path ? 'text-white bg-[#121824]' : 'text-slate-400 hover:text-white'}"
                >
                  <i data-lucide={item.type === "directory" ? "folder" : "file-code"} class="w-4 h-4 {item.type === 'directory' ? 'text-[#00f2fe]' : 'text-amber-500'}"></i>
                  <span>{item.name}</span>
                </div>
                {#if item.children && item.children.length > 0}
                  {#each item.children as child}
                    <div
                      onclick={() => child.type === "directory" ? null : readFile(child.path)}
                      class="flex items-center gap-2 pl-6 px-2 py-0.5 rounded cursor-pointer transition-all {selectedFile === child.path ? 'text-white bg-[#121824]' : 'text-slate-400 hover:text-white'}"
                    >
                      <i data-lucide={child.type === "directory" ? "folder" : "file-code"} class="w-4 h-4 {child.type === 'directory' ? 'text-[#00f2fe]' : 'text-amber-500'}"></i>
                      <span>{child.name}</span>
                    </div>
                    {#if child.children && child.children.length > 0}
                      {#each child.children as grandchild}
                        <div
                          onclick={() => grandchild.type === "directory" ? null : readFile(grandchild.path)}
                          class="flex items-center gap-2 pl-10 px-2 py-0.5 rounded cursor-pointer transition-all {selectedFile === grandchild.path ? 'text-white bg-[#121824]' : 'text-slate-400 hover:text-white'}"
                        >
                          <i data-lucide={grandchild.type === "directory" ? "folder" : "file-code"} class="w-4 h-4 {grandchild.type === 'directory' ? 'text-[#00f2fe]' : 'text-amber-500'}"></i>
                          <span>{grandchild.name}</span>
                        </div>
                      {/each}
                    {/if}
                  {/each}
                {/if}
              </div>
            {/each}
          {:else}
            <div class="text-slate-500 text-center py-4">Empty directory</div>
          {/if}
        </div>
      </div>
      <div class="col-span-2 glass-panel rounded-xl p-6 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <i data-lucide="file-code" class="w-5 h-5 text-amber-500"></i>
              <span class="text-xs font-bold text-white font-mono">{selectedFile || "No file selected"}</span>
            </div>
            {#if selectedFile}
              <span class="text-[9px] bg-emerald-950/40 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/30 font-mono">Sync Complete</span>
            {/if}
          </div>
          {#if selectedFile}
            <pre class="bg-[#020408] p-4 rounded-lg font-mono text-xs text-slate-300 overflow-x-auto border border-slate-900 max-h-[50vh] overflow-y-auto"><code>{fileContent}</code></pre>
          {:else}
            <div class="bg-[#020408] p-10 rounded-lg text-center border border-slate-900">
              <i data-lucide="file-search" class="w-8 h-8 text-slate-600 mx-auto mb-2"></i>
              <p class="text-xs text-slate-500">Select a file from the project tree to view its contents</p>
            </div>
          {/if}
        </div>
        {#if selectedFile}
          <div class="flex justify-end gap-3 mt-4">
            <button onclick={() => deleteFile(selectedFile)} class="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3.5 py-1.5 rounded text-xs transition-all">Delete</button>
            <button onclick={() => writeFile(selectedFile, fileContent)} class="btn-premium px-3.5 py-1.5 rounded text-xs">Save Changes</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Modal -->
{#if showModal}
  <div class="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-[#0b0f19] border border-slate-800 max-w-md w-full rounded-xl overflow-hidden shadow-2xl">
      <div class="bg-[#05080f] px-4 py-3 border-b border-slate-850 flex items-center justify-between">
        <div class="flex items-center gap-2 text-white">
          <i data-lucide="monitor" class="w-4 h-4 text-[#00f2fe]"></i>
          <span class="text-xs font-bold tracking-wide uppercase font-mono">System Directory Picker</span>
        </div>
        <button onclick={closeModal} class="text-slate-500 hover:text-white transition-all"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>
      <div class="p-6">
        <p class="text-xs text-slate-400 mb-4">Enter a workspace target path for autonomous agent builds:</p>
        <div class="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="/path/to/project"
            bind:value={rootDir}
            class="flex-1 bg-[#020408]/60 border border-slate-800 rounded px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe] font-mono"
          />
          <button onclick={async () => { await setWorkspace(rootDir); closeModal(); }} class="btn-premium px-4 py-2 rounded-lg text-xs font-semibold">Set Path</button>
        </div>
        <div class="flex justify-end gap-2">
          <button onclick={closeModal} class="bg-[#020408] hover:bg-slate-900 text-slate-400 border border-slate-850 px-4 py-2 rounded-lg text-xs font-semibold transition-all">Cancel</button>
        </div>
      </div>
    </div>
  </div>
{/if}
