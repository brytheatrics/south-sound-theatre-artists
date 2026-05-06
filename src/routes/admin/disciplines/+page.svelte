<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  let { data, form } = $props();
  let busy = $state<string | null>(null);

  // Two confirm flows share the modal: removing a discipline and removing
  // a category. Both bind a pending form element + a display name; the
  // modal copy switches based on which kind is pending.
  type PendingKind = "discipline" | "category";
  let pendingForm = $state<HTMLFormElement | null>(null);
  let pendingName = $state<string>("");
  let pendingKind = $state<PendingKind>("discipline");

  function askRemove(e: MouseEvent, name: string, kind: PendingKind) {
    pendingForm = (e.currentTarget as HTMLElement).closest("form");
    pendingName = name;
    pendingKind = kind;
  }
  function cancelRemove() {
    pendingForm = null;
    pendingName = "";
  }
  function confirmRemove() {
    pendingForm?.requestSubmit();
    cancelRemove();
  }

  // Auto-save the sort number on blur. Skips if the field is empty or
  // unchanged so we don't fire round-trips that wouldn't change anything.
  // The Sort button still works as an explicit save.
  function autoSubmitSort(e: FocusEvent, original: number) {
    const input = e.currentTarget as HTMLInputElement;
    const v = input.value.trim();
    if (!v) return;
    if (Number(v) === original) return;
    input.form?.requestSubmit();
  }

  // Group by category for display
  const byCategory = $derived.by(() => {
    const groups = new Map<string, typeof data.disciplines>();
    for (const c of data.categories) groups.set(c.name, []);
    for (const d of data.disciplines) {
      if (!groups.has(d.category)) groups.set(d.category, []);
      groups.get(d.category)!.push(d);
    }
    for (const [k, v] of groups) if (v.length === 0) groups.delete(k);
    return groups;
  });
</script>

<svelte:head><title>Disciplines - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · disciplines</span>
  <h1 class="h1-display">Disciplines.</h1>
  <p class="lede">{data.disciplines.length} disciplines across {data.categories.length} categories.</p>
</header>

