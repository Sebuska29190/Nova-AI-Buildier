<script lang="ts">
  let {
    variant = "default" as "default" | "glass" | "bordered",
    padding = "md" as "sm" | "md" | "lg",
    hover = false,
    children,
    ...rest
  }: {
    variant?: "default" | "glass" | "bordered";
    padding?: "sm" | "md" | "lg";
    hover?: boolean;
    children?: any;
    [key: string]: any;
  } = $props();
</script>

<div
  {...rest}
  class="rounded-xl transition-all duration-200 border
    {variant === 'default' ? 'bg-nova-surface-2 border-nova-border shadow-sm' : ''}
    {variant === 'glass' ? 'glass border-nova-border-2' : ''}
    {variant === 'bordered' ? 'bg-transparent border-nova-border-3' : ''}
    {padding === 'sm' ? 'p-2' : ''}
    {padding === 'md' ? 'px-4 py-3' : ''}
    {padding === 'lg' ? 'p-5' : ''}
    {hover ? 'card-nova cursor-pointer hover:border-nova-accent hover:shadow-[0_0_12px_rgba(45,212,191,0.15)] hover:-translate-y-0.5' : ''}"
>
  {#if children}
    {@render children()}
  {/if}
</div>
