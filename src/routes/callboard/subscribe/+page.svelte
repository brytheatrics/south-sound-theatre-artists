<script lang="ts">
  let { data, form } = $props();

  // Local checkbox state. Defaults to "everything selected" since
  // empty selection is interpreted as "no filter / show me all" on
  // the server. We pre-tick everything so the form reads the way a
  // user expects: untick to narrow, leave fully ticked for the
  // default behaviour.
  /* svelte-ignore state_referenced_locally */
  let pickedTypes = $state<Set<string>>(
    new Set(data.postTypes.map((t: { slug: string }) => t.slug)),
  );
  /* svelte-ignore state_referenced_locally */
  let pickedAreas = $state<Set<string>>(
    new Set(data.areas.map((a: { id: string }) => a.id)),
  );

  function toggleType(slug: string) {
    const next = new Set(pickedTypes);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    pickedTypes = next;
  }
  function toggleArea(id: string) {
    const next = new Set(pickedAreas);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    pickedAreas = next;
  }
</script>

<svelte:head>
  <title>Weekly digest signup - SSTA</title>
</svelte:head>

<main class="thanks">
  {#if data.sent}
    <span class="eyebrow"><span class="num">·</span>Almost there</span>
    <h1 class="h1-display">Check <span class="serif-it">your inbox</span>.</h1>
    <p class="lede">
      We just emailed you a confirmation link. Click it and we'll add
      you to the Sunday-evening digest. The note expires harmlessly if
      you ignore it.
    </p>
  {:else}
    <span class="eyebrow"><span class="num">·</span>Subscribe</span>
    <h1 class="h1-display">Weekly <span class="serif-it">digest</span>.</h1>
    <p class="lede">
      One email a week, Sunday evening. New auditions, designer / crew
      calls, and upcoming shows across South Sound theatre.
    </p>

    <form method="POST" class="form">
      <label class="field">
        <span>Email</span>
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          value={(form?.values?.email) ?? ""}
        />
      </label>

      <!-- POST TYPE FILTER: narrows the callboard slice. Untick anything
           you don't want. Leave fully ticked = "all post types". -->
      <fieldset class="field-group">
        <legend>What kinds of opportunities?</legend>
        <p class="group-hint">
          Untick to narrow the callboard slice of your digest. Leaving
          everything ticked means "all kinds."
        </p>
        <div class="check-grid">
          {#each data.postTypes as t (t.slug)}
            <label class="check">
              <input
                type="checkbox"
                name="post_type"
                value={t.slug}
                checked={pickedTypes.has(t.slug)}
                onchange={() => toggleType(t.slug)}
              />
              <span>{t.plural_label ?? t.label}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <!-- AREA FILTER: narrows the calendar productions slice by region.
           Empty = "everywhere". -->
      <fieldset class="field-group">
        <legend>Which areas?</legend>
        <p class="group-hint">
          Applies to the calendar slice (upcoming productions). Untick
          to narrow; leaving everything ticked means "everywhere."
        </p>
        <div class="chip-row">
          {#each data.areas as a (a.id)}
            <label class="chip" class:on={pickedAreas.has(a.id)}>
              <input
                type="checkbox"
                name="area_id"
                value={a.id}
                checked={pickedAreas.has(a.id)}
                onchange={() => toggleArea(a.id)}
              />
              <span>{a.name}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <!-- Honeypot: hidden from users + screen-readers, irresistible to bots. -->
      <label class="hp" aria-hidden="true">
        Website (leave blank): <input type="text" name="website" tabindex="-1" autocomplete="off" />
      </label>

      {#if form?.error}
        <p class="error" role="alert">{form.error}</p>
      {/if}

      <button type="submit" class="bt bt-pri">Subscribe</button>
      <p class="meta">
        We'll send a confirmation email. You can unsubscribe in one
        click any time from the footer of any digest.
      </p>
    </form>
  {/if}
</main>

<style>
  .thanks {
    max-width: 540px;
    margin: 0 auto;
    padding: clamp(2.5rem, 6vw, 4rem) var(--page-pad-x);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .h1-display { margin: 0.25rem 0 0.5rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--muted);
    margin: 0 0 1.5rem;
    max-width: 50ch;
  }
  .form { display: flex; flex-direction: column; gap: 1.25rem; max-width: 460px; }

  .field-group {
    margin: 0;
    padding: 0;
    border: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .field-group legend {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 0;
  }
  .group-hint {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.45;
  }
  .check-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field span {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  input {
    padding: 11px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 15px;
    font-family: var(--font-body);
    background: var(--bg-raised);
    color: var(--ink);
  }
  input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
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
  .error { color: var(--error); margin: 0; font-size: 13px; }
  .meta {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 0.5rem 0 0;
    line-height: 1.5;
  }
</style>
