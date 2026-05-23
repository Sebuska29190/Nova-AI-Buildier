<script lang="ts">
  import { api } from "../lib/api.ts";
  import { onMount } from "svelte";

  let agents = $state<any[]>([]);
  let loading = $state(false);
  let creating = $state(false);
  let selectedAgent = $state<any>(null);
  let showForm = $state(false);
  let formName = $state("");
  let formDescription = $state("");
  let formModel = $state("deepseek/deepseek-chat");
  let formSkills = $state("");
  let formPrompt = $state("");
  let availableModels = $state<string[]>([]);
  let taskResult = $state("");
  let showTaskModal = $state(false);
  let taskInput = $state("");
  let taskModel = $state("");
  let taskRunning = $state(false);
  let workspacePath = $state("");
  let enabledSkills = $state<string[]>([]);
  let thinkingLevel = $state("medium");
  let showAgentModal = $state(false);
  let agentModalTab = $state<"task" | "config">("task");
  let browsingFolder = $state(false);
  let wsConnected = $state(false);
  let agentLog = $state<string[]>([]);
  let errorMsg = $state("");

  let socket: WebSocket | null = null;

  onMount(() => {
    loadAgents();
    api.models().then((m: any[]) => {
      availableModels = m.map((x: any) => x.id || x.name || x);
    }).catch(() => {});
    connectSSE();
  });

  async function loadAgents() {
    loading = true;
    try {
      agents = await api.agents();
    } catch (e: any) {
      errorMsg = "Failed to load agents: " + (e.message || e);
    } finally {
      loading = false;
    }
  }

  async function createAgent() {
    if (!formName.trim()) return;
    creating = true;
    try {
      const res = await fetch("http://localhost:4123/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim(),
          model: formModel,
          skills: formSkills.split(",").map(s => s.trim()).filter(Boolean),
          systemPrompt: formPrompt.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAgents();
      showForm = false;
      formName = "";
      formDescription = "";
      formModel = "deepseek/deepseek-chat";
      formSkills = "";
      formPrompt = "";
    } catch (e: any) {
      errorMsg = "Failed to create agent: " + (e.message || e);
    } finally {
      creating = false;
    }
  }

  async function deleteAgent(id: string) {
    try {
      await fetch("http://localhost:4123/api/agents/" + id, { method: "DELETE" });
      if (selectedAgent?.id === id) selectedAgent = null;
      await loadAgents();
    } catch (e: any) {
      errorMsg = "Failed to delete agent: " + (e.message || e);
    }
  }

  async function startAgent(id: string) {
    try {
      await fetch("http://localhost:4123/api/agents/" + id + "/start", { method: "POST" });
      await loadAgents();
    } catch (e: any) {
      errorMsg = "Failed to start agent: " + (e.message || e);
    }
  }

  async function stopAgent(id: string) {
    try {
      await fetch("http://localhost:4123/api/agents/" + id + "/stop", { method: "POST" });
      await loadAgents();
    } catch (e: any) {
      errorMsg = "Failed to stop agent: " + (e.message || e);
    }
  }

  async function runAgentTask(agentId: string, task: string) {
    taskRunning = true;
    taskResult = "";
    try {
      const res = await fetch(`/api/agents/${agentId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          workspace: workspacePath || undefined,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(res.status + ": " + errText);
      }
      const data = await res.json();
      taskResult = `✅ Agent started in background (runId: ${data.runId || "n/a"})`;
      // Zamykamy modal — agent działa w tle
      setTimeout(() => { showAgentModal = false; }, 1500);
    } catch (e: any) {
      taskResult = "Error: " + (e.message || e);
    } finally {
      taskRunning = false;
    }
  }

  async function toggleAgent(id: string) {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;
    if (agent.status === "running") await stopAgent(id);
    else await startAgent(id);
  }

  function connectSSE() {
    try {
      socket = new WebSocket("ws://localhost:4123/ws");
      socket.onopen = () => { wsConnected = true; };
      socket.onmessage = (ev) => {
        agentLog.push(ev.data);
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "job_done") {
            // Odśwież listę agentów by zobaczyć "ready" zamiast "active"
            loadAgents();
            // Pokaż notyfikację jeśli agent jest podglądany
            if (selectedAgent?.id === data.agentId) {
              taskResult = data.status === "completed"
                ? "✅ Agent completed the task. Check MEMORY.md for report."
                : "❌ Agent task failed" + (data.error ? ": " + data.error : "");
            }
          }
        } catch {}
      };
      socket.onclose = () => { wsConnected = false; };
      socket.onerror = () => { wsConnected = false; };
    } catch {
      wsConnected = false;
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case "running": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "idle": return "bg-slate-500/20 text-slate-400 border-slate-500/30";
      case "error": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "stopped": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">Agents</h2>
      <p class="text-xs text-slate-400 mt-0.5">
        {#if wsConnected}
          <span class="text-emerald-400">● Connected</span>
        {:else}
          <span class="text-slate-500">● Disconnected</span>
        {/if}
        &middot; {agents.length} agent{agents.length !== 1 ? "s" : ""}
      </p>
    </div>
    <button class="btn-premium px-4 py-1.5 rounded-lg text-sm" onclick={() => showForm = true}>
      + Create Agent
    </button>
  </div>

  {#if errorMsg}
    <div class="glass-panel rounded-xl p-3 mb-4 border border-red-500/30">
      <p class="text-xs text-red-400">{errorMsg}</p>
    </div>
  {/if}

  {#if loading}
    <div class="glass-panel rounded-xl p-8 flex items-center justify-center">
      <p class="text-sm text-slate-400">Loading agents...</p>
    </div>
  {:else if agents.length === 0}
    <div class="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
      <p class="text-sm text-slate-400">No agents yet</p>
      <p class="text-xs text-slate-500">Create your first agent to get started</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each agents as agent (agent.id)}
        <div class="glass-panel rounded-xl p-5 flex flex-col justify-between transition-all hover:border-indigo-500/30 cursor-pointer"
             onclick={() => selectedAgent = selectedAgent?.id === agent.id ? null : agent}>
          <div>
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center text-sm">
                  {agent.emoji || "🤖"}
                </div>
                <h3 class="font-bold text-sm text-white">{agent.name}</h3>
              </div>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full border {statusColor(agent.status)}">
                {agent.status || "unknown"}
              </span>
            </div>
            {#if agent.description}
              <p class="text-xs text-slate-400 mb-3 line-clamp-2">{agent.description}</p>
            {/if}
            <div class="flex flex-wrap gap-1.5 mb-3">
              <span class="text-[10px] font-mono text-slate-500">{agent.model || "default"}</span>
              {#if agent.skills?.length}
                {#each agent.skills as skill}
                  <span class="custom-badge text-[10px]">{skill}</span>
                {/each}
              {/if}
            </div>
          </div>
          <div class="flex items-center gap-2 border-t border-slate-800 pt-3 mt-1">
            <button class="text-[11px] px-2.5 py-1 rounded bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-400 border border-indigo-900/30 transition-all"
                    onclick={() => toggleAgent(agent.id)}>
              {agent.status === "running" ? "Stop" : "Start"}
            </button>
            <button class="text-[11px] px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 transition-all"
                    onclick={() => { 
                      selectedAgent = agent; 
                      showAgentModal = true; 
                      taskModel = agent.modelRef || ""; 
                      taskInput = ""; 
                      taskResult = ""; 
                      workspacePath = agent.workspace || ""; 
                      enabledSkills = [...(agent.skills || [])]; 
                      thinkingLevel = agent.thinkingLevel || "medium"; 
                    }}>
              Run Task
            </button>
            <button class="text-[11px] px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/30 transition-all"
                    onclick={() => window.open("/agents/" + agent.id, "_blank")}>
              Browser
            </button>
            <button class="text-[11px] px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 transition-all ml-auto"
                    onclick={() => deleteAgent(agent.id)}>
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if selectedAgent}
    <div class="glass-panel rounded-xl p-5 mt-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-sm text-white">{selectedAgent.emoji || "🤖"} {selectedAgent.name}</h3>
        <button class="text-xs text-slate-500 hover:text-white transition-colors" onclick={() => selectedAgent = null}>✕</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-xs text-slate-400 mb-1"><span class="text-slate-500">ID:</span> {selectedAgent.id}</p>
          <p class="text-xs text-slate-400 mb-1"><span class="text-slate-500">Model:</span> {selectedAgent.model || "default"}</p>
          <p class="text-xs text-slate-400 mb-1"><span class="text-slate-500">Status:</span> {selectedAgent.status}</p>
          {#if selectedAgent.description}
            <p class="text-xs text-slate-400 mb-1"><span class="text-slate-500">Description:</span> {selectedAgent.description}</p>
          {/if}
          {#if selectedAgent.systemPrompt}
            <div class="mt-2">
              <p class="text-xs text-slate-500 mb-1">System Prompt:</p>
              <pre class="text-[11px] text-slate-400 bg-slate-900/50 rounded-lg p-3 overflow-x-auto">{selectedAgent.systemPrompt}</pre>
            </div>
          {/if}
        </div>
        <div class="flex flex-col gap-2">
          <button class="btn-premium px-3 py-1.5 rounded-lg text-xs text-center"
                  onclick={() => { showAgentModal = true; }}>
            Run Task
          </button>
          <button class="text-[11px] px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/30 transition-all text-center"
                  onclick={() => window.open("/agents/" + selectedAgent.id, "_blank")}>
            Open Browser
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if agentLog.length > 0}
    <div class="glass-panel rounded-xl p-5 mt-4">
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-xs font-bold text-white">Agent Log</h4>
        <button class="text-[10px] text-slate-500 hover:text-white" onclick={() => agentLog = []}>Clear</button>
      </div>
      <div class="max-h-48 overflow-y-auto space-y-1">
        {#each agentLog as entry}
          <p class="text-[11px] text-slate-400 font-mono">{entry}</p>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Agent Modal -->
{#if showAgentModal && selectedAgent}
<div class="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div class="bg-[#0b0f19] border border-slate-800 max-w-2xl w-full rounded-xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
    <!-- Header -->
    <div class="bg-[#05080f] px-4 py-3 border-b border-slate-850 flex items-center justify-between sticky top-0 z-10">
      <div class="flex items-center gap-2 text-white">
        <span class="text-lg">{selectedAgent.emoji || "🤖"}</span>
        <span class="text-xs font-bold tracking-wide uppercase font-mono">{selectedAgent.name}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full {selectedAgent.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'} border {selectedAgent.status === 'ready' ? 'border-emerald-500/30' : 'border-amber-500/30'}">{selectedAgent.status}</span>
      </div>
      <button onclick={() => showAgentModal = false} class="text-slate-500 hover:text-white"><i data-lucide="x" class="w-4 h-4"></i></button>
    </div>
    <!-- Skills bar -->
    <div class="px-4 py-2 bg-[#020408]/40 border-b border-slate-850 flex flex-wrap gap-1.5 items-center">
      <span class="text-[9px] text-slate-500 uppercase tracking-wider mr-1">Skills:</span>
      {#each selectedAgent.skills || [] as skill}
        <span class="custom-badge text-[10px]">{skill}</span>
      {/each}
      <span class="text-[10px] text-slate-600 ml-auto font-mono">{selectedAgent.model}</span>
    </div>
    <!-- Body -->
    <div class="p-5 space-y-4">
      <!-- Task / Prompt -->
      <div>
        <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
          <i data-lucide="message-square" class="w-3 h-3"></i> Task / Prompt
        </label>
        <textarea
          bind:value={taskInput}
          placeholder="e.g. analyze project structure, fix all eslint errors, build test suite for all components..."
          class="w-full bg-[#020408]/60 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe] min-h-[80px]"
        ></textarea>
      </div>
      <!-- Workspace -->
      <div>
        <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
          <i data-lucide="folder" class="w-3 h-3"></i> Workspace Folder
        </label>
        <div class="flex gap-2">
          <input
            bind:value={workspacePath}
            placeholder="e.g. C:\Projects\my-app"
            class="flex-1 bg-[#020408]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#00f2fe] font-mono"
          />
          <button
            onclick={async () => {
              browsingFolder = true;
              try {
                const res = await fetch("/api/workspace/browse", { method: "POST" });
                if (res.ok) {
                  const data = await res.json();
                  if (data?.path) workspacePath = data.path;
                }
              } catch {}
              browsingFolder = false;
            }}
            disabled={browsingFolder}
            class="bg-[#020408] hover:bg-slate-900 text-slate-400 border border-slate-800 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5"
          >
            {#if browsingFolder}
              <span class="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
            {:else}
              <i data-lucide="search" class="w-3.5 h-3.5"></i>
            {/if}
            Browse...
          </button>
        </div>
        {#if workspacePath}
          <p class="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
            <i data-lucide="check-circle" class="w-3 h-3"></i> Workspace selected
          </p>
        {/if}
      </div>
      <!-- Skills to enable -->
      <div>
        <label class="text-[9px] text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
          <i data-lucide="zap" class="w-3 h-3"></i> Skills to enable for this task
        </label>
        <div class="flex flex-wrap gap-1.5">
          {#each selectedAgent.skills || [] as skill}
            <button
              onclick={() => {
                if (enabledSkills.includes(skill)) enabledSkills = enabledSkills.filter(s => s !== skill);
                else enabledSkills = [...enabledSkills, skill];
              }}
              class="px-2.5 py-1 text-[10px] rounded-lg border transition-all {enabledSkills.includes(skill) ? 'border-[#00f2fe] text-white bg-[#00f2fe]/10' : 'border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'}"
            >{enabledSkills.includes(skill) ? '✓' : '+'} {skill}</button>
          {/each}
          {#if (selectedAgent.skills || []).length === 0}
            <span class="text-[10px] text-slate-600 italic">No skills assigned to this agent</span>
          {/if}
        </div>
      </div>
      <!-- Advanced: Model + Thinking -->
      <details class="group">
        <summary class="text-[9px] text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 flex items-center gap-1.5">
          <i data-lucide="settings" class="w-3 h-3"></i> Advanced Settings
        </summary>
        <div class="mt-2 space-y-2 pl-2">
          <div class="flex items-center gap-3">
            <label class="text-[10px] text-slate-500 w-16">Model:</label>
            <select bind:value={taskModel} class="flex-1 bg-[#020408]/60 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
              <option value="">Default ({selectedAgent.model})</option>
              {#each availableModels as m}
                <option value={m.id}>{m.id}</option>
              {/each}
            </select>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-[10px] text-slate-500 w-16">Thinking:</label>
            <select bind:value={thinkingLevel} class="flex-1 bg-[#020408]/60 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </details>
      <!-- Buttons -->
      <div class="flex justify-between items-center pt-2 border-t border-slate-800">
        <div class="flex gap-2">
          <button onclick={() => showAgentModal = false} class="bg-[#020408] hover:bg-slate-900 text-slate-400 border border-slate-850 px-4 py-2 rounded-lg text-xs font-semibold">Cancel</button>
          {#if taskResult}
            <button onclick={() => taskResult = ""} class="text-[10px] text-slate-500 hover:text-white underline">Clear result</button>
          {/if}
        </div>
        <button
          onclick={async () => {
            await runAgentTask(selectedAgent.id, taskInput);
          }}
          disabled={taskRunning || !taskInput.trim()}
          class="btn-premium px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
        >
          {#if taskRunning}
            <span class="w-3.5 h-3.5 border-2 border-[#020408] border-t-transparent rounded-full animate-spin"></span>
            Running task...
          {:else}
            <i data-lucide="play" class="w-3.5 h-3.5"></i>
            Execute Task
          {/if}
        </button>
      </div>
      <!-- Result -->
      {#if taskResult}
        <div class="border-t border-slate-800 pt-3 mt-1">
          <p class="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <i data-lucide="terminal" class="w-3 h-3"></i> Result
          </p>
          <pre class="text-[11px] text-slate-300 bg-[#020408]/80 rounded-lg p-3 max-h-40 overflow-y-auto font-mono whitespace-pre-wrap">{taskResult}</pre>
        </div>
      {/if}
    </div>
  </div>
</div>
{/if}

{#if showForm}
  <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onclick={() => showForm = false}>
    <div class="glass-panel rounded-xl p-6 w-full max-w-md mx-4" onclick={(e) => e.stopPropagation()}>
      <h3 class="font-bold text-sm text-white mb-4">Create Agent</h3>
      <div class="space-y-3">
        <div>
          <label class="text-[11px] text-slate-400 font-medium">Name</label>
          <input class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1"
                 placeholder="My Agent" bind:value={formName} />
        </div>
        <div>
          <label class="text-[11px] text-slate-400 font-medium">Description</label>
          <textarea class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1 resize-none"
                    rows="2" placeholder="What does this agent do?" bind:value={formDescription}></textarea>
        </div>
        <div>
          <label class="text-[11px] text-slate-400 font-medium">Model</label>
          <select class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white mt-1"
                  bind:value={formModel}>
            {#each availableModels as model}
              <option value={model}>{model}</option>
            {/each}
            <option value="deepseek/deepseek-chat">deepseek/deepseek-chat</option>
          </select>
        </div>
        <div>
          <label class="text-[11px] text-slate-400 font-medium">Skills (comma separated)</label>
          <input class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1"
                 placeholder="code, research, writing" bind:value={formSkills} />
        </div>
        <div>
          <label class="text-[11px] text-slate-400 font-medium">System Prompt</label>
          <textarea class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1 resize-none font-mono"
                    rows="4" placeholder="You are an agent that..." bind:value={formPrompt}></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button class="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-800 hover:bg-slate-900 transition-all"
                onclick={() => showForm = false}>Cancel</button>
        <button class="btn-premium px-3 py-1.5 rounded-lg text-xs"
                onclick={createAgent} disabled={creating || !formName.trim()}>
          {creating ? "Creating..." : "Create"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Parallel Workers Panel -->
<div class="glass-panel rounded-xl p-5 mt-6 border border-indigo-500/10">
  <div class="flex items-center gap-2 mb-3">
    <i data-lucide="git-branch" class="w-4 h-4 text-indigo-400"></i>
    <span class="text-sm text-white font-medium">Parallel Workers</span>
    <span class="text-[10px] text-slate-500">— spawn multiple sub-agents at once</span>
  </div>
  <p class="text-[10px] text-slate-500 mb-4">Each worker runs the same system prompt on a different subtask. Results are merged automatically.</p>

  <div class="space-y-3">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label class="text-[10px] text-slate-500">Task 1</label>
        <input id="ptask1" class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-600 mt-1"
               placeholder="e.g. Research React 19 features" />
      </div>
      <div>
        <label class="text-[10px] text-slate-500">Task 2</label>
        <input id="ptask2" class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-600 mt-1"
               placeholder="e.g. Research Vue 4 features" />
      </div>
      <div>
        <label class="text-[10px] text-slate-500">Task 3</label>
        <input id="ptask3" class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-600 mt-1"
               placeholder="e.g. Research Svelte 5 features" />
      </div>
      <div>
        <label class="text-[10px] text-slate-500">Task 4</label>
        <input id="ptask4" class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-600 mt-1"
               placeholder="e.g. Research Angular 18 features" />
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <label class="text-[10px] text-slate-500">Worker Group Name</label>
        <input id="pname" class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-600 mt-1"
               placeholder="research-team" />
      </div>
      <div>
        <label class="text-[10px] text-slate-500">System Prompt</label>
        <textarea id="pprompt" class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-600 mt-1 resize-none"
                  rows="1" placeholder="You are a researcher..."></textarea>
      </div>
      <div class="flex items-end">
        <button id="parallel-submit-btn" class="btn-premium px-4 py-1.5 rounded-lg text-xs w-full"
                onclick={() => {
                  const tasks = [];
                  for (let i = 1; i <= 4; i++) {
                    const el = document.getElementById('ptask' + i) as HTMLInputElement;
                    if (el?.value?.trim()) tasks.push(el.value.trim());
                  }
                  const name = (document.getElementById('pname') as HTMLInputElement)?.value?.trim() || 'parallel';
                  const prompt = (document.getElementById('pprompt') as HTMLTextAreaElement)?.value?.trim() || 'You are a helpful assistant.';
                  if (tasks.length === 0) return;
                  const btn = document.getElementById('parallel-submit-btn') as HTMLButtonElement;
                  btn.disabled = true;
                  btn.textContent = 'Running...';
                  fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      messages: [{ role: 'user', content: `spawn_parallel name="${name}" systemPrompt="${prompt}" tasks=${JSON.stringify(tasks)} merge=true` }],
                      model: 'deepseek/deepseek-chat',
                      tools: ['spawn_parallel'],
                    }),
                  }).then(() => {
                    btn.disabled = false;
                    btn.textContent = 'Run Parallel Workers';
                  }).catch(() => {
                    btn.disabled = false;
                    btn.textContent = 'Run Parallel Workers';
                  });
                }}>
          Run Parallel Workers
        </button>
      </div>
    </div>
  </div>
</div>

