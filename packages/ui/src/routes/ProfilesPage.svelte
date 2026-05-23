<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api.ts";

  let agents = $state<any[]>([]);
  let loading = $state(true);

  onMount(() => {
    api.agents()
      .then((a: any[]) => { agents = a; })
      .catch(() => {})
      .finally(() => { loading = false; });
  });

  function statusBadge(status: string) {
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
  <div class="mb-6">
    <h2 class="text-lg font-bold text-white">Agent Profiles</h2>
    <p class="text-xs text-slate-400 mt-0.5">Configure base personalities, memory settings, and agent-specific model routing.</p>
  </div>

  {#if loading}
    <div class="glass-panel rounded-xl p-8 flex items-center justify-center">
      <p class="text-sm text-slate-400">Loading agent profiles...</p>
    </div>
  {:else if agents.length === 0}
    <div class="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-2">
      <p class="text-sm text-slate-400">No agent profiles yet</p>
      <p class="text-xs text-slate-500">Create agents in the Agents page to see their profiles here</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each agents as agent (agent.id)}
        <div class="glass-panel rounded-xl p-5 flex flex-col transition-all hover:border-indigo-500/30">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center text-lg">
                {agent.emoji || "🤖"}
              </div>
              <div>
                <h3 class="text-sm font-bold text-white">{agent.name}</h3>
                {#if agent.model}
                  <p class="text-[10px] text-slate-500 mt-0.5 font-mono">{agent.model}</p>
                {/if}
              </div>
            </div>
            {#if agent.status}
              <span class="text-[9px] font-bold px-2 py-0.5 rounded border {statusBadge(agent.status)}">
                {agent.status}
              </span>
            {/if}
          </div>

          {#if agent.description}
            <p class="text-xs text-slate-400 leading-relaxed mb-3">{agent.description}</p>
          {/if}

          {#if agent.skills?.length}
            <div class="flex flex-wrap gap-1 mt-auto pt-3 border-t border-slate-800">
              {#each agent.skills as skill}
                <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{skill}</span>
              {/each}
            </div>
          {/if}

          {#if agent.systemPrompt}
            <div class="mt-3 pt-3 border-t border-slate-800">
              <p class="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">System Prompt</p>
              <p class="text-[10px] text-slate-500 font-mono line-clamp-3">{agent.systemPrompt}</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
