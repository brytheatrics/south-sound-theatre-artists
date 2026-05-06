<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let busy = $state(false);

  // Local state mirrors the saved settings so toggling cycle-all updates
  // the picker visibility without a round-trip.
  /* svelte-ignore state_referenced_locally */
  let cycleAllCallboard = $state(data.settings.include_all_callboard);
  /* svelte-ignore state_referenced_locally */
  let cycleAllCalendar = $state(data.settings.include_all_calendar ?? true);
  /* svelte-ignore state_referenced_locally */
  let enabled = $state(data.settings.enabled);
  /* svelte-ignore state_referenced_locally */
  let pickedPostIds = $state<Set<string>>(
    new Set(data.settings.include_callboard_post_ids ?? []),
  );
  /* svelte-ignore state_referenced_locally */
  let pickedProductionIds = $state<Set<string>>(
    new Set(data.settings.include_calendar_production_ids ?? []),
  );

  function togglePost(id: string) {
    if (pickedPostIds.has(id)) pickedPostIds.delete(id);
    else pickedPostIds.add(id);
    pickedPostIds = new Set(pickedPostIds);
  }
  function toggleProduction(id: string) {
    if (pickedProductionIds.has(id)) pickedProductionIds.delete(id);
    else pickedProductionIds.add(id);
    pickedProductionIds = new Set(pickedProductionIds);
  }

  const POST_TYPE_LABELS = $derived(
    Object.fromEntries(data.postTypes.map((t) => [t.slug, t.label])),
  );

  function fmtRunWindow(start: string | null, end: string | null): string {
    if (!start) return "";
    const s = new Date(start + "T12:00:00Z");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const fmt = (d: Date) => `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
    if (!end) return `opens ${fmt(s)}`;
    const e = new Date(end + "T12:00:00Z");
    if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
      return `${fmt(s)} - ${e.getUTCDate()}`;
    }
    return `${fmt(s)} - ${fmt(e)}`;
  }
</script>

<svelte:head><title>Homepage marquee - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · marquee</span>
  <h1 class="h1-display">Homepage marquee.</h1>
  <p class="lede">
    The scrolling ticker below the spotlight on the homepage. Mixes open
    callboard posts and upcoming calendar productions; you can either
    cycle through everything in each category or hand-pick a subset.
  </p>
</header>

{#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
{#if form?.saved}<div class="form-ok" role="status">Saved.</div>{/if}

<form method="POST" action="?/save" class="card" use:enhance={() => { busy = true; return async ({ update }) => { await update({ reset: false }); busy = false; }; }}>
  <label class="check">
    <input type="checkbox" name="enabled" bind:checked={enabled} />
    <span><strong>Show marquee on the homepage</strong></span>
  </label>
  <p class="hint">Turn this off to hide the scrolling bar entirely.</p>

  <hr class="rule" />

  <div class="cb-block">
    <span class="block-label">Callboard posts</span>
    <p class="hint">
      Open auditions and crew calls. Each item links back to its callboard
      post.
    </p>

    <label class="check">
      <input type="checkbox" name="include_all_callboard" bind:checked={cycleAllCallboard} />
      <span>Cycle through <strong>all</strong> open callboard posts</span>
    </label>

    {#if !cycleAllCallboard}
      {#if data.callboardPosts.length === 0}
        <p class="cb-empty">No approved callboard posts to choose from yet.</p>
      {:else}
        <div class="cb-list">
          {#each data.callboardPosts as p (p.id)}
            <label class="cb-row" class:on={pickedPostIds.has(p.id)}>
              <input
                type="checkbox"
                name="post_id"
                value={p.id}
                checked={pickedPostIds.has(p.id)}
                onchange={() => togglePost(p.id)}
              />
              <span class="cb-type">{POST_TYPE_LABELS[p.post_type] ?? p.post_type}</span>
              <span class="cb-title">{p.title}</span>
              <span class="cb-org">{p.organization_name}</span>
              {#if p.deadline_text}
                <span class="cb-deadline">{p.deadline_text}</span>
              {/if}
            </label>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <hr class="rule" />

  <div class="cb-block">
    <span class="block-label">Calendar productions</span>
    <p class="hint">
      Upcoming and currently-running shows. Each item links to the calendar.
    </p>

    <label class="check">
      <input type="checkbox" name="include_all_calendar" bind:checked={cycleAllCalendar} />
      <span>Cycle through <strong>all</strong> upcoming productions</span>
    </label>

    {#if !cycleAllCalendar}
      {#if data.productions.length === 0}
        <p class="cb-empty">No approved productions to choose from yet.</p>
      {:else}
        <div class="cb-list">
          {#each data.productions as p (p.id)}
            <label class="cb-row" class:on={pickedProductionIds.has(p.id)}>
              <input
                type="checkbox"
                name="production_id"
                value={p.id}
                checked={pickedProductionIds.has(p.id)}
                onchange={() => toggleProduction(p.id)}
              />
              <span class="cb-type">SHOW</span>
              <span class="cb-title">{p.title}</span>
              <span class="cb-org">{p.organization_name}</span>
              {#if p.run_start}
                <span class="cb-deadline">{fmtRunWindow(p.run_start, p.run_end)}</span>
              {/if}
            </label>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <button type="submit" class="bt bt-pri" disabled={busy}>
    {busy ? "Saving..." : "Save settings"}
  </button>
</form>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 800px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 16px; color: var(--muted); margin: 0 0 1rem; }
  .card { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem; background: var(--bg-raised); border: 1px solid var(--rule); border-radius: var(--radius-lg); margin-bottom: 1rem; max-width: 760px; }

  /* Unified checkbox styling: accent-tinted fill when checked, square
     edges and a consistent size, so the toggles + per-row picks read as
     one visual family across the page. */
  input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    margin: 0;
    border: 1px solid var(--rule);
    border-radius: 3px;
    background: var(--bg);
    cursor: pointer;
    display: inline-grid;
    place-content: center;
    transition: border-color 0.1s, background 0.1s;
  }
  input[type="checkbox"]:hover {
    border-color: var(--ink);
  }
  input[type="checkbox"]:checked {
    background: var(--accent);
    border-color: var(--accent);
  }
  input[type="checkbox"]:checked::after {
    content: "";
    width: 9px;
    height: 5px;
    border-left: 2px solid #fff;
    border-bottom: 2px solid #fff;
    transform: rotate(-45deg) translate(1px, -1px);
  }
  input[type="checkbox"]:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .check { display: flex; align-items: center; gap: 10px; font-family: var(--font-body); font-size: 14px; color: var(--ink); cursor: pointer; }
  .check strong { font-weight: 600; }
  .hint { font-size: 12.5px; color: var(--muted); margin: -4px 0 0; line-height: 1.45; }
  .rule { border: 0; border-top: 1px solid var(--rule-soft); margin: 0.25rem 0; }
  .block-label {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .cb-block { display: flex; flex-direction: column; gap: 0.625rem; }
  .cb-empty { margin: 0; font-size: 13px; color: var(--muted); font-style: italic; }
  .cb-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 360px;
    overflow-y: auto;
    padding: 4px;
    border: 1px solid var(--rule-soft);
    border-radius: var(--radius);
    background: var(--bg);
  }
  .cb-row {
    display: grid;
    grid-template-columns: auto 80px 1fr auto auto;
    gap: 10px;
    align-items: center;
    padding: 6px 8px;
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .cb-row:hover { background: var(--paper); }
  .cb-row.on { background: color-mix(in oklch, var(--accent), var(--bg) 90%); }
  .cb-type {
    font-family: var(--font-mono);
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--muted);
    background: var(--paper);
    border: 1px solid var(--rule);
    padding: 2px 6px;
    border-radius: 2px;
    text-align: center;
  }
  .cb-title { color: var(--ink); font-weight: 500; min-width: 0; }
  .cb-org {
    font-family: var(--font-accent);
    font-style: italic;
    color: var(--accent);
    font-size: 12.5px;
  }
  .cb-deadline {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
  }
  .bt { font-family: var(--font-body); font-size: 14px; padding: 9px 16px; border-radius: var(--radius); border: 1px solid transparent; cursor: pointer; align-self: flex-start; }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt:disabled { opacity: 0.5; cursor: progress; }
  .form-error { background: color-mix(in oklch, var(--error), var(--bg) 80%); border: 1px solid var(--error); color: var(--error); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }

  @media (max-width: 720px) {
    .cb-row {
      grid-template-columns: auto 1fr;
      grid-auto-flow: row;
    }
    .cb-row .cb-type { grid-column: 1; grid-row: 1; }
    .cb-row .cb-title { grid-column: 2; grid-row: 1; }
    .cb-row .cb-org   { grid-column: 2; grid-row: 2; }
    .cb-row .cb-deadline { grid-column: 2; grid-row: 3; justify-self: start; }
  }
</style>
