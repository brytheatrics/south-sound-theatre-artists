<script lang="ts">
  import type { PageData } from "./$types";
  import { renderMarkdownInline } from "$lib/util/markdown";
  import HeadshotPlaceholder from "$lib/components/HeadshotPlaceholder.svelte";
  import DisciplinePicker from "$lib/components/DisciplinePicker.svelte";

  let { data }: { data: PageData } = $props();

  /* svelte-ignore state_referenced_locally */
  let selectedDisciplines = $state<Set<string>>(new Set(data.activeDisciplines));

  let formEl: HTMLFormElement | undefined = $state();

  function submitNow() {
    formEl?.requestSubmit();
  }

  function toggleDiscipline(name: string) {
    const next = new Set(selectedDisciplines);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    selectedDisciplines = next;
    // Defer so Svelte renders the new hidden <input name="d"> before submit.
    setTimeout(submitNow, 0);
  }

  function clearFilters() {
    selectedDisciplines = new Set();
    setTimeout(submitNow, 0);
  }
</script>

<svelte:head>
  <title>Mentorship - South Sound Theatre Artists</title>
  <meta
    name="description"
    content="Find a mentor or be one. Browse South Sound theatre artists offering or seeking mentorship."
  />
</svelte:head>

<header class="masthead">
  <div class="masthead-body">
    <span class="eyebrow"><span class="num">—</span>Mentorship</span>
    <h1 class="h1-display">
      <span class="serif-it">{data.totalOffering}</span> mentoring,
      <span class="serif-it">{data.totalSeeking}</span> learning.
    </h1>
    <p class="lede">{@html renderMarkdownInline(data.lede)}</p>
  </div>
  <div class="masthead-meta">
    <a class="meta-cta" href="/edit-link">Update your profile &rarr;</a>
    <span class="meta-stat">{data.totalOffering + data.totalSeeking} listed</span>
  </div>
</header>

