<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // ---- URL state helper ------------------------------------------
  function buildUrl(overrides: Record<string, string | null>) {
    const base: Record<string, string | null> = {
      month: data.monthIso,
      view: data.view === "list" ? "list" : null,
      cats: serializeCats(data.activeCats, data.categories),
      areas: serializeAreas(data.activeAreas, data.areas),
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return "/calendar" + (s ? "?" + s : "");
  }

  // Only serialise cats if they differ from the default-visible set.
  function serializeCats(active: string[], cats: PageData["categories"]) {
    const defaultActive = cats.filter((c) => c.default_visible).map((c) => c.slug).sort();
    const a = [...active].sort();
    if (
      defaultActive.length === a.length &&
      defaultActive.every((s, i) => s === a[i])
    ) {
      return null;
    }
    return a.join(",");
  }

  function toggleCat(slug: string) {
    const set = new Set(data.activeCats);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    return Array.from(set);
  }

  // Areas: null = show all (default). Empty array = show none. A list of
  // names = filter to those.
  function serializeAreas(active: string[] | null, all: PageData["areas"]) {
    if (active === null) return null; // show all
    if (active.length === 0) return null; // empty also collapses to all
    if (active.length === all.length) return null; // selecting all = no filter
    return active.join(",");
  }

  function toggleArea(name: string): string[] | null {
    // If null (show-all), clicking a chip means "filter to just that area"
    // — but functionally we treat "everything except this one off" as
    // unintuitive, so a single-click flips into single-area mode.
    const allNames = data.areas.map((a) => a.name);
    const current = data.activeAreas ?? allNames;
    const set = new Set(current);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    if (set.size === 0) return []; // explicitly empty -> server treats as "show all"
    if (set.size === allNames.length) return null; // all selected -> show all
    return Array.from(set);
  }

  // For chip "on" rendering: a chip is on when areas filter is null
  // (everything visible) OR when its name is in the active list.
  function areaIsOn(name: string): boolean {
    if (data.activeAreas === null) return true;
    return data.activeAreas.includes(name);
  }

  // ---- Pacific-time helpers --------------------------------------
  // Performances are stored UTC. We display + bucket in Pacific.
  function pacificDateKey(utcIso: string): string {
    const d = new Date(utcIso);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const day = parts.find((p) => p.type === "day")!.value;
    return `${y}-${m}-${day}`;
  }

  function fmtTime(utcIso: string): string {
    return new Date(utcIso).toLocaleTimeString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function fmtDateLong(dateKey: string): string {
    // dateKey is YYYY-MM-DD in Pacific. Use noon-Z to avoid TZ slippage
    // when feeding into Intl.DateTimeFormat for the day-of-week label.
    const d = new Date(`${dateKey}T20:00:00Z`); // noon Pacific in summer
    return d.toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  // ---- Bucket performances by Pacific date -----------------------
  const byDate = $derived.by(() => {
    const m = new Map<string, typeof data.performances>();
    for (const p of data.performances) {
      const key = pacificDateKey(p.performs_at);
      const arr = m.get(key) ?? [];
      arr.push(p);
      m.set(key, arr);
    }
    return m;
  });

  // ---- Calendar grid: array of cells (dates) ---------------------
  // Build a 6-row × 7-col grid spanning the visible month plus pad
  // days from prev/next months to fill the rectangle.
  const gridCells = $derived.by(() => {
    const [y, m] = data.monthIso.split("-").map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    const dowFirst = monthStart.getUTCDay(); // 0=Sun
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

    const cells: Array<{ key: string; day: number; inMonth: boolean }> = [];
    // Pad before
    for (let i = dowFirst - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1, -i));
      cells.push({
        key: pacificDateKeyFromUTC(d),
        day: d.getUTCDate(),
        inMonth: false,
      });
    }
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(Date.UTC(y, m - 1, day));
      cells.push({
        key: pacificDateKeyFromUTC(d),
        day,
        inMonth: true,
      });
    }
    // Pad after to fill 6 rows = 42 cells
    while (cells.length < 42) {
      const last = cells[cells.length - 1];
      const [yy, mm, dd] = last.key.split("-").map(Number);
      const next = new Date(Date.UTC(yy, mm - 1, dd + 1));
      cells.push({
        key: pacificDateKeyFromUTC(next),
        day: next.getUTCDate(),
        inMonth: false,
      });
    }
    return cells;
  });

  function pacificDateKeyFromUTC(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  // Today's key in Pacific Time. Use the same Intl-based conversion as
  // performance bucketing so the highlight always agrees with which
  // cell a "today" performance falls into.
  const todayKey = $derived(pacificDateKey(new Date().toISOString()));

  const sortedDateKeys = $derived(
    Array.from(byDate.keys()).sort(),
  );
</script>

<svelte:head>
  <title>What's Playing - South Sound Theatre Artists</title>
  <meta
    name="description"
    content="Calendar of upcoming plays, musicals, staged readings, and theatre events across the South Sound."
  />
</svelte:head>

<!-- MASTHEAD -->
<header class="masthead">
  <div class="masthead-body">
    <span class="eyebrow"><span class="num">—</span>What's Playing</span>
    <h1 class="h1-display">
      <span class="serif-it">{data.totalUpcoming}</span> upcoming
      {data.totalUpcoming === 1 ? "performance" : "performances"},<br />
      across the South Sound.
    </h1>
    <p class="lede">
      Plays, musicals, staged readings, and special events. Dates can change —
      please confirm with the theatre's website before heading out.
    </p>
  </div>
  <div class="masthead-meta">
    <a class="meta-cta" href="/calendar/submit">Post a performance &rarr;</a>
    <span class="meta-stat">{data.totalUpcoming} upcoming</span>
  </div>
</header>

<!-- CATEGORY FILTER STRIP -->
<div class="filter-strip" data-sveltekit-noscroll data-sveltekit-replacestate>
  <span class="filter-label eyebrow">Show</span>
  {#each data.categories as cat (cat.slug)}
    <a
      class="chip"
      class:on={data.activeCats.includes(cat.slug)}
      href={buildUrl({ cats: serializeCats(toggleCat(cat.slug), data.categories) })}
    >
      {cat.name}
    </a>
  {/each}
</div>

<!-- AREA FILTER STRIP -->
<div class="filter-strip" data-sveltekit-noscroll data-sveltekit-replacestate>
  <span class="filter-label eyebrow">Area</span>
  {#each data.areas as area (area.id)}
    <a
      class="chip"
      class:on={areaIsOn(area.name)}
      href={buildUrl({ areas: serializeAreas(toggleArea(area.name), data.areas) })}
    >
      {area.name}
    </a>
  {/each}
  {#if data.activeAreas !== null}
    <a
      class="chip chip-clear"
      href={buildUrl({ areas: null })}
      title="Show all areas"
    >
      Show all
    </a>
  {/if}
</div>

<!-- SECONDARY: month nav + view toggle -->
<div class="secondary-row" data-sveltekit-noscroll data-sveltekit-replacestate>
  <div class="month-nav">
    <a class="nav-btn" href={buildUrl({ month: data.prevMonthIso })} aria-label="Previous month">‹</a>
    <span class="month-label">{data.monthLabel}</span>
    <a class="nav-btn" href={buildUrl({ month: data.nextMonthIso })} aria-label="Next month">›</a>
  </div>

  <div class="view-group">
    <span class="secondary-label">View</span>
    <a
      class="view-btn"
      class:on={data.view === "grid"}
      href={buildUrl({ view: null })}
      title="Calendar grid view"
    >
      ▦ Calendar
    </a>
    <a
      class="view-btn"
      class:on={data.view === "list"}
      href={buildUrl({ view: "list" })}
      title="Chronological list view"
    >
      ≡ List
    </a>
  </div>
</div>

{#if data.performances.length === 0}
  <div class="empty">
    <p>No performances match your filters this month.</p>
    {#if data.activeCats.length < data.categories.length}
      <a class="bt bt-ghost" href={buildUrl({ cats: data.categories.map(c => c.slug).join(",") })}>
        Show all categories
      </a>
    {/if}
  </div>
{:else}
  <!-- GRID VIEW (also auto-replaced by list on mobile via CSS) -->
  <section class="grid-wrap" class:hidden-on-list={data.view === "list"}>
    <div class="weekdays">
      {#each ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"] as wd}
        <div class="wd-cell">{wd}</div>
      {/each}
    </div>
    <div class="grid">
      {#each gridCells as cell (cell.key)}
        <div
          class="day"
          class:other-month={!cell.inMonth}
          class:today={cell.key === todayKey}
        >
          <div class="day-num">{cell.day}</div>
          {#if byDate.has(cell.key)}
            <div class="day-perfs">
              {#each byDate.get(cell.key) ?? [] as p (p.id)}
                {@const baseTitle = p.production.title + ' — ' + p.production.organization_name + (p.note ? ' — ' + p.note : '')}
                {#if p.production.detail_url}
                  <a
                    class="perf-pill perf-pill-link"
                    class:has-note={!!p.note}
                    href={p.production.detail_url}
                    target="_blank"
                    rel="noopener"
                    title={baseTitle + ' (opens in a new tab)'}
                  >
                    <span class="perf-time">{fmtTime(p.performs_at)}</span>
                    <span class="perf-title">{p.production.title}</span>
                    <span class="perf-org">{p.production.organization_name}</span>
                    {#if p.note}
                      <span class="note-badge" aria-label={p.note}>✦</span>
                    {/if}
                  </a>
                {:else}
                  <div class="perf-pill" class:has-note={!!p.note} title={baseTitle}>
                    <span class="perf-time">{fmtTime(p.performs_at)}</span>
                    <span class="perf-title">{p.production.title}</span>
                    <span class="perf-org">{p.production.organization_name}</span>
                    {#if p.note}
                      <span class="note-badge" aria-label={p.note}>✦</span>
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <!-- LIST VIEW (always rendered; CSS shows on mobile or when view=list) -->
  <section class="list-wrap" class:hidden-on-grid={data.view === "grid"}>
    {#each sortedDateKeys as key (key)}
      <div class="day-group" class:today-group={key === todayKey}>
        <h2 class="day-heading">{fmtDateLong(key)}</h2>
        <ul class="perf-list">
          {#each byDate.get(key) ?? [] as p (p.id)}
            <li class="perf-row">
              <span class="perf-time-list">{fmtTime(p.performs_at)}</span>
              <div class="perf-meat">
                <div class="perf-title-list">{p.production.title}</div>
                <div class="perf-org-list">
                  {p.production.organization_name}
                  {#if p.note}
                    <span class="perf-note">{p.note}</span>
                  {/if}
                </div>
              </div>
              {#if p.production.detail_url}
                <a class="perf-link" href={p.production.detail_url} target="_blank" rel="noopener">Info →</a>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </section>
{/if}

<style>
  /* MASTHEAD - mirrors callboard styling */
  .masthead {
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) clamp(1rem, 3vw, 2rem);
    border-bottom: 1px solid var(--rule);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .masthead-body { max-width: 880px; }
  .masthead-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    padding-top: 0.5rem;
  }
  .meta-cta {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: var(--ink);
    color: var(--bg);
    border-radius: var(--radius);
    font-size: 0.9rem;
    text-decoration: none;
  }
  .meta-cta:hover { background: var(--accent); text-decoration: none; }
  .meta-stat {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--muted);
  }
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
  .h1-display {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.02em;
    margin: 0 0 0.75rem;
    color: var(--ink);
  }
  .h1-display .serif-it {
    font-family: var(--font-accent);
    font-style: italic;
    font-weight: 400;
    color: var(--accent);
  }
  .lede {
    font-size: clamp(1rem, 1.4vw, 1.125rem);
    color: var(--ink-soft);
    line-height: 1.5;
    max-width: 60ch;
    margin: 0;
  }

  /* FILTER STRIP */
  .filter-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    padding: 1rem var(--page-pad-x);
    border-bottom: 1px solid var(--rule-soft);
  }
  .filter-label {
    margin-right: 0.5rem;
    margin-bottom: 0;
  }
  .chip {
    display: inline-block;
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    background: var(--bg-raised);
    color: var(--ink-soft);
    font-size: 0.875rem;
    line-height: 1;
    text-decoration: none;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  .chip:hover {
    border-color: var(--accent);
    color: var(--ink);
    text-decoration: none;
  }
  .chip.on {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
  .chip.chip-clear {
    color: var(--muted);
    font-style: italic;
    border-style: dashed;
  }
  .chip.chip-clear:hover {
    color: var(--ink);
    border-color: var(--ink);
    border-style: solid;
  }

  /* SECONDARY ROW */
  .secondary-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem var(--page-pad-x);
    border-bottom: 1px solid var(--rule-soft);
  }
  .month-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    text-decoration: none;
    font-size: 1.25rem;
    line-height: 1;
  }
  .nav-btn:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }
  .month-label {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ink);
    min-width: 9rem;
    text-align: center;
  }
  .view-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .secondary-label {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .view-btn {
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    font-size: 0.875rem;
    text-decoration: none;
  }
  .view-btn:hover { border-color: var(--accent); color: var(--ink); text-decoration: none; }
  .view-btn.on {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--bg);
  }

  /* EMPTY */
  .empty {
    padding: 3rem var(--page-pad-x);
    text-align: center;
    color: var(--muted);
  }
  .empty p { margin: 0 0 1rem; font-size: 1.125rem; }
  .bt-ghost {
    display: inline-block;
    padding: 0.5rem 1rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    text-decoration: none;
  }
  .bt-ghost:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }

  /* GRID */
  .grid-wrap { padding: 1rem var(--page-pad-x) 2rem; }
  .weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    margin-bottom: 1px;
  }
  .wd-cell {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    padding: 0.5rem 0.75rem;
    text-align: left;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: var(--rule);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .day {
    background: var(--bg-raised);
    min-height: 110px;
    padding: 0.4rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .day.other-month { background: var(--paper); color: var(--muted); }
  .day.other-month .day-num { opacity: 0.4; }
  .day.today { box-shadow: inset 0 0 0 2px var(--accent); }
  .day-num {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--ink-soft);
    line-height: 1;
  }
  .day.today .day-num {
    color: var(--accent);
    font-weight: 600;
  }
  .day-perfs {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    overflow: hidden;
  }
  .perf-pill {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 0.25rem 0.4rem;
    background: var(--paper);
    border-left: 2px solid var(--accent);
    border-radius: 2px;
    font-size: 0.72rem;
    line-height: 1.25;
    overflow: hidden;
    color: var(--ink);
    text-decoration: none;
    transition: background 0.12s, border-left-width 0.12s;
  }
  /* Note badge sits in the top-right corner of any pill whose
     performance has a note (Pay-What-You-Can, ASL, Talkback, etc).
     Hovering the pill reveals the full note text via the title attr.
     The list view shows the note inline so this is grid-only. */
  .note-badge {
    position: absolute;
    top: 1px;
    right: 3px;
    font-size: 0.65rem;
    color: var(--accent);
    line-height: 1;
    pointer-events: none;
  }
  .perf-pill.has-note { padding-right: 1rem; }
  /* When the pill is a link, make the affordance visible: cursor change,
     subtle hover paint, and a thicker accent rule. */
  .perf-pill-link {
    cursor: pointer;
  }
  .perf-pill-link:hover {
    background: var(--paper-2);
    border-left-width: 4px;
    text-decoration: none;
  }
  .perf-pill-link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .perf-time {
    font-family: var(--font-mono);
    color: var(--muted);
    font-size: 0.65rem;
  }
  .perf-title {
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .perf-org {
    color: var(--ink-soft);
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.68rem;
  }

  /* LIST */
  .list-wrap { padding: 1rem var(--page-pad-x) 2rem; max-width: 880px; }
  .day-group {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--rule-soft);
  }
  .day-group.today-group { border-left: 3px solid var(--accent); padding-left: 0.75rem; }
  .day-heading {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ink);
    margin: 0 0 0.5rem;
  }
  .day-group.today-group .day-heading {
    color: var(--accent);
  }
  .perf-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .perf-row {
    display: grid;
    grid-template-columns: 5rem 1fr auto;
    gap: 1rem;
    align-items: baseline;
    padding: 0.5rem 0;
    border-bottom: 1px dashed var(--rule-soft);
  }
  .perf-row:last-child { border-bottom: none; }
  .perf-time-list {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--muted);
  }
  .perf-meat { min-width: 0; }
  .perf-title-list {
    font-weight: 600;
    color: var(--ink);
    font-size: 1rem;
    line-height: 1.25;
  }
  .perf-org-list {
    color: var(--ink-soft);
    font-size: 0.875rem;
    margin-top: 0.15rem;
  }
  .perf-note {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.1rem 0.4rem;
    background: var(--paper-2);
    color: var(--ink-soft);
    border-radius: 999px;
    font-size: 0.75rem;
  }
  .perf-link {
    color: var(--accent);
    font-size: 0.875rem;
    white-space: nowrap;
  }

  /* MOBILE: hide grid, show list. */
  @media (max-width: 720px) {
    .grid-wrap { display: none !important; }
    .list-wrap { display: block !important; }
  }
  /* Desktop honours the toggle */
  @media (min-width: 721px) {
    .grid-wrap.hidden-on-list { display: none; }
    .list-wrap.hidden-on-grid { display: none; }
  }

  /* On mobile, tighten secondary row */
  @media (max-width: 720px) {
    .secondary-row {
      flex-direction: column;
      align-items: stretch;
    }
    .month-nav, .view-group { justify-content: center; }
  }
</style>
