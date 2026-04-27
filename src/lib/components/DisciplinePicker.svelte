<script lang="ts">
  // Searchable, accordion-style multi-select for disciplines. Designed to
  // scale from the current ~16 entries to 100+ as Lexi grows the list:
  //   - search box at top filters across categories and auto-expands matches
  //   - selected items show as removable chips above (so collapsed-category
  //     selections stay visible)
  //   - each category collapses; header shows the in-category selection count
  //   - "Other" reveals a free-text input that the parent submits as
  //     `discipline_other` for the admin to consider for the canonical list

  type Item = { name: string; category: string };

  type Props = {
    items: Item[];
    categoryOrder: string[];
    selected: Set<string>;
    onToggle: (name: string) => void;
    /** Optional - when omitted, the "Other" custom-text field is hidden. */
    otherValue?: string;
    onOtherChange?: (value: string) => void;
    /** Form field name for the hidden inputs. Defaults to "disciplines". */
    inputName?: string;
    /** Whether to render the "Other" + custom-text input. Defaults to true. */
    showOtherInput?: boolean;
    error?: string;
  };

  let {
    items,
    categoryOrder,
    selected,
    onToggle,
    otherValue = "",
    onOtherChange = () => {},
    inputName = "disciplines",
    showOtherInput = true,
    error,
  }: Props = $props();

  let search = $state("");
  let userExpanded = $state<Set<string>>(new Set());

  const grouped = $derived.by(() => {
    const g = new Map<string, Item[]>();
    for (const cat of categoryOrder) g.set(cat, []);
    for (const item of items) {
      if (!g.has(item.category)) g.set(item.category, []);
      g.get(item.category)!.push(item);
    }
    // Drop empty categories
    for (const [k, v] of g) if (v.length === 0) g.delete(k);
    return g;
  });

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grouped;
    const f = new Map<string, Item[]>();
    for (const [cat, items] of grouped) {
      const matches = items.filter((i) => i.name.toLowerCase().includes(q));
      if (matches.length > 0) f.set(cat, matches);
    }
    return f;
  });

  // When searching, every visible category is auto-expanded.
  const isOpen = $derived((cat: string) =>
    search.trim() ? true : userExpanded.has(cat),
  );

  function toggleCategory(cat: string) {
    if (userExpanded.has(cat)) userExpanded.delete(cat);
    else userExpanded.add(cat);
    userExpanded = new Set(userExpanded);
  }

  function countSelectedIn(items: Item[]): number {
    let n = 0;
    for (const i of items) if (selected.has(i.name)) n++;
    return n;
  }
</script>

<div class="picker">
  <div class="search-row">
    <input
      type="search"
      placeholder="Search disciplines..."
      bind:value={search}
      class="search"
      aria-label="Search disciplines"
    />
  </div>

  {#if selected.size > 0}
    <div class="chips" aria-label="Selected disciplines">
      {#each [...selected] as name (name)}
        <button
          type="button"
          class="chip"
          onclick={() => onToggle(name)}
          aria-label={`Remove ${name}`}
        >
          {name}
          <span class="chip-x" aria-hidden="true">×</span>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Hidden inputs for form submission. The accordion only renders
       inputs for visible items, so we duplicate every selection here so
       FormData picks them up regardless of which category is collapsed. -->
  {#each [...selected] as name}
    <input type="hidden" name={inputName} value={name} />
  {/each}

  <div class="categories">
    {#if filtered.size === 0}
      <p class="empty">No disciplines match "{search}".</p>
    {/if}
    {#each [...filtered] as [cat, catItems] (cat)}
      {@const count = countSelectedIn(catItems)}
      {@const open = isOpen(cat)}
      <div class="category">
        <button
          type="button"
          class="cat-header"
          class:open
          onclick={() => toggleCategory(cat)}
          aria-expanded={open}
        >
          <span class="caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
          <span class="cat-name">{cat}</span>
          {#if count > 0}<span class="count">{count}</span>{/if}
        </button>
        {#if open}
          <div class="cat-items">
            {#each catItems as item (item.name)}
              <label class="item">
                <input
                  type="checkbox"
                  checked={selected.has(item.name)}
                  onchange={() => onToggle(item.name)}
                />
                <span>{item.name}</span>
              </label>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if showOtherInput && selected.has("Other")}
    <label class="field other-field">
      <span>Specify your discipline</span>
      <input
        type="text"
        name="discipline_other"
        value={otherValue}
        oninput={(e) => onOtherChange(e.currentTarget.value)}
        placeholder="What other discipline?"
      />
      <span class="hint">
        Helps the admin add commonly-requested disciplines to the list.
      </span>
    </label>
  {/if}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .search {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 14px;
    font-family: var(--font-body);
    background: var(--bg-raised);
    color: var(--ink);
  }
  .search:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px 5px 12px;
    background: var(--ink);
    color: var(--bg);
    border: 1px solid var(--ink);
    border-radius: 100px;
    font-size: 12px;
    font-family: var(--font-body);
    cursor: pointer;
    line-height: 1.2;
  }
  .chip:hover {
    background: var(--accent);
    border-color: var(--accent);
  }
  .chip-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    font-size: 14px;
    line-height: 1;
    opacity: 0.7;
  }
  .categories {
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-raised);
  }
  .category + .category {
    border-top: 1px solid var(--rule-soft);
  }
  .cat-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
    font-weight: 500;
  }
  .cat-header:hover,
  .cat-header.open {
    background: var(--paper);
  }
  .caret {
    color: var(--muted);
    width: 12px;
    text-align: center;
    font-size: 11px;
  }
  .cat-name {
    flex: 1;
  }
  .count {
    background: var(--accent);
    color: #fff;
    border-radius: 100px;
    padding: 2px 9px;
    font-size: 11px;
    font-weight: 500;
    font-family: var(--font-mono);
  }
  .cat-items {
    padding: 10px 14px 14px 32px;
    background: var(--bg);
    border-top: 1px solid var(--rule-soft);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 6px 16px;
  }
  .item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 3px 0;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
  }
  .item input {
    margin: 4px 0 0;
    accent-color: var(--accent);
  }
  .empty {
    padding: 1.5rem;
    color: var(--muted);
    margin: 0;
    text-align: center;
    font-family: var(--font-body);
    font-size: 14px;
  }
  .other-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }
  .other-field span:first-child {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .other-field input {
    padding: 10px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 14px;
    font-family: var(--font-body);
    background: var(--bg-raised);
    color: var(--ink);
  }
  .other-field input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .hint {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .error {
    color: var(--error);
    font-size: 13px;
    margin: 4px 0 0;
    font-family: var(--font-body);
  }
</style>
