<script lang="ts">
  let {
    label = "",
    error = "",
    icon = "",
    value = "",
    placeholder = "",
    type = "text" as string,
    disabled = false,
    oninput,
    ...rest
  }: {
    label?: string;
    error?: string;
    icon?: string;
    value?: string;
    placeholder?: string;
    type?: string;
    disabled?: boolean;
    oninput?: (e: Event) => void;
    [key: string]: any;
  } = $props();

  let inputId = $state("");
  $effect(() => {
    inputId = "input-" + Math.random().toString(36).slice(2, 9);
  });
</script>

<div class="flex flex-col gap-1">
  {#if label}
    <label for={inputId} class="text-xs font-medium text-nova-muted">{label}</label>
  {/if}
  <div class="relative flex items-center">
    {#if icon}
      <span class="absolute left-2 text-sm text-nova-muted pointer-events-none">{icon}</span>
    {/if}
    <input
      {type} {value} {placeholder} {disabled} {oninput}
      id={inputId}
      {...rest}
      class="input-nova w-full rounded-lg text-sm font-sans outline-none transition-all duration-150
        {icon ? 'pl-8' : 'pl-3'} pr-3 py-2.5
        {error ? 'border-red-400' : ''}
        disabled:opacity-50"
    />
  </div>
  {#if error}
    <span class="text-[0.7rem] text-red-400">{error}</span>
  {/if}
</div>
