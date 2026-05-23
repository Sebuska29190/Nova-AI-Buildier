<script lang="ts">
  let {
    size = "md" as "sm" | "md" | "lg",
    color = "accent" as "accent" | "white" | "muted",
  }: {
    size?: "sm" | "md" | "lg";
    color?: "accent" | "white" | "muted";
  } = $props();
</script>

<div
  role="status"
  class="rounded-full animate-spin border-solid
    {size === 'sm' ? 'w-4 h-4 border-2' : ''}
    {size === 'md' ? 'w-6 h-6 border-[2.5px]' : ''}
    {size === 'lg' ? 'w-9 h-9 border-3' : ''}
    {color === 'accent' ? 'border-[#1a3a3a] border-t-[#2dd4bf]' : ''}
    {color === 'white' ? 'border-white/20 border-t-white' : ''}
    {color === 'muted' ? 'border-[#1a3a3a] border-t-[#6b7a7a]' : ''}"
>
  <span class="sr-only">Ładowanie...</span>
</div>
