<script lang="ts">
  let {
    variant = "primary" as "primary" | "secondary" | "ghost" | "danger",
    size = "md" as "sm" | "md" | "lg",
    disabled = false,
    loading = false,
    icon = "",
    onclick,
    children,
    ...rest
  }: {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
    loading?: boolean;
    icon?: string;
    onclick?: (e: MouseEvent) => void;
    children?: any;
    [key: string]: any;
  } = $props();
</script>

<button
  {disabled}
  {onclick}
  {...rest}
  class="inline-flex items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-all duration-150 select-none border
    {disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    {variant === 'primary' ? 'bg-nova-accent text-nova-bg border-nova-accent hover:brightness-110 active:brightness-95 shadow-[0_2px_10px_rgba(45,212,191,0.25)] hover:shadow-[0_4px_16px_rgba(45,212,191,0.35)] hover:-translate-y-[1px] active:translate-y-0' : ''}
    {variant === 'secondary' ? 'bg-nova-surface text-nova-foreground border-nova-border-2 hover:border-nova-accent hover:text-nova-accent hover:bg-nova-surface-2' : ''}
    {variant === 'ghost' ? 'bg-transparent text-nova-muted border-transparent hover:bg-nova-surface hover:text-nova-foreground' : ''}
    {variant === 'danger' ? 'bg-red-900/20 text-red-400 border-red-800/30 hover:bg-red-900/40 hover:border-red-500' : ''}
    {size === 'sm' ? 'px-2 py-1 text-xs' : ''}
    {size === 'md' ? 'px-3 py-1.5 text-sm' : ''}
    {size === 'lg' ? 'px-4 py-2 text-base' : ''}"
>
  {#if loading}
    <span class="inline-block w-[1em] h-[1em] border-2 border-current border-t-transparent rounded-full animate-spin"></span>
  {/if}
  {#if icon && !loading}
    <span class="text-[1em] leading-none">{icon}</span>
  {/if}
  {#if children}
    <span class="leading-none">{@render children()}</span>
  {/if}
</button>
