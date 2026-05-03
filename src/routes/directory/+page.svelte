<script lang="ts">
  import { page as pageState } from "$app/state";
  import DisciplinePicker from "$lib/components/DisciplinePicker.svelte";
  import HeadshotPlaceholder from "$lib/components/HeadshotPlaceholder.svelte";
  import MentorshipDots from "$lib/components/MentorshipDots.svelte";
  import { renderMarkdownInline } from "$lib/util/markdown";

  let { data } = $props();

  // Build a URL that preserves every active filter / sort param but
  // sets ?page= to a target value. Used by the pagination links.
  function pageHref(target: number): string {
    const sp = new URLSearchParams(pageState.url.searchParams);
    sp.delete("page");
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `?${qs}` : "/directory";
  }

  // Compact page list: always show first, last, current ± 1, plus "..."
  // gaps. Keeps the bar reasonable at 100+ pages.
  function pageList(current: number, total: number): Array<number | "gap"> {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out: Array<number | "gap"> = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) out.push("gap");
    for (let i = start; i <= end; i++) out.push(i);
    if (end < total - 1) out.push("gap");
    out.push(total);
    return out;
  }

  /* svelte-ignore state_referenced_locally */
  let q = $state(data.filters.q);
  /* svelte-ignore state_referenced_locally */
  let selectedDisciplines = $state<Set<string>>(new Set(data.filters.disciplines));
  /* svelte-ignore state_referenced_locally */
  let selectedUnions = $state<Set<string>>(new Set(data.filters.unions));
  /* svelte-ignore state_referenced_locally */
  let selectedAreas = $state<Set<string>>(new Set(data.filters.areas));
  /* svelte-ignore state_referenced_locally */
  let language = $state(data.filters.language);
  /* svelte-ignore state_referenced_locally */
  let hasHeadshot = $state(data.filters.hasHeadshot);
  /* svelte-ignore state_referenced_locally */
  let mentoring = $state(data.filters.mentoring);
  /* svelte-ignore state_referenced_locally */
  let learning = $state(data.filters.learning);
  /* svelte-ignore state_referenced_locally */
  let ageMin = $state(data.filters.ageMin);
  /* svelte-ignore state_referenced_locally */
  let ageMax = $state(data.filters.ageMax);
  /* svelte-ignore state_referenced_locally */
  let sort = $state(data.filters.sort);

  const sortOptions = [
    { value: "newest", label: "Newest members" },
    { value: "updated", label: "Recently updated" },
    { value: "name", label: "Last name A-Z" },
  ] as const;

  let formEl: HTMLFormElement | undefined = $state();

  function toggleSet(set: Set<string>, value: string): Set<string> {
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return new Set(set);
  }

  function submitNow() {
    formEl?.requestSubmit();
  }

  function toggleDiscipline(name: string) {
    selectedDisciplines = toggleSet(selectedDisciplines, name);
    // Defer so Svelte renders the new hidden <input name="d"> before submit.
    setTimeout(submitNow, 0);
  }
  function toggleArea(name: string) {
    selectedAreas = toggleSet(selectedAreas, name);
    submitNow();
  }
  function toggleUnion(name: string) {
    selectedUnions = toggleSet(selectedUnions, name);
    submitNow();
  }
  function toggleHeadshot() {
    hasHeadshot = !hasHeadshot;
    submitNow();
  }
  function toggleMentoring() {
    mentoring = !mentoring;
    submitNow();
  }
  function toggleLearning() {
    learning = !learning;
    submitNow();
  }
  function setSort(value: typeof sortOptions[number]["value"]) {
    sort = value;
    // Defer so the hidden <input name="sort"> rerenders before submit.
    setTimeout(submitNow, 0);
  }

  function clearFilters() {
    q = "";
    selectedDisciplines = new Set();
    selectedUnions = new Set();
    selectedAreas = new Set();
    language = "";
    hasHeadshot = false;
    mentoring = false;
    learning = false;
    ageMin = "";
    ageMax = "";
    setTimeout(submitNow, 0);
  }

  const activeFilterCount = $derived(
    selectedDisciplines.size +
      selectedUnions.size +
      selectedAreas.size +
      (language ? 1 : 0) +
      (hasHeadshot ? 1 : 0) +
      (mentoring ? 1 : 0) +
      (learning ? 1 : 0) +
      (ageMin || ageMax ? 1 : 0) +
      (q ? 1 : 0),
  );
