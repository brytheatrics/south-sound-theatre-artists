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
    otherValue: string;
    onOtherChange: (value: string) => void;
    error?: string;
  };

  let {
    items,
    categoryOrder,
    selected,
    onToggle,
    otherValue,
    onOtherChange,
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
    <input type="hidden" name="disciplines" value={name} />
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

  {#if selected.has("Other")}
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
    padding: 0.55rem 0.7rem;
    border: 1px solid #aaa;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
    background: white;
  }
  .search:focus {
    outline: 2px solid #38817d;
    outline-offset: -1px;
    border-color: #38817d;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.5rem 0.3rem 0.7rem;
    background: #38817d;
    color: white;
    border: none;
    border-radius: 999px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
  }
  .chip:hover {
    background: #2d6b67;
  }
  .chip-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.25);
    font-size: 0.85rem;
    line-height: 1;
  }
  .categories {
    border: 1px solid #ddd;
    border-radius: 6px;
    overflow: hidden;
  }
  .category + .category {
    border-top: 1px solid #eee;
  }
  .cat-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0.8rem;
    background: #f7f7f7;
    border: none;
    cursor: pointer;
    text-align: left;
    font-size: 0.95rem;
    font-family: inherit;
    color: #2d1f3d;
    font-weight: 500;
  }
  .cat-header:hover {
    background: #ebebeb;
  }
  .cat-header.open {
    background: #ebebeb;
  }
  .caret {
    color: #888;
    width: 1rem;
    text-align: center;
  }
  .cat-name {
    flex: 1;
  }
  .count {
    background: #38817d;
    color: white;
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    font-size: 0.8rem;
    font-weight: 500;
  }
  .cat-items {
    padding: 0.6rem 0.8rem 0.8rem 1.6rem;
    background: white;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.4rem 1rem;
  }
  .item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.2rem 0;
    cursor: pointer;
  }
  .item input {
    margin: 0.2rem 0 0;
  }
  .empty {
    padding: 1rem;
    color: #666;
    margin: 0;
    text-align: center;
  }
  .other-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 0.5rem;
  }
  .other-field span:first-child {
    font-weight: 500;
  }
  .other-field input {
    padding: 0.55rem 0.7rem;
    border: 1px solid #aaa;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
  }
  .other-field input:focus {
    outline: 2px solid #38817d;
    outline-offset: -1px;
    border-color: #38817d;
  }
  .hint {
    font-size: 0.85rem;
    color: #666;
  }
  .error {
    color: #c00;
    font-size: 0.85rem;
    margin: 0.2rem 0 0;
  }
</style>
