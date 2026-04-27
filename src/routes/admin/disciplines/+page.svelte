<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let busy = $state<string | null>(null);

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

{#each [...byCategory] as [cat, items] (cat)}
  <section class="cat">
    <h2>{cat}</h2>
    <ul class="rows">
      {#each items as d (d.id)}
        <li class="row">
          <span class="name">{d.name}</span>
          <form method="POST" action="?/reorder" class="inline-form" use:enhance={() => { busy = d.id; return async ({ update }) => { await update(); busy = null; }; }}>
            <input type="hidden" name="id" value={d.id} />
            <input type="number" name="sort_order" value={d.sort_order} class="num-input" />
            <button type="submit" class="bt-link" disabled={busy === d.id}>Save</button>
          </form>
          <form method="POST" action="?/remove" use:enhance={() => { busy = d.id; return async ({ update }) => { await update(); busy = null; }; }}
            onsubmit={(e) => { if (!confirm(`Remove ${d.name}?`)) e.preventDefault(); }}>
            <input type="hidden" name="id" value={d.id} />
            <button type="submit" class="bt-link warn" disabled={busy === d.id}>Remove</button>
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
  .form-error { background: color-mix(in oklch, var(--warn), var(--bg) 80%); border: 1px solid var(--warn); color: var(--warn); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .cat { margin-bottom: 1.5rem; }
  .cat h2 { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin: 0 0 0.5rem; font-weight: 500; }
  .rows { list-style: none; margin: 0; padding: 0; border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--rule-soft); background: var(--bg-raised); gap: 8px; }
  .row:last-child { border-bottom: 0; }
  .name { flex: 1; font-family: var(--font-body); font-size: 14px; color: var(--ink); }
  .inline-form { display: inline-flex; align-items: center; gap: 4px; }
  .num-input { width: 4.5rem; padding: 4px 8px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-mono); font-size: 12px; }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--ink-soft); }
  .bt-link.warn { color: var(--warn); }
  .bt-link:hover { text-decoration: underline; }

  @media (max-width: 720px) {
    .add-form { grid-template-columns: 1fr; }
  }
</style>
