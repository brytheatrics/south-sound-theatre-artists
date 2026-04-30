<!--
  DisciplineOrder: a small reorder UI for a profile's selected
  disciplines. Pairs with DisciplinePicker - the picker handles
  add / remove, this handles "which one shows up first".

  The directory + homepage cards display the first two array entries.
  We surface that rule directly so artists know what changes.

  Props:
   - value: string[]   - the ordered list (source of truth)
   - onChange: (next)  - parent updates state when user reorders
   - otherLabel?       - if "Other" appears in the array, swap it
                          for this in the display (e.g. "Music Director")
                          while the underlying value stays "Other"
                          for the picker's checked state.

  Hidden when value has 0 or 1 entries (nothing to reorder).
-->
<script lang="ts">
  type Props = {
    value: string[];
    onChange: (next: string[]) => void;
    otherLabel?: string;
  };

  let { value, onChange, otherLabel = "" }: Props = $props();

  function move(idx: number, delta: number) {
    const target = idx + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  // Substitute the "Other" sentinel with the actual user-typed label so
  // the row reads sensibly. Stays "Other" in the underlying array.
  function display(name: string): string {
    return name === "Other" && otherLabel ? otherLabel : name;
  }
</script>

{#if value.length > 1}
  <div class="block">
    <p class="hint">
      Display order. The first two appear on directory cards and the
      homepage. Use the arrows to put your headline disciplines first.
    </p>
    <ul class="rows">
      {#each value as name, i (name)}
        <li class="row">
          <span class="rank">{i + 1}</span>
          <span class="name">{display(name)}</span>
          {#if i < 2}
            <span class="badge">Shows on cards</span>
          {/if}
          <span class="arrows">
            <button
              type="button"
              class="arrow"
              onclick={() => move(i, -1)}
              disabled={i === 0}
              aria-label={`Move ${display(name)} up`}
              title="Move up"
            >↑</button>
            <button
              type="button"
              class="arrow"
              onclick={() => move(i, 1)}
              disabled={i === value.length - 1}
              aria-label={`Move ${display(name)} down`}
              title="Move down"
            >↓</button>
          </span>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }
  .hint {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    line-height: 1.5;
    margin: 0;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-raised);
  }
  .row {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--rule-soft);
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
  }
  .row:last-child { border-bottom: 0; }
  .rank {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
    min-width: 1.25rem;
    text-align: right;
  }
  .name {
    color: var(--ink);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge {
    font-family: var(--font-mono);
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--accent);
    background: color-mix(in oklch, var(--accent), var(--bg) 88%);
    border: 1px solid color-mix(in oklch, var(--accent), var(--bg) 60%);
    padding: 2px 7px;
    border-radius: 2px;
    white-space: nowrap;
  }
  .arrows {
    display: inline-flex;
    gap: 2px;
  }
  .arrow {
    background: transparent;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    width: 28px;
    height: 28px;
    cursor: pointer;
    color: var(--ink-soft);
    font-size: 14px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .arrow:hover:not(:disabled) {
    border-color: var(--ink);
    color: var(--ink);
    background: var(--paper);
  }
  .arrow:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .arrow:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  @media (max-width: 540px) {
    .row {
      grid-template-columns: auto 1fr auto;
    }
    /* On mobile, drop the 'Shows on cards' badge to keep the row tight.
       The hint text already explains the rule. */
    .badge { display: none; }
  }
</style>
