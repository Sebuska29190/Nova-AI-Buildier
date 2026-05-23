<script lang="ts">
  let {
    active = false,
    icon = "",
    label = "",
    subtitle = "",
    onclick,
    children,
    ...rest
  }: {
    active?: boolean;
    icon?: string;
    label?: string;
    subtitle?: string;
    onclick?: (e: MouseEvent) => void;
    children?: any;
    [key: string]: any;
  } = $props();
</script>

<button
  {onclick}
  {...rest}
  class="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg transition-all duration-150 cursor-pointer border-none
    {active
      ? 'bg-nova-accent-dim text-nova-accent'
      : 'bg-transparent text-nova-muted hover:bg-nova-surface hover:text-nova-foreground'}"
>
  {#if icon}
    <span class="text-base shrink-0 w-5 text-center">{icon}</span>
  {/if}
  <div class="min-w-0 flex-1">
    {#if label}
      <div class="text-sm font-medium truncate">{label}</div>
    {/if}
    {#if subtitle}
      <div class="text-xs text-nova-muted truncate">{subtitle}</div>
    {/if}
  </div>
  {#if children}
    <div class="shrink-0">{@render children()}</div>
  {/if}
</button>
