<script lang="ts">
  let {
    name = "",
    fallback,
  }: {
    name: string;
    fallback?: any;
  } = $props();

  // Plugin slots registry — populated by plugin init scripts
  // Each plugin can register: { slot: 'sidebar-top', component: ..., order: 0 }
  interface SlotEntry {
    id: string;
    component: any;
    order: number;
  }

  let registry = $state<SlotEntry[]>([]);

  $effect(() => {
    // Check if any plugin registered for this slot
    const w = (window as any).__nova_plugin_slots;
    if (w && w[name]) {
      registry = w[name];
    }
  });
</script>

{#if registry.length > 0}
  {#each registry.sort((a, b) => a.order - b.order) as entry}
    {#each [entry.id] as _}
      {@const Comp = entry.component}
      <Comp />
    {/each}
  {/each}
{:else if fallback}
  {@render fallback()}
{/if}
