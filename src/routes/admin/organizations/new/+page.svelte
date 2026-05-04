<script lang="ts">
  let { data, form } = $props();

  // The form-action return value typing widens form.values into a
  // union with the error shape; cast once so the template can access
  // the well-known submit-time fields without TS choking.
  const v = $derived((form?.values ?? {}) as Record<string, string>);
  const errs = $derived((form?.errors ?? {}) as Record<string, string>);

  // $state mirror so the area chip visually flips on click - same
  // pattern as the callboard form (Chrome's :has(input:checked) was
  // unreliable for live repaint).
  /* svelte-ignore state_referenced_locally */
  let pickedAreaId = $state<string>(v.area_id ?? "");
</script>

<svelte:head>
  <title>Add organization - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · organizations · new</span>
  <h1 class="h1-display">Add an <span class="serif-it">organization</span>.</h1>
  <p class="lede">
    For theatres we know exist but aren't already in the system. Saved
    as <strong>manual</strong> by default - the cron leaves manual orgs
    alone. Once Blake has checked whether the org's site is scrape-friendly,
    flip the adapter to "ai-generic" from the list page.
  </p>
  <p class="meta">
    <a href="/admin/organizations">← Back to organizations</a>
  </p>
</header>

{#if errs._form}
  <div class="form-error" role="alert">{errs._form}</div>
{/if}

<form method="POST" action="?/create" class="form">
  <label class="field">
    <span>Name <span class="req">*</span></span>
    <input
      name="name"
      type="text"
      required
      value={v.name ?? ""}
      placeholder="Tacoma Little Theatre"
    />
    <span class="hint">
      The display name. Used everywhere on the site - on /theatres,
      productions linked back to this org, and the calendar.
    </span>
    {#if errs.name}<p class="field-error">{errs.name}</p>{/if}
  </label>

  <div class="field">
    <span class="label">Area <span class="req">*</span></span>
    <div class="chip-row">
      {#each data.areas as a (a.id)}
        <label class="chip" class:on={pickedAreaId === a.id}>
          <input
            type="radio"
            name="area_id"
            value={a.id}
            checked={pickedAreaId === a.id}
            onchange={() => (pickedAreaId = a.id)}
            required
          />
          <span>{a.name}</span>
        </label>
      {/each}
    </div>
    {#if errs.area_id}<p class="field-error">{errs.area_id}</p>{/if}
  </div>

  <label class="field">
    <span>Homepage URL</span>
    <input
      name="homepage_url"
      type="url"
      value={v.homepage_url ?? ""}
      placeholder="https://..."
    />
    <span class="hint">Their main public site. Shown on /theatres.</span>
    {#if errs.homepage_url}<p class="field-error">{errs.homepage_url}</p>{/if}
  </label>

  <label class="field">
    <span>Season list URL</span>
    <input
      name="source_url"
      type="url"
      value={v.source_url ?? ""}
      placeholder="https://example.com/season"
    />
    <span class="hint">
      Where the cron would look for upcoming shows once promoted to
      auto-pull. Optional - can be added later.
    </span>
    {#if errs.source_url}<p class="field-error">{errs.source_url}</p>{/if}
  </label>

  <label class="field">
    <span>Description</span>
    <textarea
      name="description"
      rows="3"
      maxlength="500"
      placeholder="1-2 sentence description shown on /theatres"
    >{v.description ?? ""}</textarea>
    {#if errs.description}<p class="field-error">{errs.description}</p>{/if}
  </label>

  <label class="field">
    <span>Internal notes</span>
    <textarea
      name="notes"
      rows="3"
      placeholder="Hints for Blake: where the schedule lives, any quirks, contact who runs it..."
    >{v.notes ?? ""}</textarea>
    <span class="hint">Admin-only. Never shown publicly.</span>
  </label>

  <div class="actions">
    <button type="submit" class="bt bt-pri">Create organization</button>
  </div>

  <p class="follow-up">
    After saving, you can upload a logo + tweak the public details from
    the <a href="/admin/organizations">organizations list</a> by clicking
    "Edit public details" on the new row.
  </p>
</form>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 720px; margin-bottom: 1.5rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 16px;
    color: var(--muted);
    margin: 0;
    max-width: 60ch;
  }
  .lede strong { color: var(--ink); font-style: normal; font-family: var(--font-mono); font-size: 13px; }
  .meta {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 0.5rem 0 0;
  }
  .meta a { color: var(--accent); }

  .form-error {
    background: color-mix(in oklch, var(--warn), var(--bg) 80%);
    border: 1px solid var(--warn);
    color: var(--warn);
    padding: 0.65rem 0.9rem;
    border-radius: var(--radius);
    margin: 0 0 1rem;
    max-width: 720px;
    font-size: 14px;
  }

  .form { display: flex; flex-direction: column; gap: 1rem; max-width: 720px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field > span,
  .field .label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .req { color: var(--accent); }
  .hint {
    font-family: var(--font-body) !important;
    font-size: 12px !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
    color: var(--muted);
    line-height: 1.45;
  }
  .field-error { font-size: 12px; color: var(--warn); margin: 0; }
  input, textarea {
    padding: 9px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg-raised);
    color: var(--ink);
  }
  textarea { resize: vertical; line-height: 1.5; }
  input:focus, textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }

  .chip-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chip {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 0.35rem 0.85rem;
    font-size: 13px;
    color: var(--ink-soft);
    background: transparent;
    cursor: pointer;
    user-select: none;
    transition: border-color 0.12s, background 0.12s, color 0.12s;
  }
  .chip:hover { border-color: var(--ink); color: var(--ink); }
  .chip-row .chip.on {
    background: var(--ink) !important;
    color: var(--bg);
    border-color: var(--ink);
  }
  .chip input[type="radio"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 1px;
    height: 1px;
  }

  .actions { display: flex; margin-top: 0.5rem; }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 11px 22px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
  }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover { background: var(--accent); }

  .follow-up {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0.25rem 0 0;
    line-height: 1.5;
  }
  .follow-up a { color: var(--accent); }
</style>
