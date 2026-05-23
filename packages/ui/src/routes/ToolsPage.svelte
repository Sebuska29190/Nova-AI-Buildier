<script lang="ts">
  import PageTemplate from "../lib/components/PageTemplate.svelte";
  import Card from "../lib/components/ui/Card.svelte";
  import Button from "../lib/components/ui/Button.svelte";
  import Badge from "../lib/components/ui/Badge.svelte";
  import { api } from "../lib/api.ts";

  let tools = $state<any[]>([]);
  let loading = $state(true);

  async function load() {
    loading = true;
    try { tools = await api.tools(); } catch {}
    loading = false;
  }
  $effect(() => { load(); });
</script>

<PageTemplate title="Tools" subtitle="Registered tools available to agents" icon="🔧" loading={loading}>
  {#snippet actions()}
    <Button variant="secondary" size="sm" onclick={load}>Refresh</Button>
  {/snippet}

  {#if tools.length === 0}
    <div class="empty">
      <div class="empty-icon">🔧</div>
      <p>No tools registered</p>
    </div>
  {:else}
    <div class="tool-grid">
      {#each tools as tool}
        <Card variant="default" padding="lg" hover={true}>
          <div class="tool-header">
            <h3 class="tool-name">{tool.name}</h3>
            <Badge variant="info" size="sm">tool</Badge>
          </div>
          <p class="tool-desc">{tool.description}</p>
          <details class="tool-schema">
            <summary>JSON Schema</summary>
            <pre>{JSON.stringify(tool.parameters, null, 2)}</pre>
          </details>
        </Card>
      {/each}
    </div>
  {/if}
</PageTemplate>

<style>
  .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60%; gap: 1rem; color: #666; }
  .empty-icon { font-size: 3rem; opacity: 0.3; }

  .tool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }

  .tool-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
  .tool-name { font-size: 1rem; font-weight: 600; margin: 0; }

  .tool-desc { color: #888; font-size: 0.85rem; line-height: 1.4; margin: 0 0 0.75rem; }

  .tool-schema summary { cursor: pointer; color: #666; font-size: 0.75rem; font-weight: 500; }
  .tool-schema pre { margin: 0.5rem 0; padding: 0.5rem; background: #0f0f18; border-radius: 6px; font-size: 0.7rem; overflow-x: auto; }
</style>
