<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/state";
  import SchedulePatternEditor from "$lib/components/SchedulePatternEditor.svelte";
  let { data, form } = $props();

  // Reactive performances list. Bound to the form via a JSON-encoded
  // hidden input so we can add/remove rows arbitrarily without
  // worrying about indexed name attributes.
  let perfs = $state(
    data.performances.map((p) => ({
      wallClock: p.wallClock,
      note: p.note,
      cancelled: p.cancelled,
    })),
  );

  // Bind run dates to local state so the SchedulePatternEditor can
  // expand against the live values as the admin edits.
  let runStart = $state(data.production.run_start ?? "");
  let runEnd = $state(data.production.run_end ?? "");

  function addPerf() {
    const defaultDate = runStart || new Date().toISOString().slice(0, 10);
    perfs = [...perfs, { wallClock: `${defaultDate}T19:30`, note: "", cancelled: false }];
  }
  function removePerf(i: number) {
    perfs = perfs.filter((_, j) => j !== i);
  }
  function toggleCancelled(i: number) {
    perfs = perfs.map((p, j) => (j === i ? { ...p, cancelled: !p.cancelled } : p));
  }
  function applyGeneratedPerformances(generated: Array<{ wallClock: string; note: string }>) {
    perfs = generated.map((g) => ({
      wallClock: g.wallClock,
      note: g.note,
      cancelled: false,
    }));
  }

  let busy = $state(false);
  let confirmingDelete = $state(false);
  const justCreated = $derived(page.url.searchParams.get("created") === "1");
</script>

