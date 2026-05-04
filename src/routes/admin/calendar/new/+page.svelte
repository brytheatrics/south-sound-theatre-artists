<script lang="ts">
  import { enhance } from "$app/forms";
  import SchedulePatternEditor from "$lib/components/SchedulePatternEditor.svelte";
  let { data, form } = $props();
  const v = $derived((form?.values as Record<string, string> | undefined) ?? {});

  // Org-prefill values arrive when the form was opened via
  // /admin/calendar/new?org=<slug>. A fail-validation re-render keeps
  // whatever the admin typed (form.values wins); the prefill only
  // matters on first paint.
  const pre = $derived(data.prefill);

  // Bind run dates for the schedule pattern editor.
  let runStart = $state<string>(v.run_start ?? "");
  let runEnd = $state<string>(v.run_end ?? "");
  let perfs = $state<Array<{ wallClock: string; note: string; cancelled: boolean }>>([]);

  function addPerf() {
    const seedDate = runStart || new Date().toISOString().slice(0, 10);
    perfs = [...perfs, { wallClock: `${seedDate}T19:30`, note: "", cancelled: false }];
  }
  function removePerf(i: number) {
    perfs = perfs.filter((_, j) => j !== i);
  }
  function applyGenerated(generated: Array<{ wallClock: string; note: string }>) {
    perfs = generated.map((g) => ({ ...g, cancelled: false }));
  }

  let busy = $state(false);
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
    or overwritten. Use the schedule pattern below to generate all the
    performances in one shot.
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
      // reset:false so a validation-fail response doesn't blank the form.
      // (Successful submit redirects, so this branch only matters on
      // failure - but blanking on failure would be infuriating.)
      await update({ reset: false });
      busy = false;
    };
  }}
>
  <input type="hidden" name="performances_json" value={JSON.stringify(perfs)} />
  {#if pre?.organization_id}
    <input type="hidden" name="organization_id" value={pre.organization_id} />
  {/if}

  {#if pre}
    <p class="org-context">
      Adding a show for <strong>{pre.organization_name}</strong>. Organization,
      area, and link are pre-filled from the org row - edit any of them below.
    </p>
  {/if}

  <h2 class="block-title">Production details</h2>

  <label class="field">
    <span>Title</span>
    <input name="title" type="text" required value={v.title ?? ""} placeholder="DA VINCI CODE" />
    <span class="hint">Will be stored in ALL CAPS for consistency.</span>
  </label>

  <label class="field">
    <span>Organization</span>
    <input name="organization_name" type="text" required value={v.organization_name ?? pre?.organization_name ?? ""} placeholder="Tacoma Little Theatre" />
  </label>

  <div class="row-2">
    <label class="field">
      <span>Run start</span>
      <input name="run_start" type="date" bind:value={runStart} />
    </label>
    <label class="field">
      <span>Run end</span>
      <input name="run_end" type="date" bind:value={runEnd} />
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
          <option value={a.id} selected={(v.area_id ?? pre?.area_id) === a.id}>{a.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <label class="field">
    <span>Detail URL</span>
    <input name="detail_url" type="url" value={v.detail_url ?? pre?.detail_url ?? ""} placeholder="https://..." />
    <span class="hint">
      Where calendar visitors click to learn more / buy tickets.
      {#if pre?.detail_url}
        Pre-filled with the org's source/homepage URL — replace with the
        per-show ticket page if you have one.
      {/if}
    </span>
  </label>

  <h2 class="block-title perf-h">Performances</h2>
  <p class="perf-help">Times in Pacific. Use the pattern generator below or add rows by hand.</p>

  <SchedulePatternEditor
    {runStart}
    {runEnd}
    existingCount={perfs.length}
    onApply={applyGenerated}
  />

  {#if perfs.length === 0}
    <p class="empty-perfs">No performances yet — add one below or use the pattern generator above.</p>
  {/if}

  <ul class="perf-list">
    {#each perfs as p, i (i)}
      <li class="perf-row" class:cancelled={p.cancelled}>
        <input type="datetime-local" bind:value={perfs[i].wallClock} class="dt-input" />
        <input type="text" bind:value={perfs[i].note} placeholder="Note (e.g., Pay What You Can)" class="note-input" />
        <button type="button" class="bt bt-ghost bt-sm" onclick={() => removePerf(i)}>×</button>
      </li>
    {/each}
  </ul>

  <button type="button" class="bt bt-ghost" onclick={addPerf}>+ Add performance</button>

  <div class="actions">
    <button type="submit" class="bt bt-pri" disabled={busy}>
      {busy ? "Saving..." : `Save${perfs.length > 0 ? ` with ${perfs.length} performance${perfs.length === 1 ? "" : "s"}` : ""}`}
    </button>
    <a class="bt bt-ghost" href="/admin/calendar">Cancel</a>
  </div>
</form>

<style>
  .hd { margin-bottom: 1.5rem; }
  .eyebrow {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin-bottom: 0.5rem;
  }
  .eyebrow .num { color: var(--accent); margin-right: 0.4em; }
  .h1-display { font-family: var(--font-display); font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 600; margin: 0 0 0.5rem; }
  .lede { color: var(--ink-soft); max-width: 60ch; margin: 0 0 1rem; }
  .form-error { padding: 0.75rem 1rem; border-radius: var(--radius); margin-bottom: 1rem; background: #f9e0d4; color: var(--error); border: 1px solid var(--error); }
  /* Org-context banner: shown on top of the form when admin arrived
     via "+ Add show" on a specific org row. Soft moss-on-cream so it
     reads as informational, not as a warning. */
  .org-context {
    margin: 0 0 1rem;
    padding: 0.65rem 0.9rem;
    background: color-mix(in oklch, var(--accent), var(--bg) 90%);
    border-left: 2px solid var(--accent);
    border-radius: var(--radius);
    color: var(--ink-soft);
    font-size: 0.85rem;
    line-height: 1.45;
  }
  .org-context strong { color: var(--ink); }

  .card { background: var(--bg-raised); border: 1px solid var(--rule); border-radius: var(--radius); padding: 1.25rem; max-width: 720px; }
  .block-title {
    font-family: var(--font-display);
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0 0 0.75rem;
    color: var(--ink);
  }
  .block-title:not(:first-of-type) { margin-top: 1.25rem; }
  .perf-h { margin-top: 1.5rem; }
  .perf-help { font-size: 0.82rem; color: var(--muted); margin: 0 0 0.6rem; }

  .field { display: block; margin-bottom: 0.95rem; }
  .field > span:first-child {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 0.3rem;
  }
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

  .empty-perfs { color: var(--muted); font-style: italic; padding: 0.5rem 0; }
  .perf-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.6rem; }
  .perf-row {
    display: grid;
    grid-template-columns: 11rem 1fr auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.4rem;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }
  .perf-row.cancelled { opacity: 0.5; text-decoration: line-through; }
  .dt-input, .note-input {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 0.85rem;
    background: var(--bg);
    color: var(--ink);
  }

  .actions { display: flex; gap: 0.5rem; margin-top: 1.25rem; }
  .bt {
    padding: 0.55rem 1rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    text-decoration: none;
    font-size: 0.9rem;
    cursor: pointer;
    font-family: var(--font-body);
  }
  .bt:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .bt-pri { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); color: white; }
  .bt-sm { padding: 0.2rem 0.5rem; font-size: 0.85rem; }
  .bt:disabled { opacity: 0.6; cursor: not-allowed; }

  @media (max-width: 720px) {
    .row-2 { grid-template-columns: 1fr; }
    .perf-row { grid-template-columns: 1fr; }
  }
</style>
