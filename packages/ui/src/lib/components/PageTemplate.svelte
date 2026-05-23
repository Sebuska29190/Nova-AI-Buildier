<script lang="ts">
  let {
    title = "",
    subtitle = "",
    icon = "",
    actions = undefined as any,
    loading = false,
    padded = true,
    children,
  }: {
    title?: string;
    subtitle?: string;
    icon?: string;
    actions?: any;
    loading?: boolean;
    padded?: boolean;
    children?: any;
  } = $props();
</script>

<div class="flex flex-col h-full overflow-hidden {padded ? 'p-5' : ''}">
  {#if title || icon || actions}
    <div class="flex items-start justify-between gap-4 mb-5 shrink-0">
      <div class="flex items-center gap-3 min-w-0">
        {#if icon}
          <div class="w-9 h-9 flex items-center justify-center rounded-lg border border-nova-accent-dim bg-nova-accent-dim text-lg shrink-0">
            {icon}
          </div>
        {/if}
        <div class="min-w-0">
          <h1 class="text-lg font-bold text-nova-foreground m-0 leading-tight">{title}</h1>
          {#if subtitle}
            <p class="text-xs text-nova-muted mt-0.5 m-0">{subtitle}</p>
          {/if}
        </div>
      </div>
      {#if actions}
        <div class="flex items-center gap-2 shrink-0">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}

  {#if loading}
    <div class="flex-1 flex flex-col items-center justify-center gap-3 text-nova-muted text-sm">
      <div class="w-8 h-8 rounded-full border-3 border-nova-border border-t-nova-accent animate-spin"></div>
      <span>Loading...</span>
    </div>
  {:else}
    <div class="flex-1 overflow-y-auto min-h-0">
      {#if children}
        {@render children()}
      {/if}
    </div>
  {/if}
</div>
