<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  let jobs = $state<any[]>([]);
  let loading = $state(true);
  let title = $state("");
  let tasksText = $state("");
  let selectedModel = $state("");
  let availableModels = $state<string[]>([]);
  let sseConnected = $state(false);
  let errorMsg = $state("");
  let creating = $state(false);

  let sse: EventSource | null = null;

  onMount(() => {
    loadJobs();
    loadModels();
    connectSSE();
  });

  onDestroy(() => {
    sse?.close();
    sse = null;
  });

  async function loadJobs() {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch("/api/worker/jobs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      jobs = data.jobs || data || [];
    } catch (e: any) {
      errorMsg = "Failed to load jobs: " + (e.message || e);
    } finally {
      loading = false;
    }
  }

  async function loadModels() {
    try {
      const res = await fetch("/v1/models");
      if (!res.ok) return;
      const data = await res.json();
      const models = data.data || data || [];
      availableModels = models.map((m: any) => m.id || m.name || m);
    } catch {
      // models are optional
    }
  }

  async function startJob() {
    if (!title.trim() || !tasksText.trim()) return;
    creating = true;
    errorMsg = "";
    try {
      const body: Record<string, any> = {
        title: title.trim(),
        tasks: tasksText.trim().split("\n").map((t) => t.trim()).filter(Boolean),
      };
      if (selectedModel) body.model = selectedModel;

      const res = await fetch("/api/worker/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      title = "";
      tasksText = "";
      selectedModel = "";
      await loadJobs();
    } catch (e: any) {
      errorMsg = "Failed to start job: " + (e.message || e);
    } finally {
      creating = false;
    }
  }

  async function cancelJob(id: string) {
    try {
      const res = await fetch(`/api/worker/jobs/${id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      await loadJobs();
    } catch (e: any) {
      errorMsg = "Failed to cancel job: " + (e.message || e);
    }
  }

  async function deleteJob(id: string) {
    try {
      const res = await fetch(`/api/worker/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await loadJobs();
    } catch (e: any) {
      errorMsg = "Failed to delete job: " + (e.message || e);
    }
  }

  function connectSSE() {
    try {
      sse = new EventSource("/api/worker/jobs/stream");
      sse.onopen = () => { sseConnected = true; };
      sse.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.jobs) jobs = data.jobs;
        } catch {
          // ignore parse errors
        }
      };
      sse.onerror = () => { sseConnected = false; };
    } catch {
      sseConnected = false;
    }
  }

  function jobStatusColor(status: string) {
    switch (status) {
      case "running": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "completed": case "done": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "failed": case "error": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "cancelled": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "pending": return "bg-slate-500/20 text-slate-400 border-slate-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  }

  function progressPercent(job: any): number {
    if (!job.tasks || job.tasks.length === 0) return job.progress || 0;
    const done = job.tasks.filter((t: any) => t.status === "completed" || t.status === "done").length;
    return Math.round((done / job.tasks.length) * 100);
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">Worker — Long-Running Tasks</h2>
      <p class="text-xs text-slate-400 mt-0.5">
        {#if sseConnected}
          <span class="text-emerald-400">● Live</span>
        {:else}
          <span class="text-slate-500">● Disconnected</span>
        {/if}
        &middot; {jobs.length} job{jobs.length !== 1 ? "s" : ""}
      </p>
    </div>
    <button class="btn-premium px-4 py-1.5 rounded-lg text-sm" onclick={() => document.getElementById("create-job-form")?.scrollIntoView({ behavior: "smooth" })}>
      + New Job
    </button>
  </div>

  {#if errorMsg}
    <div class="glass-panel rounded-xl p-3 mb-4 border border-red-500/30">
      <p class="text-xs text-red-400">{errorMsg}</p>
    </div>
  {/if}

  <!-- Create Job Form -->
  <div id="create-job-form" class="glass-panel rounded-xl p-5 mb-6">
    <h3 class="text-sm font-bold text-white mb-4">Create New Job</h3>
    <div class="space-y-3">
      <div>
        <label class="text-[11px] text-slate-400 font-medium">Job Title</label>
        <input class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1"
               placeholder="e.g. Batch article generation" bind:value={title} />
      </div>
      <div>
        <label class="text-[11px] text-slate-400 font-medium">Tasks (one per line)</label>
        <textarea class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1 resize-none font-mono"
                  rows="5" placeholder="Write an article about AI trends&#10;Translate the article to Spanish&#10;Generate social media posts" bind:value={tasksText}></textarea>
      </div>
      <div>
        <label class="text-[11px] text-slate-400 font-medium">Model (optional)</label>
        <select class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white mt-1"
                bind:value={selectedModel}>
          <option value="">Default model</option>
          {#each availableModels as model}
            <option value={model}>{model}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <button class="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-800 hover:bg-slate-900 transition-all"
              onclick={() => { title = ""; tasksText = ""; selectedModel = ""; }}>Clear</button>
      <button class="btn-premium px-4 py-1.5 rounded-lg text-xs"
              onclick={startJob} disabled={creating || !title.trim() || !tasksText.trim()}>
        {creating ? "Starting..." : "Start Job"}
      </button>
    </div>
  </div>

  <!-- Job List -->
  {#if loading}
    <div class="glass-panel rounded-xl p-8 flex items-center justify-center">
      <p class="text-sm text-slate-400">Loading jobs...</p>
    </div>
  {:else if jobs.length === 0}
    <div class="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
      <p class="text-sm text-slate-400">No jobs yet</p>
      <p class="text-xs text-slate-500">Create a job above to get started</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each jobs as job (job.id)}
        <div class="glass-panel rounded-xl p-5 transition-all hover:border-indigo-500/30">
          <div class="flex items-start justify-between mb-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-bold text-white truncate">{job.title || job.name || "Untitled"}</h3>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded border {jobStatusColor(job.status)}">
                  {job.status || "pending"}
                </span>
              </div>
              {#if job.created_at || job.createdAt}
                <p class="text-[10px] text-slate-500 mt-0.5">
                  Created {new Date(job.created_at || job.createdAt).toLocaleString()}
                </p>
              {/if}
            </div>
            <div class="flex items-center gap-1.5 shrink-0 ml-3">
              {#if job.status === "running" || job.status === "pending"}
                <button class="px-2 py-1 rounded text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                        onclick={() => cancelJob(job.id)}>Cancel</button>
              {/if}
              <button class="px-2 py-1 rounded text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                      onclick={() => deleteJob(job.id)}>Delete</button>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="mb-3">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] text-slate-500">Progress</span>
              <span class="text-[10px] text-slate-500">{progressPercent(job)}%</span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                   style="width: {progressPercent(job)}%"></div>
            </div>
          </div>

          <!-- Tasks -->
          {#if job.tasks?.length}
            <div class="space-y-1">
              {#each job.tasks as task, i}
                <div class="flex items-center gap-2 text-[10px]">
                  <span class="shrink-0 w-4 h-4 rounded-full flex items-center justify-center
                    {task.status === "completed" || task.status === "done" ? "bg-emerald-500/20 text-emerald-400" :
                     task.status === "running" ? "bg-indigo-500/20 text-indigo-400" :
                     task.status === "failed" ? "bg-red-500/20 text-red-400" :
                     "bg-slate-800 text-slate-500"}">
                    {task.status === "completed" || task.status === "done" ? "✓" :
                     task.status === "running" ? "●" :
                     task.status === "failed" ? "✗" : (i + 1)}
                  </span>
                  <span class="text-slate-400 truncate">{task.title || task.name || task.description || `Task ${i + 1}`}</span>
                  {#if task.result}
                    <span class="text-slate-500 ml-auto shrink-0">done</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <!-- Error info -->
          {#if job.error || job.error_message}
            <div class="mt-2 p-2 rounded bg-red-950/30 border border-red-900/30">
              <p class="text-[10px] text-red-400 font-mono">{job.error || job.error_message}</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
