<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let busy = $state<string | null>(null);

  // Group resources by category for the listing - mirrors what the
  // public page does, makes it easy to spot which category an entry
  // belongs to. A resource tagged with multiple categories appears in
  // each one. The admin list dedupe-via-id-on-render isn't a problem
  // because grouped sections are rendered separately.
  /* svelte-ignore state_referenced_locally */
  const grouped = $derived(() => {
    const out = data.categories.map((c) => ({
      ...c,
      resources: data.resources.filter(
        (r) => Array.isArray(r.category_ids) && r.category_ids.includes(c.id),
      ),
    }));
    const orphans = data.resources.filter(
      (r) => !Array.isArray(r.category_ids) || r.category_ids.length === 0,
    );
    if (orphans.length > 0) {
      out.push({ id: "_orphans", name: "Uncategorized", description: null, sort_order: 999, resources: orphans });
    }
    return out;
  });
</script>

<svelte:head><title>Resources - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · resources</span>
  <h1 class="h1-display">Resource library.</h1>
  <p class="lede">
    Curated link list shown at <code>/resources</code>. Group entries
    into categories so visitors can scan by interest.
  </p>
</header>

{#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
{#if form?.savedResource || form?.createdResource}<div class="form-ok" role="status">Resource saved.</div>{/if}
{#if form?.savedCategory || form?.createdCategory}<div class="form-ok" role="status">Category saved.</div>{/if}
{#if form?.removedResource || form?.removedCategory}<div class="form-ok" role="status">Removed.</div>{/if}

<section class="block">
  <h2 class="block-title">Add a resource</h2>
  <form method="POST" action="?/upsertResource" class="card" use:enhance={() => { busy = "new-r"; return async ({ update }) => { await update({ reset: true }); busy = null; }; }}>
    <label class="field">
      <span>Title</span>
      <input name="title" type="text" required />
    </label>
    <label class="field">
      <span>URL</span>
      <input name="url" type="url" placeholder="https://" required />
    </label>
    <fieldset class="cat-fieldset">
      <legend>Categories <span class="muted">(pick one or more, or none for Uncategorized)</span></legend>
      <div class="cat-chips">
        {#each data.categories as c (c.id)}
          <label class="cat-chip">
            <input type="checkbox" name="category_id" value={c.id} />
            <span>{c.name}</span>
          </label>
        {/each}
      </div>
    </fieldset>
    <label class="field">
      <span>Description (optional, supports inline markdown)</span>
      <textarea name="description" rows="2"></textarea>
    </label>
    <div class="row">
      <label class="field"><span>Sort order</span><input name="sort_order" type="number" value="100" /></label>
      <label class="check"><input type="checkbox" name="published" checked /><span>Published</span></label>
    </div>
    <button type="submit" class="bt bt-pri" disabled={busy === "new-r"}>
      {busy === "new-r" ? "Adding..." : "Add resource"}
    </button>
  </form>
</section>

<section class="block">
  <h2 class="block-title">Existing</h2>
  {#each grouped() as g (g.id)}
    <div class="group">
      <div class="group-head">
        <h3 class="group-title">{g.name}</h3>
        <span class="muted">{g.resources.length} item{g.resources.length === 1 ? "" : "s"}</span>
      </div>
      {#each g.resources as r (r.id)}
        <form method="POST" action="?/upsertResource" class="card row-card" use:enhance={() => { busy = r.id; return async ({ update }) => { await update({ reset: false }); busy = null; }; }}>
          <input type="hidden" name="id" value={r.id} />
          <div class="row two-col">
            <label class="field"><span>Title</span><input name="title" type="text" value={r.title} required /></label>
            <label class="field"><span>URL</span><input name="url" type="url" value={r.url} required /></label>
          </div>
          <fieldset class="cat-fieldset">
            <legend>Categories</legend>
            <div class="cat-chips">
              {#each data.categories as c (c.id)}
                <label class="cat-chip">
                  <input
                    type="checkbox"
                    name="category_id"
                    value={c.id}
                    checked={Array.isArray(r.category_ids) && r.category_ids.includes(c.id)}
                  />
                  <span>{c.name}</span>
                </label>
              {/each}
            </div>
          </fieldset>
          <label class="field">
            <span>Description</span>
            <textarea name="description" rows="2">{r.description ?? ""}</textarea>
          </label>
          <div class="row">
            <label class="field"><span>Sort</span><input name="sort_order" type="number" value={r.sort_order} /></label>
            <label class="check"><input type="checkbox" name="published" checked={r.published} /><span>Published</span></label>
          </div>
          <div class="actions">
            <button type="submit" class="bt bt-pri" disabled={busy === r.id}>{busy === r.id ? "Saving..." : "Save"}</button>
            <button type="submit" formaction="?/removeResource" class="bt-link warn">Delete</button>
          </div>
        </form>
      {/each}
    </div>
  {/each}
</section>

<section class="block">
  <h2 class="block-title">Add a category</h2>
  <form method="POST" action="?/upsertCategory" class="card" use:enhance={() => { busy = "new-c"; return async ({ update }) => { await update({ reset: true }); busy = null; }; }}>
    <label class="field"><span>Name</span><input name="name" type="text" required /></label>
    <label class="field"><span>Description (optional)</span><textarea name="description" rows="2"></textarea></label>
    <label class="field"><span>Sort order</span><input name="sort_order" type="number" value="100" /></label>
    <button type="submit" class="bt bt-pri" disabled={busy === "new-c"}>
      {busy === "new-c" ? "Adding..." : "Add category"}
    </button>
  </form>
</section>

<section class="block">
  <h2 class="block-title">Categories</h2>
  {#each data.categories as c (c.id)}
    <form method="POST" action="?/upsertCategory" class="card row-card" use:enhance={() => { busy = c.id; return async ({ update }) => { await update({ reset: false }); busy = null; }; }}>
      <input type="hidden" name="id" value={c.id} />
      <div class="row two-col">
        <label class="field"><span>Name</span><input name="name" type="text" value={c.name} required /></label>
        <label class="field"><span>Sort</span><input name="sort_order" type="number" value={c.sort_order} /></label>
      </div>
      <label class="field"><span>Description</span><textarea name="description" rows="2">{c.description ?? ""}</textarea></label>
      <div class="actions">
        <button type="submit" class="bt bt-pri" disabled={busy === c.id}>{busy === c.id ? "Saving..." : "Save"}</button>
        <button type="submit" formaction="?/removeCategory" class="bt-link warn">Delete</button>
      </div>
    </form>
  {/each}
</section>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 800px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 16px; color: var(--muted); margin: 0 0 1rem; }
  .lede code { font-family: var(--font-mono); background: var(--paper); padding: 1px 6px; border-radius: 3px; font-size: 13px; }
  .block { margin: 0 0 2.5rem; max-width: 760px; }
  .block-title {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--muted);
    font-weight: 500;
    margin: 0 0 0.875rem;
  }
  .group { margin-bottom: 1.25rem; }
  .group-head { display: flex; gap: 12px; align-items: baseline; margin-bottom: 0.5rem; }
  .group-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }
  .muted { color: var(--muted); font-size: 13px; }
  .card { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; background: var(--bg-raised); border: 1px solid var(--rule); border-radius: var(--radius-lg); margin-bottom: 0.75rem; }
  .row-card { background: var(--bg-raised); }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field span { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .field input, .field textarea { padding: 8px 12px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-body); font-size: 14px; background: var(--bg); }
  .field input:focus, .field textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  .row { display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: end; }
  .two-col { grid-template-columns: 2fr 1fr; }
  .check { display: flex; align-items: center; gap: 6px; font-family: var(--font-body); font-size: 13px; color: var(--ink); padding-bottom: 8px; }
  .check input[type="checkbox"] { accent-color: var(--accent); }
  /* Multi-select category chips: each chip is a checkbox-label.
     Visible state is driven by :has() so the underlying checkbox stays
     keyboard-accessible. */
  .cat-fieldset { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .cat-fieldset legend {
    padding: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .cat-fieldset legend .muted {
    text-transform: none;
    letter-spacing: normal;
    font-size: 11px;
    margin-left: 4px;
  }
  .cat-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .cat-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--rule);
    border-radius: 100px;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
    cursor: pointer;
    background: var(--bg);
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  .cat-chip input[type="checkbox"] { accent-color: var(--accent); margin: 0; }
  .cat-chip:hover { border-color: var(--ink); color: var(--ink); }
  .cat-chip:has(input:checked) {
    background: color-mix(in oklch, var(--accent), var(--bg) 85%);
    border-color: var(--accent);
    color: var(--ink);
  }
  .actions { display: flex; gap: 8px; align-items: center; }
  .bt { font-family: var(--font-body); font-size: 14px; padding: 9px 16px; border-radius: var(--radius); border: 1px solid transparent; cursor: pointer; }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt:disabled { opacity: 0.5; cursor: progress; }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--ink-soft); }
  .bt-link.warn { color: var(--error); }
  .bt-link:hover { text-decoration: underline; }
  .form-error { background: color-mix(in oklch, var(--error), var(--bg) 80%); border: 1px solid var(--error); color: var(--error); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }

  @media (max-width: 720px) {
    .row, .two-col { grid-template-columns: 1fr; }
  }
</style>
