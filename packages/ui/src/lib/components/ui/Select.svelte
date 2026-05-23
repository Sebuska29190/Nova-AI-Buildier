<script lang="ts">
  let {
    label = "",
    value = "",
    options = [] as Array<{ value: string; label: string }>,
    placeholder = "Wybierz...",
    disabled = false,
    onchange,
    ...rest
  }: {
    label?: string;
    value?: string;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    disabled?: boolean;
    onchange?: (e: Event) => void;
    [key: string]: any;
  } = $props();

  let selectId = $state("");
  $effect(() => {
    selectId = "select-" + Math.random().toString(36).slice(2, 9);
  });
</script>

<div class="flex flex-col gap-1">
  {#if label}
    <label for={selectId} class="text-xs font-medium text-nova-muted">{label}</label>
  {/if}
  <select
    {value} {disabled} {onchange}
    id={selectId}
    {...rest}
    class="input-nova w-full rounded-lg text-sm font-sans outline-none transition-all duration-150
      px-3 py-2.5 pr-8 cursor-pointer
      disabled:opacity-50 disabled:cursor-not-allowed
      appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236a8a8a%22 stroke-width=%222%22%3E%3Cpath d=%22M6 9l6 6 6-6%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_0.6rem_center]"
  >
    <option value="" disabled>{placeholder}</option>
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>