<form method="POST" action="?/add" class="add-form" use:enhance={() => { busy = "add"; return async ({ update }) => { await update({ reset: true }); busy = null; }; }}>
  <label class="field">
    <span>Name</span>
    <input type="text" name="name" required placeholder="Music Director" />
  </label>
  <label class="field">
    <span>Category</span>
    <select name="category" required>
      <option value="">Pick category</option>
      {#each data.categories as c}<option value={c.name}>{c.name}</option>{/each}
    </select>
  </label>
  <label class="field">
    <span>Sort</span>
    <input type="number" name="sort_order" value="100" />
  </label>
  <button type="submit" class="bt bt-pri" disabled={busy === "add"}>
    {busy === "add" ? "Adding..." : "Add"}
  </button>
</form>

{#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
{#if form?.added}<div class="form-ok" role="status">Added {form.added}.</div>{/if}
{#if form?.addedCategory}<div class="form-ok" role="status">Added category {form.addedCategory}.</div>{/if}
{#if form?.renamedCategory}<div class="form-ok" role="status">Renamed category to {form.renamedCategory}.</div>{/if}
{#if form?.removedCategory}<div class="form-ok" role="status">Removed category {form.removedCategory}.</div>{/if}
{#if form?.renamed}
  <div class="form-ok" role="status">
    {#if form?.mergedInto}
      Merged into {form.mergedInto}. All profiles updated.
    {:else}
      Renamed to {form.renamed}. All profiles updated.
    {/if}
  </div>
{/if}

<ConfirmModal
  open={pendingForm !== null}
  title={pendingKind === "category" ? "Remove category?" : "Remove discipline?"}
  body={pendingKind === "category"
    ? `"${pendingName}" will no longer be a category option. Disciplines tagged with it must be moved or removed first.`
    : `"${pendingName}" will no longer appear in the submission picker. Profiles already tagged with it keep the tag.`}
  confirmLabel="Remove"
  variant="warn"
  onConfirm={confirmRemove}
  onClose={cancelRemove}
/>

<section class="cats-block">
  <h2 class="block-h">Categories</h2>
  <p class="hint">
    Categories group disciplines on the submission picker. Rename or
    reorder anytime; removal requires moving any tagged disciplines first.
  </p>

  <form method="POST" action="?/addCategory" class="add-cat-form"
    use:enhance={() => { busy = "addCat"; return async ({ update }) => { await update({ reset: true }); busy = null; }; }}>
    <label class="field">
      <span>New category name</span>
      <input type="text" name="name" required placeholder="e.g. Production Audio" />
    </label>
    <label class="field">
      <span>Sort</span>
      <input type="number" name="sort_order" value="100" />
    </label>
    <button type="submit" class="bt bt-pri" disabled={busy === "addCat"}>
      {busy === "addCat" ? "Adding..." : "Add category"}
    </button>
  </form>

  <ul class="cats-list">
    {#each data.categories as c (c.name)}
      {@const count = data.categoryCounts[c.name] ?? 0}
      <li class="cat-row">
        <form method="POST" action="?/renameCategory" class="cat-rename"
          use:enhance={() => { busy = `rename-${c.name}`; return async ({ update }) => { await update(); busy = null; }; }}>
          <input type="hidden" name="old_name" value={c.name} />
          <input type="text" name="new_name" value={c.name} class="cat-name-input" />
          <button type="submit" class="bt-link" disabled={busy === `rename-${c.name}`}>
            Save name
          </button>
        </form>
        <form method="POST" action="?/reorderCategory" class="inline-form"
          use:enhance={() => { busy = `reorder-${c.name}`; return async ({ update }) => { await update(); busy = null; }; }}>
          <input type="hidden" name="name" value={c.name} />
          <input
            type="number"
            name="sort_order"
            value={c.sort_order}
            class="num-input"
            title="Auto-saves when you tab away"
            onblur={(e) => autoSubmitSort(e, c.sort_order)}
          />
          <button type="submit" class="bt-link" disabled={busy === `reorder-${c.name}`}>
            Sort
          </button>
        </form>
        <span class="cat-count" title={`${count} discipline${count === 1 ? "" : "s"} use this category`}>
          {count}
        </span>
        <form method="POST" action="?/removeCategory"
          use:enhance={() => { busy = `remove-${c.name}`; return async ({ update }) => { await update(); busy = null; }; }}>
          <input type="hidden" name="name" value={c.name} />
          <button
            type="button"
            class="bt-link warn"
            disabled={busy === `remove-${c.name}` || count > 0}
            title={count > 0 ? "Move or remove the disciplines first." : "Remove this category"}
            onclick={(e) => askRemove(e, c.name, "category")}
          >
            Remove
          </button>
        </form>
      </li>
    {/each}
  </ul>
</section>

<h2 class="block-h" style="margin-top: 2rem;">Disciplines</h2>

{#each [...byCategory] as [cat, items] (cat)}
  <section class="cat">
    <h2>{cat}</h2>
    <ul class="rows">
      {#each items as d (d.id)}
        <li class="row">
          <form method="POST" action="?/rename" class="rename-form"
            use:enhance={() => { busy = `rename-${d.id}`; return async ({ update }) => { await update(); busy = null; }; }}>
            <input type="hidden" name="id" value={d.id} />
            <input type="text" name="new_name" value={d.name} class="rename-input" />
            <button type="submit" class="bt-link" disabled={busy === `rename-${d.id}`}>
              Save name
            </button>
          </form>
          <form method="POST" action="?/reorder" class="inline-form" use:enhance={() => { busy = `sort-${d.id}`; return async ({ update }) => { await update(); busy = null; }; }}>
            <input type="hidden" name="id" value={d.id} />
            <input
              type="number"
              name="sort_order"
              value={d.sort_order}
              class="num-input"
              title="Auto-saves when you tab away"
              onblur={(e) => autoSubmitSort(e, d.sort_order)}
            />
            <button type="submit" class="bt-link" disabled={busy === `sort-${d.id}`}>Sort</button>
          </form>
          <form method="POST" action="?/remove" use:enhance={() => { busy = `remove-${d.id}`; return async ({ update }) => { await update(); busy = null; }; }}>
            <input type="hidden" name="id" value={d.id} />
            <button
              type="button"
              class="bt-link warn"
              disabled={busy === `remove-${d.id}`}
              onclick={(e) => askRemove(e, d.name, "discipline")}
            >
              Remove
            </button>
          </form>
        </li>
      {/each}
    </ul>
  </section>
{/each}

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 800px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 16px; color: var(--muted); margin: 0 0 1rem; }
  .add-form { display: grid; grid-template-columns: 1fr 1fr 90px auto; gap: 8px; align-items: end; padding: 1rem; background: var(--paper); border-radius: var(--radius-lg); margin-bottom: 1rem; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field span { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .field input, .field select { padding: 8px 12px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-body); font-size: 14px; background: var(--bg-raised); }
  .field input:focus, .field select:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  .bt { font-family: var(--font-body); font-size: 14px; padding: 9px 16px; border-radius: var(--radius); border: 1px solid transparent; cursor: pointer; }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt:disabled { opacity: 0.5; cursor: progress; }
  .form-error { background: color-mix(in oklch, var(--error), var(--bg) 80%); border: 1px solid var(--error); color: var(--error); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .cat { margin-bottom: 1.5rem; }
  .cat h2 { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin: 0 0 0.5rem; font-weight: 500; }
  .rows { list-style: none; margin: 0; padding: 0; border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--rule-soft); background: var(--bg-raised); gap: 8px; }
  .row:last-child { border-bottom: 0; }
  .name { flex: 1; font-family: var(--font-body); font-size: 14px; color: var(--ink); }
  .rename-form {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 200px;
  }
  .rename-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg);
    min-width: 0;
  }
  .rename-input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .inline-form { display: inline-flex; align-items: center; gap: 4px; }
  .num-input { width: 4.5rem; padding: 4px 8px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-mono); font-size: 12px; }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--ink-soft); }
  .bt-link.warn { color: var(--error); }
  .bt-link:hover:not(:disabled) { text-decoration: underline; }
  .bt-link:disabled { opacity: 0.4; cursor: not-allowed; }

  .cats-block { margin: 1.5rem 0 2rem; }
  .block-h {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 0 0 0.5rem;
    font-weight: 500;
  }
  .hint {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0 0 0.75rem;
  }
  .add-cat-form {
    display: grid;
    grid-template-columns: 1fr 90px auto;
    gap: 8px;
    align-items: end;
    padding: 1rem;
    background: var(--paper);
    border-radius: var(--radius-lg);
    margin-bottom: 1rem;
  }
  .cats-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .cat-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    border-bottom: 1px solid var(--rule-soft);
    background: var(--bg-raised);
    flex-wrap: wrap;
  }
  .cat-row:last-child { border-bottom: 0; }
  .cat-rename {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 200px;
  }
  .cat-name-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg);
    min-width: 0;
  }
  .cat-name-input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .cat-count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
    min-width: 1.75rem;
    text-align: right;
  }

  @media (max-width: 720px) {
    .add-form { grid-template-columns: 1fr; }
    .add-cat-form { grid-template-columns: 1fr; }
  }
</style>