<svelte:head>
  <title>{data.production.title} - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow">
    <span class="num">·</span>
    <a href="/admin/calendar">Calendar</a> · {data.production.title}
  </span>
  <h1 class="h1-display">{data.production.title}</h1>
  <p class="lede">
    {data.production.organization_name}
    {#if data.sourceInfo}
      · auto-pop'd from <a href={data.sourceInfo.source_url} target="_blank" rel="noopener">{data.sourceInfo.org_name} ({data.sourceInfo.org_slug})</a>
    {:else}
      · manual entry
    {/if}
  </p>
  {#if data.sourceInfo}
    {#if data.production.admin_edited_at}
      <p class="info-soft">
        🔒 <strong>Admin-locked.</strong> The cron skips this row on every sync —
        your edits below will stick. Click <em>Re-enable auto-sync</em> at the
        bottom if you want this row to follow the source again.
      </p>
    {:else}
      <p class="warn-soft">
        ⚠ Auto-pop'd by the cron. Saving here marks this row as
        admin-locked, after which the cron will skip it on every sync
        (so your edits stick). Until you save, the cron is in charge.
      </p>
    {/if}
  {/if}
</header>

{#if justCreated}<div class="form-ok" role="status">Production saved. Now add the per-date performances below.</div>{/if}
{#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
{#if form?.saved}<div class="form-ok" role="status">Saved. {form.performanceCount} performance{form.performanceCount === 1 ? "" : "s"} stored.</div>{/if}

<form
  method="POST"
  action="?/save"
  class="card"
  use:enhance={() => {
    busy = true;
    return async ({ update }) => {
      await update();
      busy = false;
    };
  }}
>
  <!-- Hidden serialised performances. Updates reactively as state changes. -->
  <input type="hidden" name="performances_json" value={JSON.stringify(perfs)} />

  <h2 class="block-title">Production details</h2>

  <label class="field">
    <span>Title</span>
    <input name="title" type="text" required value={data.production.title} />
    <span class="hint">Saved as ALL CAPS for calendar consistency.</span>
  </label>

  <label class="field">
    <span>Organization</span>
    <input name="organization_name" type="text" required value={data.production.organization_name} />
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
          <option value={c.id} selected={data.production.category_id === c.id}>{c.name}</option>
        {/each}
      </select>
    </label>
    <label class="field">
      <span>Area</span>
      <select name="area_id">
        <option value="">— pick —</option>
        {#each data.areas as a (a.id)}
          <option value={a.id} selected={data.production.area_id === a.id}>{a.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <label class="field">
    <span>Detail URL</span>
    <input name="detail_url" type="url" value={data.production.detail_url ?? ""} placeholder="https://..." />
  </label>

  <label class="field">
    <span>Status</span>
    <select name="status">
      <option value="approved" selected={data.production.status === "approved"}>Approved (visible)</option>
      <option value="pending_review" selected={data.production.status === "pending_review"}>Pending review</option>
      <option value="rejected" selected={data.production.status === "rejected"}>Rejected (hidden)</option>
    </select>
  </label>

  <h2 class="block-title perf-title">Performances</h2>
  <p class="perf-help">
    Times in Pacific Time. Mark cancelled to keep a record visible without
    showing the date as available.
  </p>

  <SchedulePatternEditor
    {runStart}
    {runEnd}
    existingCount={perfs.length}
    onApply={applyGeneratedPerformances}
  />

  {#if perfs.length === 0}
    <p class="empty-perfs">No performances yet — add the first one below or use the pattern generator above.</p>
  {/if}

  <ul class="perf-list">
    {#each perfs as p, i (i)}
      <li class="perf-row" class:cancelled={p.cancelled}>
        <input
          type="datetime-local"
          bind:value={perfs[i].wallClock}
          class="dt-input"
        />
        <input
          type="text"
          bind:value={perfs[i].note}
          placeholder="Note (e.g., Pay What You Can)"
          class="note-input"
        />
        <label class="cancel-toggle" title="Mark cancelled">
          <input
            type="checkbox"
            checked={p.cancelled}
            onchange={() => toggleCancelled(i)}
          />
          cancelled
        </label>
        <button type="button" class="bt bt-ghost bt-sm" onclick={() => removePerf(i)}>×</button>
      </li>
    {/each}
  </ul>

  <button type="button" class="bt bt-ghost" onclick={addPerf}>+ Add performance</button>

  <div class="actions">
    <button type="submit" class="bt bt-pri" disabled={busy}>
      {busy ? "Saving..." : "Save"}
    </button>
    <a class="bt bt-ghost" href="/admin/calendar">Cancel</a>
  </div>
</form>

{#if data.sourceInfo && data.production.admin_edited_at}
  <form method="POST" action="?/resync" class="resync-zone" use:enhance>
    <h3 class="resync-title">Re-enable auto-sync</h3>
    <p class="confirm-text">
      Clear the admin lock. Next cron run will overwrite this production's
      metadata + replace its performances from the source. Useful if your
      edits were a one-off correction you don't want to pin forever.
    </p>
    <button type="submit" class="bt bt-ghost">Unlock and let cron manage</button>
  </form>
{/if}

<form method="POST" action="?/softDelete" class="delete-zone" use:enhance>
  <h3 class="danger-title">Danger zone</h3>
  {#if !confirmingDelete}
    <button type="button" class="bt bt-danger" onclick={() => (confirmingDelete = true)}>
      Move to trash
    </button>
  {:else}
    <p class="confirm-text">Move this production + all its performances to the 30-day trash?
      {#if data.sourceInfo}
        Auto-pop'd rows also get admin-locked so the cron won't recreate them.
      {/if}
    </p>
    <div class="actions">
      <button type="submit" class="bt bt-danger">Yes, move to trash</button>
      <button type="button" class="bt bt-ghost" onclick={() => (confirmingDelete = false)}>Cancel</button>
    </div>
  {/if}
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
  .eyebrow a { color: var(--ink-soft); }
  .h1-display { font-family: var(--font-display); font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 600; margin: 0 0 0.5rem; }
  .lede { color: var(--ink-soft); margin: 0 0 0.5rem; }
  .warn-soft {
    background: #f4ecd8;
    color: #8a6e1c;
    border: 1px solid #d4be7c;
    padding: 0.6rem 0.85rem;
    border-radius: var(--radius);
    font-size: 0.85rem;
    max-width: 720px;
  }
  .info-soft {
    background: #dceadd;
    color: var(--accent);
    border: 1px solid var(--accent);
    padding: 0.6rem 0.85rem;
    border-radius: var(--radius);
    font-size: 0.85rem;
    max-width: 720px;
  }
  .info-soft em { font-style: italic; }
  .resync-zone {
    margin-top: 1.5rem;
    padding: 1rem 1.25rem;
    background: var(--bg-raised);
    border: 1px dashed var(--rule);
    border-radius: var(--radius);
    max-width: 720px;
  }
  .resync-title {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin: 0 0 0.5rem;
  }

  .form-error, .form-ok {
    padding: 0.65rem 1rem;
    border-radius: var(--radius);
    margin-bottom: 1rem;
    font-size: 0.9rem;
    max-width: 720px;
  }
  .form-error { background: #f9e0d4; color: var(--error); border: 1px solid var(--error); }
  .form-ok { background: #dceadd; color: var(--accent); border: 1px solid var(--accent); }

  .card {
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 1.25rem;
    max-width: 720px;
  }
  .block-title {
    font-family: var(--font-display);
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0 0 0.75rem;
    color: var(--ink);
  }
  .perf-title { margin-top: 1.25rem; }
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
    grid-template-columns: 11rem 1fr auto auto;
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
  .cancel-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .actions { display: flex; gap: 0.5rem; margin-top: 1.25rem; }
  .bt {
    padding: 0.5rem 0.95rem;
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
  .bt-danger { background: var(--error); border-color: var(--error); color: white; }
  .bt-danger:hover { background: #8b2d14; border-color: #8b2d14; }
  .bt:disabled { opacity: 0.6; cursor: not-allowed; }

  .delete-zone {
    margin-top: 2rem;
    padding: 1rem 1.25rem;
    background: var(--bg-raised);
    border: 1px solid var(--error);
    border-radius: var(--radius);
    max-width: 720px;
  }
  .danger-title {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--error);
    margin: 0 0 0.6rem;
  }
  .confirm-text { color: var(--ink-soft); margin: 0 0 0.5rem; }

  @media (max-width: 720px) {
    .row-2 { grid-template-columns: 1fr; }
    .perf-row { grid-template-columns: 1fr; }
  }
</style>