</script>

<svelte:head>
  <title>Directory - South Sound Theatre Artists</title>
</svelte:head>

<header class="hd">
  <div class="hd-body">
    <span class="eyebrow"><span class="num">→</span>Directory</span>
    <h1 class="h1-display">
      {data.total}
      <span class="serif-it">artists</span>.
    </h1>
    <p class="lede">{@html renderMarkdownInline(data.lede)}</p>
  </div>
  <div class="hd-meta">
    <a class="meta-cta" href="/submit">Submit your profile &rarr;</a>
    <span class="meta-stat">{data.total} listed</span>
  </div>
</header>

<form
  bind:this={formEl}
  method="GET"
  class="filters"
  aria-label="Filter directory"
  data-sveltekit-noscroll
  data-sveltekit-replacestate
>
  <div class="search-row">
    <input
      type="search"
      name="q"
      placeholder="Search by name..."
      bind:value={q}
      onkeydown={(e) => e.key === "Enter" && submitNow()}
      class="search"
    />
    <button type="submit" class="bt bt-pri">Search</button>
    {#if activeFilterCount > 0}
      <button type="button" class="bt bt-ghost" onclick={clearFilters}>
        Clear ({activeFilterCount})
      </button>
    {/if}
  </div>

  <div class="filter-block">
    <span class="block-label">Discipline</span>
    {#if mentoring && learning}
      <span class="block-hint">
        Filtering by disciplines artists are interested in mentoring or learning.
      </span>
    {:else if mentoring}
      <span class="block-hint">
        Filtering by disciplines artists can <strong>mentor in</strong>.
      </span>
    {:else if learning}
      <span class="block-hint">
        Filtering by disciplines artists <strong>want to learn</strong>.
      </span>
    {/if}
    <DisciplinePicker
      items={data.options.disciplines}
      categoryOrder={data.options.disciplineCategories}
      selected={selectedDisciplines}
      onToggle={toggleDiscipline}
      inputName="d"
      showOtherInput={false}
    />
  </div>

  <div class="filter-block">
    <span class="block-label">Area</span>
    <div class="chip-row">
      {#each data.options.areas as a (a.name)}
        <label class="chip-label" title={a.description ?? ""}>
          <input
            type="checkbox"
            name="area"
            value={a.name}
            checked={selectedAreas.has(a.name)}
            onchange={() => toggleArea(a.name)}
          />
          <span class="chip" class:on={selectedAreas.has(a.name)}>{a.name}</span>
        </label>
      {/each}
    </div>
  </div>

  <div class="filter-block">
    <span class="block-label">Union</span>
    <div class="chip-row">
      {#each data.options.unions as u (u)}
        <label class="chip-label">
          <input
            type="checkbox"
            name="u"
            value={u}
            checked={selectedUnions.has(u)}
            onchange={() => toggleUnion(u)}
          />
          <span class="chip" class:on={selectedUnions.has(u)}>{u}</span>
        </label>
      {/each}
    </div>
  </div>

  <div class="filter-block">
    <span class="block-label">Show only</span>
    <div class="chip-row">
      <label class="chip-label">
        <input
          type="checkbox"
          name="headshot"
          value="1"
          checked={hasHeadshot}
          onchange={toggleHeadshot}
        />
        <span class="chip" class:on={hasHeadshot}>Has headshot</span>
      </label>
      <label class="chip-label">
        <input
          type="checkbox"
          name="mentoring"
          value="1"
          checked={mentoring}
          onchange={toggleMentoring}
        />
        <span class="chip" class:on={mentoring}>Open to mentoring</span>
      </label>
      <label class="chip-label">
        <input
          type="checkbox"
          name="learning"
          value="1"
          checked={learning}
          onchange={toggleLearning}
        />
        <span class="chip" class:on={learning}>Looking to learn</span>
      </label>
    </div>
  </div>

  <div class="filter-secondary">
    <label class="ff">
      <span>Language</span>
      <input
        type="text"
        name="lang"
        bind:value={language}
        placeholder="English"
        onkeydown={(e) => e.key === "Enter" && submitNow()}
      />
    </label>

    <label class="ff">
      <span>Playable age</span>
      <span class="age-row">
        <input
          type="number"
          name="ageMin"
          min="0"
          max="120"
          bind:value={ageMin}
          placeholder="from"
          onkeydown={(e) => e.key === "Enter" && submitNow()}
        />
        <span class="dash" aria-hidden="true">to</span>
        <input
          type="number"
          name="ageMax"
          min="0"
          max="120"
          bind:value={ageMax}
          placeholder="to"
          onkeydown={(e) => e.key === "Enter" && submitNow()}
        />
      </span>
    </label>
  </div>

  <input type="hidden" name="sort" value={sort} />

  <noscript>
    <button type="submit" class="bt bt-pri">Apply filters</button>
  </noscript>
</form>

<hr class="rule sep" />

<div class="sort-row" aria-label="Sort">
  <span class="sort-label">Sort</span>
  <div class="chip-row">
    {#each sortOptions as opt (opt.value)}
      <button
        type="button"
        class="chip"
        class:on={sort === opt.value}
        onclick={() => setSort(opt.value)}
      >
        {opt.label}
      </button>
    {/each}
  </div>
</div>

{#if data.profiles.length === 0}
  <p class="empty">
    <span class="eyebrow"><span class="num">·</span>No matches</span>
    <span class="serif-it line">It's quiet here · for now.</span>
    Try clearing filters or
    <a href="/submit">submitting your profile</a>.
  </p>
{:else}
  <ul class="grid">
    {#each data.profiles as p, i (p.slug)}
      <li>
        <a class="card" href={`/artists/${p.slug}`}>
          <div class="card-img">
            <HeadshotPlaceholder
              name={p.full_name}
              src={p.headshot_url}
              ratio="3 / 4"
              tone={(i % 4) as 0 | 1 | 2 | 3}
            />
            <MentorshipDots
              offering={p.mentorship_offering ?? []}
              seeking={p.mentorship_seeking ?? []}
            />
          </div>
          <div class="meta">
            <span class="name">{p.full_name}</span>
            <span class="disc">
              {p.disciplines.slice(0, 2).join(" · ")}
              {#if p.city || p.geographic_area}
                <span> · {p.city || p.geographic_area}</span>
              {/if}
            </span>
            {#if p.playable_age_min != null && p.playable_age_max != null}
              <span class="age">Plays {p.playable_age_min}-{p.playable_age_max}</span>
            {/if}
          </div>
        </a>
      </li>
    {/each}
  </ul>
  {#if data.totalPages > 1}
    <nav class="pagination" aria-label="Pagination">
      <a
        class="pg-arrow"
        class:disabled={data.page <= 1}
        href={data.page > 1 ? pageHref(data.page - 1) : undefined}
        aria-disabled={data.page <= 1}
        rel="prev"
      >
        ← Prev
      </a>

      <ul class="pg-list">
        {#each pageList(data.page, data.totalPages) as item}
          {#if item === "gap"}
            <li class="pg-gap" aria-hidden="true">…</li>
          {:else}
            <li>
              <a
                href={pageHref(item)}
                class="pg-num"
                class:on={item === data.page}
                aria-current={item === data.page ? "page" : undefined}
              >
                {item}
              </a>
            </li>
          {/if}
        {/each}
      </ul>

      <a
        class="pg-arrow"
        class:disabled={data.page >= data.totalPages}
        href={data.page < data.totalPages ? pageHref(data.page + 1) : undefined}
        aria-disabled={data.page >= data.totalPages}
        rel="next"
      >
        Next →
      </a>
    </nav>
    <p class="pg-count">
      Showing {(data.page - 1) * data.pageSize + 1}-{Math.min(
        data.page * data.pageSize,
        data.total,
      )} of {data.total}
    </p>
  {/if}
{/if}

{#if (ageMin || ageMax) && data.noAgeCount > 0}
  <p class="exclusion-note">
    {data.noAgeCount}
    {data.noAgeCount === 1 ? "artist hasn't" : "artists haven't"}
    set a playable-age range and
    {data.noAgeCount === 1 ? "isn't" : "aren't"}
    shown when an age filter is on.
  </p>
{/if}

<style>
  .hd {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    padding: clamp(2.5rem, 6vw, 3.5rem) var(--page-pad-x) 1.5rem;
    flex-wrap: wrap;
  }
  .hd-body {
    flex: 1;
    min-width: 260px;
    max-width: 800px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .hd-meta {
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
  .h1-display {
    margin: 0.5rem 0 0.25rem;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--muted);
    margin: 0;
  }

  .filters {
    padding: 0 var(--page-pad-x);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-width: calc(900px + var(--page-pad-x) * 2);
  }
  .search-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
    flex-wrap: wrap;
  }
  .search {
    flex: 1;
    min-width: 220px;
    padding: 10px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 14px;
    font-family: var(--font-body);
    background: var(--bg-raised);
  }
  .search:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 9px 18px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .bt-pri {
    background: var(--ink);
    color: var(--bg);
  }
  .bt-pri:hover {
    background: var(--accent);
  }
  .bt-ghost {
    background: transparent;
    color: var(--ink);
    border-color: var(--rule);
  }
  .bt-ghost:hover {
    border-color: var(--ink);
  }

  .filter-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .block-label {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .block-hint {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 13px;
    color: var(--ink-soft);
    margin: -4px 0 4px;
  }
  .block-hint strong {
    font-weight: 600;
    font-style: normal;
    color: var(--ink);
  }
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip-label input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  /* Base .chip / .chip:hover / .chip.on come from app.css (shared
     across /calendar, /directory, /callboard). Only directory-specific
     bits stay here. */
  .chip-label input:focus-visible + .chip {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .filter-secondary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }
  .ff {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ff > span:first-child {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .ff input {
    padding: 8px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 14px;
    font-family: var(--font-body);
    background: var(--bg-raised);
  }
  .ff input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .age-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .age-row input {
    flex: 1;
    min-width: 0;
  }
  .age-row .dash {
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .sep {
    margin: 2rem var(--page-pad-x);
  }

  .sort-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 var(--page-pad-x);
    margin: -1rem 0 1.5rem;
    flex-wrap: wrap;
  }
  .sort-label {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .sort-row .chip {
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--rule);
    color: var(--ink-soft);
    font-family: var(--font-body);
    font-size: 12px;
    padding: 5px 11px;
    border-radius: 100px;
  }
  .sort-row .chip:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .sort-row .chip.on {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }

  .empty {
    padding: 4rem var(--page-pad-x);
    text-align: center;
    color: var(--muted);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.7;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }
  .empty .line {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 22px;
    color: var(--accent);
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0 var(--page-pad-x);
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 1.25rem;
  }
  .card {
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  /* Wraps the headshot so MentorshipDots can absolutely-position itself
     in the corner of the image (not the whole card). */
  .card-img {
    position: relative;
  }
  .card:hover {
    text-decoration: none;
  }
  .card:hover .name {
    color: var(--accent);
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(16px, 1.4vw, 18px);
    color: var(--ink);
    letter-spacing: -0.01em;
    transition: color 0.15s;
  }
  .disc {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.3;
  }
  .age {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin-top: 0.1rem;
  }

  .pagination {
    margin: 2.5rem var(--page-pad-x) 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .pg-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .pg-num,
  .pg-arrow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 36px;
    padding: 0 10px;
    border-radius: var(--radius);
    border: 1px solid var(--rule);
    background: var(--bg-raised);
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink-soft);
    text-decoration: none;
  }
  .pg-num:hover,
  .pg-arrow:hover {
    border-color: var(--ink);
    color: var(--ink);
    text-decoration: none;
  }
  .pg-num.on {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  .pg-arrow.disabled {
    pointer-events: none;
    opacity: 0.4;
  }
  .pg-gap {
    color: var(--muted);
    padding: 0 4px;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .pg-count {
    margin: 0.5rem var(--page-pad-x) 1rem;
    text-align: center;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .exclusion-note {
    margin: 1.5rem var(--page-pad-x);
    text-align: center;
    color: var(--muted);
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 14px;
    line-height: 1.5;
  }

  @media (max-width: 1400px) {
    .grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }
  @media (max-width: 1180px) {
    .grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  @media (max-width: 960px) {
    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 460px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
