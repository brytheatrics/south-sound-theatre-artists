<script lang="ts">
  import DisciplinePicker from "$lib/components/DisciplinePicker.svelte";
  import HeadshotPlaceholder from "$lib/components/HeadshotPlaceholder.svelte";

  let { data } = $props();

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
  let ageMin = $state(data.filters.ageMin);
  /* svelte-ignore state_referenced_locally */
  let ageMax = $state(data.filters.ageMax);

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
    submitNow();
  }
  function toggleArea(name: string) {
    selectedAreas = toggleSet(selectedAreas, name);
    submitNow();
  }
  function toggleUnion(name: string) {
    selectedUnions = toggleSet(selectedUnions, name);
    submitNow();
  }

  function clearFilters() {
    q = "";
    selectedDisciplines = new Set();
    selectedUnions = new Set();
    selectedAreas = new Set();
    language = "";
    ageMin = "";
    ageMax = "";
    setTimeout(submitNow, 0);
  }

  const activeFilterCount = $derived(
    selectedDisciplines.size +
      selectedUnions.size +
      selectedAreas.size +
      (language ? 1 : 0) +
      (ageMin || ageMax ? 1 : 0) +
      (q ? 1 : 0),
  );
</script>

<svelte:head>
  <title>Directory - South Sound Theatre Artists</title>
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">→</span>Directory</span>
  <h1 class="h1-display">
    {data.total}
    <span class="serif-it">artists</span>.
  </h1>
  <p class="lede">
    Browse, filter, and reach out. No account needed.
  </p>
</header>

<form bind:this={formEl} method="GET" class="filters" aria-label="Filter directory">
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
      {#each data.options.areas as a (a)}
        <label class="chip-label">
          <input
            type="checkbox"
            name="area"
            value={a}
            checked={selectedAreas.has(a)}
            onchange={() => toggleArea(a)}
          />
          <span class="chip" class:on={selectedAreas.has(a)}>{a}</span>
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

  <div class="filter-secondary">
    <label class="ff">
      <span>Language</span>
      <input type="text" name="lang" bind:value={language} placeholder="English" />
    </label>

    <label class="ff">
      <span>Plays age</span>
      <span class="age-row">
        <input type="number" name="ageMin" min="0" max="120" bind:value={ageMin} placeholder="from" />
        <span class="dash" aria-hidden="true">to</span>
        <input type="number" name="ageMax" min="0" max="120" bind:value={ageMax} placeholder="to" />
      </span>
    </label>
  </div>

  <noscript>
    <button type="submit" class="bt bt-pri">Apply filters</button>
  </noscript>
</form>

<hr class="rule sep" />

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
          <HeadshotPlaceholder
            name={p.full_name}
            src={p.headshot_url}
            ratio="3 / 4"
            tone={(i % 4) as 0 | 1 | 2 | 3}
          />
          <div class="meta">
            <span class="name">{p.full_name}</span>
            <span class="disc">
              {p.disciplines.slice(0, 2).join(" · ")}
              {#if p.geographic_area}<span> · {p.geographic_area}</span>{/if}
            </span>
          </div>
        </a>
      </li>
    {/each}
  </ul>
  {#if data.total > data.profiles.length}
    <p class="more-note">
      Showing {data.profiles.length} of {data.total}. Pagination ships in a
      future update.
    </p>
  {/if}
{/if}

<style>
  .hd {
    padding: clamp(2rem, 5vw, 3.5rem) var(--page-pad-x) 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 800px;
  }
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
  .chip {
    display: inline-flex;
    align-items: center;
    padding: 5px 11px;
    border-radius: 100px;
    background: transparent;
    border: 1px solid var(--rule);
    color: var(--ink-soft);
    font-family: var(--font-body);
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    line-height: 1.2;
  }
  .chip:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .chip.on {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
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
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
  }
  .card {
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
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

  .more-note {
    margin: 2rem var(--page-pad-x);
    text-align: center;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  @media (max-width: 1100px) {
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
