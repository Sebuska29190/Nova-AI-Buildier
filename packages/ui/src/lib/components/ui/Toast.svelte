<script lang="ts">
  let {
    message = "",
    type = "info" as "success" | "error" | "info",
    duration = 3000,
    onclose,
  }: {
    message?: string;
    type?: "success" | "error" | "info";
    duration?: number;
    onclose?: () => void;
  } = $props();

  let visible = $state(false);

  $effect(() => {
    if (message) {
      visible = true;
      const timer = setTimeout(() => {
        visible = false;
        setTimeout(() => onclose?.(), 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  });
</script>

{#if message}
  <div
    class="fixed top-4 right-4 z-200 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md border max-w-[400px]
      transition-transform duration-300 ease-out
      {visible ? 'translate-x-0' : 'translate-x-[120%]'}
      {type === 'success' ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30' : ''}
      {type === 'error' ? 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30' : ''}
      {type === 'info' ? 'bg-[#2dd4bf]/15 text-[#2dd4bf] border-[#2dd4bf]/30' : ''}"
  >
    <span class="text-sm shrink-0">{type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}</span>
    <span class="flex-1">{message}</span>
    <button
      onclick={() => { visible = false; setTimeout(() => onclose?.(), 300); }}
      class="bg-none border-none text-inherit opacity-60 cursor-pointer text-xs p-0.5 shrink-0 hover:opacity-100"
    >✕</button>
  </div>
{/if}