<!-- DISCIPLINE FILTER (accordion, mirrors /directory) -->
{#if data.options.disciplines.length > 0}
  <form
    bind:this={formEl}
    method="GET"
    class="filters"
    aria-label="Filter mentorship listings"
    data-sveltekit-noscroll
    data-sveltekit-replacestate
  >
    <div class="filter-block">
      <div class="block-head">
        <span class="block-label">Filter by discipline</span>
        {#if selectedDisciplines.size > 0}
          <button type="button" class="bt-link" onclick={clearFilters}>
            Clear ({selectedDisciplines.size})
          </button>
        {/if}
      </div>
      <DisciplinePicker
        items={data.options.disciplines}
        categoryOrder={data.options.disciplineCategories}
        selected={selectedDisciplines}
        onToggle={toggleDiscipline}
        inputName="d"
        showOtherInput={false}
      />
    </div>
    <noscript>
      <button type="submit" class="bt bt-pri">Apply filters</button>
    </noscript>
  </form>
{/if}

<div class="cols">
  <!-- MENTORS OFFERING -->
  <section class="col">
    <h2 class="col-h">
      Mentors offering
      <span class="col-count">{data.offering.length}</span>
    </h2>
    {#if data.offering.length === 0}
      <p class="empty-col">
        {data.activeDisciplines.length > 0
          ? "No mentors match this filter yet."
          : "Nobody's offering mentorship in the directory yet. Be the first - update your profile to add disciplines you can mentor in."}
      </p>
    {:else}
      <ul class="tile-list">
        {#each data.offering as p (p.slug)}
          <li class="tile">
            <a class="tile-head" href={`/artists/${p.slug}`}>
              <div class="tile-photo">
                <HeadshotPlaceholder
                  name={p.full_name}
                  src={p.is_minor ? null : p.headshot_url}
                  ratio="1"
                />
              </div>
              <div class="tile-meta">
                <span class="tile-name">
                  {p.full_name}
                  {#if p.pronouns}<span class="tile-pronouns">({p.pronouns})</span>{/if}
                </span>
                <span class="tile-area">
                  {p.city || p.geographic_area || "South Sound"}
                </span>
              </div>
            </a>
            <div class="tile-section">
              <span class="tile-section-label">Can mentor in</span>
              <div class="tile-disc-row">
                {#each p.mentorship_offering as d}
                  <span class="disc-pill">{d}</span>
                {/each}
              </div>
            </div>
            <div class="tile-actions">
              <a class="bt bt-pri" href={`/artists/${p.slug}?contact=1#contact-form`}>
                Contact &rarr;
              </a>
              <a class="bt bt-ghost" href={`/artists/${p.slug}`}>View profile</a>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- LOOKING TO LEARN -->
  <section class="col">
    <h2 class="col-h">
      Looking to learn
      <span class="col-count">{data.seeking.length}</span>
    </h2>
    {#if data.seeking.length === 0}
      <p class="empty-col">
        {data.activeDisciplines.length > 0
          ? "Nobody's seeking mentorship in this discipline right now."
          : "Nobody's seeking mentorship yet. Update your profile to add disciplines you'd like to learn."}
      </p>
    {:else}
      <ul class="tile-list">
        {#each data.seeking as p (p.slug)}
          <li class="tile">
            <a class="tile-head" href={`/artists/${p.slug}`}>
              <div class="tile-photo">
                <HeadshotPlaceholder
                  name={p.full_name}
                  src={p.is_minor ? null : p.headshot_url}
                  ratio="1"
                />
              </div>
              <div class="tile-meta">
                <span class="tile-name">
                  {p.full_name}
                  {#if p.pronouns}<span class="tile-pronouns">({p.pronouns})</span>{/if}
                </span>
                <span class="tile-area">
                  {p.city || p.geographic_area || "South Sound"}
                </span>
              </div>
            </a>
            <div class="tile-section">
              <span class="tile-section-label">Looking to learn</span>
              <div class="tile-disc-row">
                {#each p.mentorship_seeking as d}
                  <span class="disc-pill disc-pill-seeking">{d}</span>
                {/each}
              </div>
            </div>
            <div class="tile-actions">
              <a class="bt bt-pri" href={`/artists/${p.slug}?contact=1#contact-form`}>
                Contact &rarr;
              </a>
              <a class="bt bt-ghost" href={`/artists/${p.slug}`}>View profile</a>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  /* MASTHEAD - mirrors callboard / calendar / theatres */
  .masthead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    padding: clamp(2.5rem, 6vw, 3.5rem) var(--page-pad-x) 2rem;
    border-bottom: 1px solid var(--rule);
    flex-wrap: wrap;
  }
  .masthead-body { flex: 1; min-width: 260px; }
  .h1-display {
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    letter-spacing: -0.04em;
    line-height: 0.95;
    margin: 0.75rem 0 0;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: clamp(16px, 2vw, 18px);
    color: var(--muted);
    line-height: 1.5;
    margin: 1.25rem 0 0;
    max-width: 580px;
  }
  .masthead-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.4rem;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    padding-top: 0.5rem;
    min-width: 160px;
  }
  .meta-cta {
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
  }
  .meta-cta:hover { text-decoration: underline; }
  .meta-stat { color: var(--ink-soft); }

  /* FILTER FORM - mirrors /directory layout + accordion picker */
  .filters {
    padding: 1.25rem var(--page-pad-x);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-width: calc(900px + var(--page-pad-x) * 2);
    border-bottom: 1px solid var(--rule-soft);
  }
  .filter-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .block-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
  }
  .block-label {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .bt-link {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-soft);
  }
  .bt-link:hover { color: var(--accent); }

  /* TWO COLUMNS - side-by-side at desktop, stacked on mobile */
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
  .col {
    padding: 1.5rem var(--page-pad-x);
  }
  .col + .col {
    border-left: 1px solid var(--rule-soft);
  }
  .col-h {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin: 0 0 1.25rem;
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink);
    font-weight: 600;
  }
  .col-count {
    color: var(--muted);
    font-weight: 400;
  }
  .empty-col {
    color: var(--muted);
    font-size: 14px;
    line-height: 1.55;
    font-style: italic;
    padding: 1rem 0;
    margin: 0;
  }

  /* TILES */
  .tile-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }
  .tile {
    padding: 1rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    transition: border-color 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .tile:hover {
    border-color: var(--ink-soft);
  }
  .tile-head {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    text-decoration: none;
    color: inherit;
  }
  .tile-head:hover {
    text-decoration: none;
  }
  .tile-photo {
    flex: 0 0 56px;
    width: 56px;
    height: 56px;
    border-radius: var(--radius);
    overflow: hidden;
  }
  .tile-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .tile-name {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.2;
  }
  .tile-name:hover { color: var(--accent); }
  .tile-pronouns {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    font-weight: 400;
    margin-left: 0.3rem;
  }
  .tile-area {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .tile-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .tile-section-label {
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .tile-disc-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .disc-pill {
    display: inline-block;
    padding: 3px 9px;
    background: color-mix(in oklch, var(--accent), var(--bg) 88%);
    border: 1px solid color-mix(in oklch, var(--accent), var(--bg) 70%);
    color: var(--ink);
    border-radius: 100px;
    font-size: 12px;
    font-weight: 500;
  }
  .disc-pill-seeking {
    background: color-mix(in oklch, var(--warn), var(--bg) 90%);
    border-color: color-mix(in oklch, var(--warn), var(--bg) 70%);
  }
  .tile-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.25rem;
  }
  .tile-actions .bt {
    font-size: 12px;
    padding: 6px 12px;
  }

  @media (max-width: 880px) {
    .cols {
      grid-template-columns: 1fr;
    }
    .col + .col {
      border-left: 0;
      border-top: 1px solid var(--rule-soft);
    }
  }
</style>
