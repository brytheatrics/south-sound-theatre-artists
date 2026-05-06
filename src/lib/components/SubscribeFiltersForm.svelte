<script lang="ts">
  // Shared filter form for the weekly digest. Used both at signup
  // (/callboard/subscribe) and when editing existing preferences
  // (/callboard/subscribe/manage/[token]). Differs only in the action
  // URL + the cosmetic header copy.
  //
  // Filter convention: an empty Set on submit means "no filter / give
  // me everything in this dimension, including future admin-added
  // options." Pre-tick everything by default at signup so a casual
  // signup gets the firehose; on the manage page the parent passes in
  // the subscriber's current explicit picks (or fully-ticked sets if
  // they're firehose subscribers).

  type Option<T> = { id?: string; slug?: string; label?: string; name?: string; plural_label?: string };
  type Mode = "new" | "manage";

  type Props = {
    mode: Mode;
    actionUrl?: string;
    postTypes: Array<{ slug: string; label: string; plural_label?: string | null }>;
    callboardAreas: Array<{ id: string; name: string }>;
    categories: Array<{ id: string; name: string }>;
    calendarAreas: Array<{ id: string; name: string }>;
    initialPickedTypes: Set<string>;
    initialPickedCallboardAreas: Set<string>;
    initialPickedCategories: Set<string>;
    initialPickedCalendarAreas: Set<string>;
    initialEmail?: string;
    formError?: string;
    saved?: boolean;
  };

  let {
    mode,
    actionUrl,
    postTypes,
    callboardAreas,
    categories,
    calendarAreas,
    initialPickedTypes,
    initialPickedCallboardAreas,
    initialPickedCategories,
    initialPickedCalendarAreas,
    initialEmail = "",
    formError,
    saved,
  }: Props = $props();

  /* svelte-ignore state_referenced_locally */
  let pickedTypes = $state<Set<string>>(new Set(initialPickedTypes));
  /* svelte-ignore state_referenced_locally */
  let pickedCallboardAreas = $state<Set<string>>(new Set(initialPickedCallboardAreas));
  /* svelte-ignore state_referenced_locally */
  let pickedCategories = $state<Set<string>>(new Set(initialPickedCategories));
  /* svelte-ignore state_referenced_locally */
  let pickedCalendarAreas = $state<Set<string>>(new Set(initialPickedCalendarAreas));

  function toggle(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  // Quick "select all" / "select none" affordances per section so
  // narrow / broad jumps don't require clicking each chip.
  function setAll<T extends { id?: string; slug?: string }>(
    items: T[],
    keyOf: (t: T) => string,
  ): Set<string> {
    return new Set(items.map(keyOf));
  }
</script>

<form method="POST" action={actionUrl ?? ""} class="filter-form">
  {#if mode === "new"}
    <label class="email-field">
      <span>Email</span>
      <input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        value={initialEmail}
      />
    </label>
  {/if}

  <!-- OPPORTUNITIES (callboard) -->
  <fieldset class="dim">
    <legend class="dim-title">Opportunities (callboard)</legend>

    <div class="sub">
      <div class="sub-head">
        <span class="sub-label">Post types</span>
        <span class="sub-actions">
          <button type="button" class="bt-text" onclick={() => (pickedTypes = setAll(postTypes, (t) => t.slug))}>All</button>
          <button type="button" class="bt-text" onclick={() => (pickedTypes = new Set())}>None</button>
        </span>
      </div>
      <div class="check-grid">
        {#each postTypes as t (t.slug)}
          <label class="check">
            <input
              type="checkbox"
              name="post_type"
              value={t.slug}
              checked={pickedTypes.has(t.slug)}
              onchange={() => (pickedTypes = toggle(pickedTypes, t.slug))}
            />
            <span>{t.plural_label ?? t.label}</span>
          </label>
        {/each}
      </div>
    </div>

    <div class="sub">
      <div class="sub-head">
        <span class="sub-label">Areas</span>
        <span class="sub-actions">
          <button type="button" class="bt-text" onclick={() => (pickedCallboardAreas = setAll(callboardAreas, (a) => a.id))}>All</button>
          <button type="button" class="bt-text" onclick={() => (pickedCallboardAreas = new Set())}>None</button>
        </span>
      </div>
      <div class="chip-row">
        {#each callboardAreas as a (a.id)}
          <label class="chip" class:on={pickedCallboardAreas.has(a.id)}>
            <input
              type="checkbox"
              name="callboard_area_id"
              value={a.id}
              checked={pickedCallboardAreas.has(a.id)}
              onchange={() => (pickedCallboardAreas = toggle(pickedCallboardAreas, a.id))}
            />
            <span>{a.name}</span>
          </label>
        {/each}
      </div>
    </div>
  </fieldset>

  <!-- SHOWS (calendar) -->
  <fieldset class="dim">
    <legend class="dim-title">Shows (calendar)</legend>

    {#if categories.length > 0}
      <div class="sub">
        <div class="sub-head">
          <span class="sub-label">Categories</span>
          <span class="sub-actions">
            <button type="button" class="bt-text" onclick={() => (pickedCategories = setAll(categories, (c) => c.id))}>All</button>
            <button type="button" class="bt-text" onclick={() => (pickedCategories = new Set())}>None</button>
          </span>
        </div>
        <div class="check-grid">
          {#each categories as c (c.id)}
            <label class="check">
              <input
                type="checkbox"
                name="calendar_category_id"
                value={c.id}
                checked={pickedCategories.has(c.id)}
                onchange={() => (pickedCategories = toggle(pickedCategories, c.id))}
              />
              <span>{c.name}</span>
            </label>
          {/each}
        </div>
      </div>
    {/if}

    <div class="sub">
      <div class="sub-head">
        <span class="sub-label">Areas</span>
        <span class="sub-actions">
          <button type="button" class="bt-text" onclick={() => (pickedCalendarAreas = setAll(calendarAreas, (a) => a.id))}>All</button>
          <button type="button" class="bt-text" onclick={() => (pickedCalendarAreas = new Set())}>None</button>
        </span>
      </div>
      <div class="chip-row">
        {#each calendarAreas as a (a.id)}
          <label class="chip" class:on={pickedCalendarAreas.has(a.id)}>
            <input
              type="checkbox"
              name="calendar_area_id"
              value={a.id}
              checked={pickedCalendarAreas.has(a.id)}
              onchange={() => (pickedCalendarAreas = toggle(pickedCalendarAreas, a.id))}
            />
            <span>{a.name}</span>
          </label>
        {/each}
      </div>
    </div>
  </fieldset>

  {#if mode === "new"}
    <!-- Honeypot only matters for new signups; manage flow is token-gated. -->
    <label class="hp" aria-hidden="true">
      Website (leave blank): <input type="text" name="website" tabindex="-1" autocomplete="off" />
    </label>
  {/if}

  {#if formError}
    <p class="error" role="alert">{formError}</p>
  {/if}
  {#if saved}
    <p class="ok" role="status">Saved. Your next digest will reflect these filters.</p>
  {/if}

  <button type="submit" class="bt bt-pri">
    {mode === "new" ? "Subscribe" : "Save preferences"}
  </button>

  <p class="meta">
    Tick everything in a section to mean "send me the firehose, including
    things admin adds in the future." Untick to narrow.
    {#if mode === "new"}
      We'll send a confirmation email; you'll need to click the link before
      anything starts arriving.
    {/if}
  </p>
</form>

<style>
  .filter-form { display: flex; flex-direction: column; gap: 1.5rem; max-width: 520px; }

  .email-field { display: flex; flex-direction: column; gap: 6px; max-width: 420px; }
  .email-field span {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .email-field input {
    padding: 11px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 15px;
    font-family: var(--font-body);
    background: var(--bg-raised);
    color: var(--ink);
  }
  .email-field input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }

  .dim {
    margin: 0;
    padding: 1rem 1.1rem 1.1rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .dim-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    padding: 0 0.4rem;
  }

  .sub { display: flex; flex-direction: column; gap: 0.45rem; }
  .sub-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .sub-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .sub-actions { display: flex; gap: 0.35rem; }
  .bt-text {
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    text-decoration: underline;
  }
  .bt-text:hover { color: var(--ink); }

  .check-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 0.4rem 0.75rem;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }
  .check input[type="checkbox"] { accent-color: var(--accent); }

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
  .chip.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .chip input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 1px;
    height: 1px;
  }

  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .error { color: var(--error); margin: 0; font-size: 13px; }
  .ok {
    color: var(--accent);
    margin: 0;
    font-size: 14px;
    padding: 0.5rem 0.85rem;
    background: color-mix(in oklch, var(--accent), var(--bg) 88%);
    border-radius: var(--radius);
    border: 1px solid var(--accent);
  }

  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 11px 20px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    align-self: flex-start;
  }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover { background: var(--accent); }

  .meta {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 0;
    line-height: 1.5;
  }
</style>
