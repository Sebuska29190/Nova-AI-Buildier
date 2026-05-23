<script lang="ts">
  let {
    label = "",
    checked = false,
    disabled = false,
    onchange,
  }: {
    label?: string;
    checked?: boolean;
    disabled?: boolean;
    onchange?: (e: Event) => void;
  } = $props();
</script>

<label class="toggle" class:disabled>
  <input type="checkbox" {checked} {disabled} {onchange} />
  <span class="toggle-track">
    <span class="toggle-thumb"></span>
  </span>
  {#if label}
    <span class="toggle-label">{label}</span>
  {/if}
</label>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
  }
  .toggle.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toggle input {
    display: none;
  }

  .toggle-track {
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--border);
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .toggle input:checked + .toggle-track {
    background: #6366f1;
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }

  .toggle input:checked + .toggle-track .toggle-thumb {
    transform: translateX(16px);
  }

  .toggle-label {
    font-size: 0.85rem;
    color: var(--fg);
  }
</style>
