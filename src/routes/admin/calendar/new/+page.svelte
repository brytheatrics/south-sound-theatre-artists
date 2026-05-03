<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let busy = $state(false);
  const v = $derived((form?.values as Record<string, string> | undefined) ?? {});
</script>

<svelte:head>
  <title>Add production - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · calendar · new</span>
  <h1 class="h1-display">Add a production.</h1>
  <p class="lede">
    Manual entries are independent of the cron - they don't get refreshed
    or overwritten. After save you'll add the per-date performances.
  </p>
</header>

{#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}

<form
  method="POST"
  action="?/create"
  class="card"
  use:enhance={() => {
    busy = true;
    return async ({ update }) => {
      await update();
      busy = false;
    };
  }}
>
  <label class="field">
    <span>Title</span>
    <input name="title" type="text" required value={v.title ?? ""} placeholder="DA VINCI CODE" />
    <span class="hint">Will be stored in ALL CAPS for consistency.</span>
  </label>

  <label class="field">
    <span>Organization</span>
    <input name="organization_name" type="text" required value={v.organization_name ?? ""} placeholder="Tacoma Little Theatre" />
  </label>

  <div class="row-2">
    <label class="field">
      <span>Run start</span>
      <input name="run_start" type="date" value={v.run_start ?? ""} />
    </label>
    <label class="field">
      <span>Run end</span>
      <input name="run_end" type="date" value={v.run_end ?? ""} />
    </label>
  </div>

  <div class="row-2">
    <label class="field">
      <span>Category</span>
      <select name="category_id">
        <option value="">— pick —</option>
        {#each data.categories as c (c.id)}
          <option value={c.id} selected={v.category_id === c.id}>{c.name}</option>
        {/each}
      </select>
    </label>
    <label class="field">
      <span>Area</span>
      <select name="area_id">
        <option value="">— pick —</option>
        {#each data.areas as a (a.id)}
          <option value={a.id} selected={v.area_id === a.id}>{a.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <label class="field">
    <span>Detail URL</span>
    <input name="detail_url" type="url" value={v.detail_url ?? ""} placeholder="https://..." />
    <span class="hint">Where calendar visitors click to learn more / buy tickets.</span>
  </label>

  <div class="actions">
    <button type="submit" class="bt bt-pri" disabled={busy}>
      {busy ? "Saving..." : "Save & add performances"}
    </button>
    <a class="bt bt-ghost" href="/admin/calendar">Cancel</a>
  </div>
</form>

<style>
  .hd { margin-bottom: 1.5rem; }
  .eyebrow { display: inline-block; font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 0.5rem; }
  .eyebrow .num { color: var(--accent); margin-right: 0.4em; }
  .h1-display { font-family: var(--font-display); font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 600; margin: 0 0 0.5rem; }
  .lede { color: var(--ink-soft); max-width: 60ch; margin: 0 0 1rem; }
  .form-error { padding: 0.75rem 1rem; border-radius: var(--radius); margin-bottom: 1rem; background: #f9e0d4; color: var(--error); border: 1px solid var(--error); }
  .card { background: var(--bg-raised); border: 1px solid var(--rule); border-radius: var(--radius); padding: 1.25rem; max-width: 720px; }
  .field { display: block; margin-bottom: 0.95rem; }
  .field > span:first-child { display: block; font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 0.3rem; }
  .field input, .field select {
    width: 100%;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 0.95rem;
    background: var(--bg);
    color: var(--ink);
  }
  .field .hint { display: block; margin-top: 0.25rem; font-size: 0.78rem; color: var(--muted); }
  .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .actions { display: flex; gap: 0.5rem; margin-top: 1.25rem; }
  .bt { padding: 0.55rem 1rem; border: 1px solid var(--rule); border-radius: var(--radius); background: var(--bg-raised); color: var(--ink-soft); text-decoration: none; font-size: 0.9rem; cursor: pointer; }
  .bt:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .bt-pri { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); color: white; }
  .bt:disabled { opacity: 0.6; cursor: not-allowed; }
  @media (max-width: 720px) { .row-2 { grid-template-columns: 1fr; } }
</style>
