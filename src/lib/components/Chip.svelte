<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    on?: boolean;
    solid?: boolean;
    onclick?: () => void;
    type?: "button" | "submit";
    children: Snippet;
  };
  let { on = false, solid = false, onclick, type = "button", children }: Props = $props();
</script>

{#if onclick}
  <button {type} class="chip" class:on class:solid {onclick}>
    {@render children()}
  </button>
{:else}
  <span class="chip" class:on class:solid>
    {@render children()}
  </span>
{/if}

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-body);
    font-size: 12px;
    padding: 5px 11px;
    border-radius: 100px;
    background: transparent;
    border: 1px solid var(--rule);
    color: var(--ink-soft);
    white-space: nowrap;
    line-height: 1.2;
  }
  button.chip {
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s, border-color 0.15s;
  }
  button.chip:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .chip.on {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  .chip.solid {
    background: var(--paper);
    border-color: var(--paper);
  }
</style>
