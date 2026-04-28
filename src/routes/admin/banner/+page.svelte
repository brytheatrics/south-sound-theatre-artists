<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let busy = $state<string | null>(null);

  // Per-banner-card local state for the callboard picker. Keyed by banner
  // id ("new" for the in-progress new-banner card). This lives in $state
  // so toggling "Cycle all" updates the UI without a round-trip.
  type CardState = { cycleAll: boolean; pickedIds: Set<string> };
  let cardState = $state<Record<string, CardState>>({
    new: { cycleAll: false, pickedIds: new Set() },
    ...Object.fromEntries(
      data.banners.map((b) => [
        b.id,
        {
          cycleAll: b.include_all_callboard,
          pickedIds: new Set(b.include_callboard_post_ids ?? []),
        },
      ]),
    ),
  });

  function toLocal(iso: string | null): string {
    if (!iso) return "";
    // Format for datetime-local input: YYYY-MM-DDTHH:MM
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function toggleCycleAll(key: string) {
    const s = cardState[key];
    if (!s) return;
    s.cycleAll = !s.cycleAll;
    cardState = { ...cardState };
  }

  function togglePost(key: string, postId: string) {
    const s = cardState[key];
    if (!s) return;
    if (s.pickedIds.has(postId)) s.pickedIds.delete(postId);
    else s.pickedIds.add(postId);
    cardState = { ...cardState };
  }

  const POST_TYPE_LABELS: Record<string, string> = {
    audition: "Audition",
    designer: "Designer",
    crew: "Crew",
    production: "Production",
    general: "General",
  };
</script>

<svelte:head><title>Banner - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · banner</span>
  <h1 class="h1-display">Announcement banner.</h1>
  <p class="lede">
    Site-wide notice. Stage future banners; only enabled-in-window ones show.
    Banners can also rotate through callboard posts so visitors see open
    calls right above the nav.
  </p>
</header>

{#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
{#if form?.created}<div class="form-ok" role="status">Created.</div>{/if}
{#if form?.saved}<div class="form-ok" role="status">Saved.</div>{/if}

{#snippet callboardPicker(key: string)}
  {@const state = cardState[key]}
  <div class="cb-block">
    <div class="cb-head">
      <span class="block-label">Callboard posts</span>
      <span class="cb-help">
        Add open calls to the banner. They rotate through alongside the
        body text above.
      </span>
    </div>

    <label class="check cb-cycle">
      <input
        type="checkbox"
        name="include_all_callboard"
        checked={state.cycleAll}
        onchange={() => toggleCycleAll(key)}
      />
      <span>Cycle through <strong>all</strong> open callboard posts</span>
    </label>

    {#if !state.cycleAll}
      {#if data.callboardPosts.length === 0}
        <p class="cb-empty">No approved callboard posts to choose from yet.</p>
      {:else}
        <div class="cb-list">
          {#each data.callboardPosts as p (p.id)}
            <label class="cb-row" class:on={state.pickedIds.has(p.id)}>
              <input
                type="checkbox"
                name="post_id"
                value={p.id}
                checked={state.pickedIds.has(p.id)}
                onchange={() => togglePost(key, p.id)}
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
{/snippet}

<form method="POST" action="?/upsert" class="card" use:enhance={() => { busy = "new"; return async ({ update }) => { await update({ reset: true }); busy = null; }; }}>
  <h2>New banner</h2>
  <label class="field">
    <span>Body (markdown)</span>
    <textarea name="body" rows="3" required></textarea>
  </label>
  <div class="row">
    <label class="field"><span>Starts at (optional)</span><input type="datetime-local" name="starts_at" /></label>
    <label class="field"><span>Ends at (optional)</span><input type="datetime-local" name="ends_at" /></label>
    <label class="check"><input type="checkbox" name="enabled" /><span>Enabled</span></label>
  </div>
  {@render callboardPicker("new")}
  <button type="submit" class="bt bt-pri" disabled={busy === "new"}>
    {busy === "new" ? "Saving..." : "Add banner"}
  </button>
</form>

{#each data.banners as b (b.id)}
  <form method="POST" action="?/upsert" class="card" use:enhance={() => { busy = b.id; return async ({ update }) => { await update({ reset: false }); busy = null; }; }}>
    <input type="hidden" name="id" value={b.id} />
    <label class="field">
      <span>Body</span>
      <textarea name="body" rows="3" required>{b.body_markdown}</textarea>
    </label>
    <div class="row">
      <label class="field"><span>Starts at</span><input type="datetime-local" name="starts_at" value={toLocal(b.starts_at)} /></label>
      <label class="field"><span>Ends at</span><input type="datetime-local" name="ends_at" value={toLocal(b.ends_at)} /></label>
      <label class="check"><input type="checkbox" name="enabled" checked={b.enabled} /><span>Enabled</span></label>
    </div>
    {@render callboardPicker(b.id)}
    <div class="actions">
      <button type="submit" class="bt bt-pri" disabled={busy === b.id}>{busy === b.id ? "Saving..." : "Save"}</button>
      <button type="submit" formaction="?/remove" class="bt-link warn">Delete</button>
    </div>
  </form>
{/each}

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 800px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 16px; color: var(--muted); margin: 0 0 1rem; }
  .card { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; background: var(--bg-raised); border: 1px solid var(--rule); border-radius: var(--radius-lg); margin-bottom: 1rem; max-width: 720px; }
  .card h2 { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin: 0; font-weight: 500; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field span { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .field input, .field textarea { padding: 8px 12px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-body); font-size: 14px; background: var(--bg); }
  .field input:focus, .field textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  .row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; }
  .check { display: flex; align-items: center; gap: 6px; font-family: var(--font-body); font-size: 13px; color: var(--ink); padding-bottom: 8px; }
  .actions { display: flex; gap: 8px; align-items: center; }
  .bt { font-family: var(--font-body); font-size: 14px; padding: 9px 16px; border-radius: var(--radius); border: 1px solid transparent; cursor: pointer; }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt:disabled { opacity: 0.5; cursor: progress; }
  .form-error { background: color-mix(in oklch, var(--warn), var(--bg) 80%); border: 1px solid var(--warn); color: var(--warn); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--ink-soft); }
  .bt-link.warn { color: var(--warn); }
  .bt-link:hover { text-decoration: underline; }

  /* === CALLBOARD PICKER === */
  .cb-block {
    border-top: 1px dashed var(--rule);
    padding-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }
  .cb-head { display: flex; flex-direction: column; gap: 4px; }
  .block-label {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .cb-help {
    font-size: 12.5px;
    color: var(--muted);
    line-height: 1.45;
  }
  .cb-cycle { padding-bottom: 0; }
  .cb-cycle strong { font-weight: 600; }
  .cb-empty {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    font-style: italic;
  }
  .cb-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 260px;
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

  @media (max-width: 720px) {
    .row { grid-template-columns: 1fr; }
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
