<script lang="ts">
  let {
    open = false,
    title = "",
    size = "md" as "sm" | "md" | "lg",
    onclose,
    children,
  }: {
    open?: boolean;
    title?: string;
    size?: "sm" | "md" | "lg";
    onclose?: () => void;
    children?: any;
  } = $props();

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose?.();
  }

  $effect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeydown);
      return () => document.removeEventListener("keydown", handleKeydown);
    }
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    role="dialog" aria-modal="true" tabindex="-1"
    onclick={handleBackdrop} onkeydown={handleKeydown}
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-300 animate-fade-in"
  >
    <div
      class="panel-strong rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.5)] max-h-[80vh] flex flex-col overflow-hidden animate-dialog-in
        {size === 'sm' ? 'w-[360px]' : ''}
        {size === 'md' ? 'w-[520px]' : ''}
        {size === 'lg' ? 'w-[720px]' : ''}"
    >
      <div class="flex items-center justify-between px-5 py-4 border-b border-nova-border">
        <h3 class="text-base font-semibold">{title}</h3>
        <button
          onclick={onclose}
          class="bg-transparent border-none text-nova-muted hover:text-nova-foreground cursor-pointer text-lg p-1 rounded-md hover:bg-nova-surface-3 leading-none transition-colors"
        >✕</button>
      </div>
      <div class="p-5 overflow-y-auto">
        {#if children}
          {@render children()}
        {/if}
      </div>
    </div>
  </div>
{/if}
