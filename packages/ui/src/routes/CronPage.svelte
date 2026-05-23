<script lang="ts">
  import { onMount } from "svelte";

  let jobs = $state<any[]>([]);
  let loading = $state(true);
  let showForm = $state(false);
  let formDescription = $state("");
  let errorMsg = $state("");

  onMount(() => {
    loadJobs();
  });

  async function loadJobs() {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch("/api/cron");
      const data = await res.json();
      jobs = data.jobs || data || [];
    } catch (e: any) {
      errorMsg = "Failed to load jobs: " + (e.message || e);
    } finally {
      loading = false;
    }
  }

  async function createJob() {
    if (!formDescription.trim()) return;
    errorMsg = "";
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formDescription.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadJobs();
      showForm = false;
      formDescription = "";
    } catch (e: any) {
      errorMsg = "Failed to create job: " + (e.message || e);
    }
  }

  async function deleteJob(id: string) {
    errorMsg = "";
    try {
      const res = await fetch("/api/cron/" + id, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await loadJobs();
    } catch (e: any) {
      errorMsg = "Failed to delete job: " + (e.message || e);
    }
  }

  function statusBadge(enabled: boolean) {
    return enabled
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
</script>

<div class="max-w-5xl mx-auto w-full">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-lg font-bold text-white">Task Scheduling (Cron)</h2>
      <p class="text-xs text-slate-400 mt-1">Use natural language to schedule recurring tasks. No cron syntax needed.</p>
    </div>
    <button class="btn-premium px-4 py-1.5 rounded-lg text-sm flex items-center gap-2" onclick={() => { showForm = !showForm; }}>
      <i data-lucide="plus" class="w-4 h-4"></i>
      {showForm ? "Cancel" : "New Cron Job"}
    </button>
  </div>

  {#if errorMsg}
    <div class="glass-panel rounded-xl p-4 mb-6 border border-red-500/30">
      <p class="text-xs text-red-400">{errorMsg}</p>
    </div>
  {/if}

  <!-- NL Schedule Examples -->
  <div class="glass-panel rounded-xl p-4 mb-6 border border-slate-800">
    <p class="text-[10px] text-slate-500 mb-2">Schedule examples (just describe what and when):</p>
    <div class="flex flex-wrap gap-3">
      <button class="text-[10px] bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1 text-slate-400 hover:border-[#00f2fe]/40 hover:text-slate-200 transition-all"
              onclick={() => { formDescription = "check weather every day at 8am"; showForm = true; }}>
        🌤 check weather every day at 8am
      </button>
      <button class="text-[10px] bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1 text-slate-400 hover:border-[#00f2fe]/40 hover:text-slate-200 transition-all"
              onclick={() => { formDescription = "summarize news every 6 hours"; showForm = true; }}>
        📰 summarize news every 6 hours
      </button>
      <button class="text-[10px] bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1 text-slate-400 hover:border-[#00f2fe]/40 hover:text-slate-200 transition-all"
              onclick={() => { formDescription = "run system healthcheck every 30 minutes"; showForm = true; }}>
        🩺 run system healthcheck every 30 minutes
      </button>
      <button class="text-[10px] bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1 text-slate-400 hover:border-[#00f2fe]/40 hover:text-slate-200 transition-all"
              onclick={() => { formDescription = "send crypto digest daily at 9am"; showForm = true; }}>
        💰 send crypto digest daily at 9am
      </button>
    </div>
  </div>

  {#if loading}
    <div class="glass-panel rounded-xl p-8 flex items-center justify-center">
      <div class="flex items-center gap-3">
        <span class="w-4 h-4 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin"></span>
        <span class="text-xs text-slate-400">Loading jobs...</span>
      </div>
    </div>
  {:else if jobs.length === 0}
    <div class="glass-panel rounded-xl p-12 text-center">
      <i data-lucide="calendar" class="w-10 h-10 text-slate-600 mx-auto mb-3"></i>
      <p class="text-sm text-slate-400">No scheduled tasks yet.</p>
      <p class="text-[11px] text-slate-500 mt-1">Create one using natural language — no cron syntax required.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-3">
      {#each jobs as job}
        <div class="glass-panel rounded-xl p-4 flex items-center justify-between transition-all hover:border-slate-700/40">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs text-white font-medium">{job.description}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded {statusBadge(job.enabled)}">
                {job.enabled ? "active" : "paused"}
              </span>
            </div>
            <div class="flex items-center gap-4 text-[10px] text-slate-500">
              <span class="font-mono">{job.schedule}</span>
              <span>Next: {new Date(job.nextRun).toLocaleString()}</span>
              {#if job.lastRun}
                <span>Last: {new Date(job.lastRun).toLocaleString()}</span>
              {:else}
                <span>Last: never</span>
              {/if}
            </div>
          </div>
          <button class="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-3 py-1 rounded text-[10px] transition-all ml-4 shrink-0"
                  onclick={() => deleteJob(job.id)}>
            Delete
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Create Form -->
  {#if showForm}
    <div class="glass-panel rounded-xl p-5 mt-6 border border-[#00f2fe]/20">
      <div class="space-y-4">
        <div>
          <label class="text-[11px] text-slate-400 font-medium">Describe your recurring task</label>
          <textarea
            class="w-full px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-white placeholder-slate-500 mt-1 resize-none"
            rows="2"
            placeholder="e.g. check weather every day at 8am, summarize news every 6 hours"
            bind:value={formDescription}
          ></textarea>
          <p class="text-[10px] text-slate-500 mt-1">
            Supported patterns: "every 30 minutes", "every 6 hours", "daily at 9am", "every day at 14:00"
          </p>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button
          class="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-800 hover:bg-slate-900 transition-all"
          onclick={() => showForm = false}
        >Cancel</button>
        <button
          class="btn-premium px-3 py-1.5 rounded-lg text-xs"
          onclick={createJob}
          disabled={!formDescription.trim()}
        >Create</button>
      </div>
    </div>
  {/if}
</div>
