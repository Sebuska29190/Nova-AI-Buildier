<script lang="ts">
  let {
    checked = false,
    disabled = false,
    onchange,
    label = "",
    id = "",
  }: {
    checked?: boolean;
    disabled?: boolean;
    onchange?: (e: Event) => void;
    label?: string;
    id?: string;
  } = $props();

  let switchId = $state("");
  $effect(() => {
    switchId = id || "switch-" + Math.random().toString(36).slice(2, 9);
  });
</script>

<div class="flex items-center gap-2">
  <button
    role="switch"
    aria-checked={checked}
    aria-label={label}
    id={switchId}
    {disabled}
    {onchange}
    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:shadow-[0_0_0_2px_rgba(45,212,191,0.3)]
      {checked ? 'bg-nova-accent' : 'bg-[#1a3a3a]'}
      {disabled ? 'opacity-50 cursor-not-allowed' : ''}"
  >
    <span
      class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out
        {checked ? 'translate-x-4' : 'translate-x-0'}"
    ></span>
  </button>
  {#if label}
    <label for={switchId} class="text-sm text-nova-foreground cursor-pointer select-none">{label}</label>
  {/if}
</div>
