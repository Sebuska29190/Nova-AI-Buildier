<script lang="ts">
  let {
    variant = "neutral" as "success" | "warning" | "error" | "info" | "neutral" | "accent",
    size = "sm" as "sm" | "md",
    dot = false,
    children,
  }: {
    variant?: "success" | "warning" | "error" | "info" | "neutral" | "accent";
    size?: "sm" | "md";
    dot?: boolean;
    children?: any;
  } = $props();
</script>

<span
  class="inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap border
    {size === 'sm' ? 'px-1.5 py-0.5 text-[0.7rem]' : 'px-2 py-1 text-[0.8rem]'}
    {variant === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_6px_rgba(34,197,94,0.15)]' : ''}
    {variant === 'warning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : ''}
    {variant === 'error' ? 'bg-red-500/20 text-red-400 border-red-500/40' : ''}
    {variant === 'info' ? 'bg-teal-500/20 text-teal-400 border-teal-500/40' : ''}
    {variant === 'accent' ? 'bg-teal-500/20 text-teal-400 border-teal-500/40 shadow-[0_0_6px_rgba(45,212,191,0.15)]' : ''}
    {variant === 'neutral' ? 'bg-[#1e293b] text-[#94a3b8] border-[#334155]' : ''}"
>
  {#if dot}
    <span class="w-1.5 h-1.5 rounded-full bg-current shrink-0"></span>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</span>
