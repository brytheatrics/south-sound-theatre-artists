<script lang="ts">
  import type { PageData } from "./$types";
  import { renderMarkdownInline } from "$lib/util/markdown";
  import { page } from "$app/state";
  import { onMount } from "svelte";

  let { data }: { data: PageData } = $props();

  // Highlight support: when the homepage marquee deep-links here with
  // ?highlight=<production_id>, find every grid perf-pill + list row
  // tagged with that production, scroll the first match into view if
  // it isn't already, and pulse the highlight class on each. The class
  // is auto-removed after 2s so the page settles back to normal; the
  // URL param sticks around so a refresh re-triggers the pulse.
  onMount(() => {
    const productionId = page.url.searchParams.get("highlight");
    if (!productionId) return;
    requestAnimationFrame(() => {
      const matches = document.querySelectorAll<HTMLElement>(
        `[data-production-id="${CSS.escape(productionId)}"]`,
      );
      if (matches.length === 0) return;

      // Scroll the first match into view if it isn't already on-screen.
      // A view-port test (vs unconditional scroll) prevents jolting the
      // user when the show is already where they're looking.
      const first = matches[0];
      const rect = first.getBoundingClientRect();
      const viewH = window.innerHeight;
      const inView = rect.top >= 0 && rect.bottom <= viewH;
      if (!inView) {
        first.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Pulse: add the class, then remove it after the animation.
      // 4s feels right - 2s reads as "did something just flash?", 4s
      // gives the eye time to track the highlighted show without the
      // flash overstaying its welcome.
      for (const el of matches) el.classList.add("is-highlighted");
      window.setTimeout(() => {
        for (const el of matches) el.classList.remove("is-highlighted");
      }, 4000);
    });
  });

  // ---- URL state helper ------------------------------------------
  function buildUrl(overrides: Record<string, string | null>) {
    const base: Record<string, string | null> = {
      month: data.isSearching ? null : data.monthIso,
      view: data.view === "list" && !data.isSearching ? "list" : null,
      cats: serializeCats(data.activeCats, data.categories),
      areas: serializeAreas(data.activeAreas, data.areas),
      q: data.q || null,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return "/calendar" + (s ? "?" + s : "");
  }

  // Empty active list = no filter, so don't include ?cats= in the URL.
  // (The default state is "show everything"; only put a param in the
  // URL when the user has actively narrowed.)
  function serializeCats(active: string[], _cats: PageData["categories"]) {
    if (active.length === 0) return null;
    return active.join(",");
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

  // Toggle: start from current active list (or empty if no filter).
  // 0 selected = no filter (URL drops ?areas=, all areas visible).
  // All selected = same as no filter (collapse to null).
  // Some selected = filter to those.
  function toggleArea(name: string): string[] | null {
    const allNames = data.areas.map((a) => a.name);
    const current = data.activeAreas ?? [];
    const set = new Set(current);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    if (set.size === 0) return null;
    if (set.size === allNames.length) return null;
    return Array.from(set);
  }

  // Chip is "on" only when its name is explicitly in the active list.
  // Default state (activeAreas === null = no filter) renders all chips
  // as off, matching the directory's "none clicked = show all" model.
  function areaIsOn(name: string): boolean {
    if (data.activeAreas === null) return false;
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
  // YYYY-MM slice of today, for "is the user looking at the current month"
  const currentMonthIso = $derived(todayKey.slice(0, 7));
  const isCurrentMonth = $derived(data.monthIso === currentMonthIso);

  const sortedDateKeys = $derived(
    Array.from(byDate.keys()).sort(),
  );

  // List view starts at today when the user is on the current month
  // (rolling the page-down). For past or future months, every date
  // bucket renders so the user can scroll the whole month.
  const listDateKeys = $derived(
    isCurrentMonth ? sortedDateKeys.filter((k) => k >= todayKey) : sortedDateKeys,
  );

  // True when the list is empty *because* it's only-future-filtered:
  // there are performances earlier in the month, but none from today on.
  // Drives a friendlier empty-state copy ("Nothing else this month").
  const allUpcomingPlayedAlready = $derived(
    isCurrentMonth && listDateKeys.length === 0 && sortedDateKeys.length > 0,
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
    <p class="lede">{@html renderMarkdownInline(data.lede)}</p>
  </div>
  <div class="masthead-meta">
    <a class="meta-cta" href="/calendar/submit">Post a performance &rarr;</a>
    <span class="meta-stat">{data.totalUpcoming} upcoming</span>
  </div>
</header>

<!-- SEARCH BAR -->
<form class="search-bar" method="GET" data-sveltekit-noscroll>
  <!-- Preserve current filters as hidden fields so submitting search
       doesn't drop the user's category / area picks. -->
  {#if data.activeCats.length > 0}
    <input type="hidden" name="cats" value={data.activeCats.join(",")} />
  {/if}
  {#if data.activeAreas !== null && data.activeAreas.length > 0}
    <input type="hidden" name="areas" value={data.activeAreas.join(",")} />
  {/if}
  <input
    type="search"
    name="q"
    value={data.q}
    placeholder="Search shows or theatres..."
    aria-label="Search shows or theatres"
    autocomplete="off"
  />
  <button type="submit" class="search-btn">Search</button>
  {#if data.isSearching}
    <a class="search-clear" href={buildUrl({ q: null })} title="Clear search">Clear</a>
  {/if}
</form>

{#if data.isSearching}
  <p class="search-meta">
    Showing {data.performances.length}
    {data.performances.length === 1 ? "performance" : "performances"} matching
    <strong>"{data.q}"</strong> over the next 12 months.
  </p>
{/if}

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

<!-- SECONDARY: month nav + view toggle (hidden when searching since
     results span the next 12 months) -->
{#if !data.isSearching}
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
{/if}

{#if data.performances.length === 0}
  <div class="empty">
    {#if data.isSearching}
      <p>No upcoming performances match <strong>"{data.q}"</strong>.</p>
      <a class="bt bt-ghost" href={buildUrl({ q: null })}>Clear search</a>
    {:else}
      <p>No performances match your filters this month.</p>
      {#if data.activeCats.length < data.categories.length}
        <a class="bt bt-ghost" href={buildUrl({ cats: data.categories.map(c => c.slug).join(",") })}>
          Show all categories
        </a>
      {/if}
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
          class:past={cell.inMonth && cell.key < todayKey}
        >
          <div class="day-num">{cell.day}</div>
          {#if byDate.has(cell.key)}
            <div class="day-perfs">
              {#each byDate.get(cell.key) ?? [] as p (p.id)}
                {@const baseTitle = p.production.title + ' — ' + p.production.organization_name + (p.note ? ' — ' + p.note : '')}
                <a
                  class="perf-pill perf-pill-link"
                  class:has-note={!!p.note}
                  href={`/calendar/${p.production.id}`}
                  title={baseTitle}
                  data-production-id={p.production.id}
                >
                  <span class="perf-time">{fmtTime(p.performs_at)}</span>
                  <span class="perf-title">
                    {#if p.production.is_ssta_event}
                      <span class="ssta-pill" title="SSTA event">SSTA</span>
                    {/if}
                    {p.production.title}
                  </span>
                  <span class="perf-org">{p.production.organization_name}</span>
                  {#if p.note}
                    <span class="note-badge" aria-label={p.note}>✦</span>
                  {/if}
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <!-- LIST VIEW (always rendered; CSS shows on mobile or when view=list) -->
  <section class="list-wrap" class:hidden-on-grid={data.view === "grid"}>
    {#if allUpcomingPlayedAlready}
      <div class="empty empty-only-past">
        <p>Everything scheduled for {data.monthLabel} has already played.</p>
        <a class="bt bt-ghost" href={buildUrl({ month: data.nextMonthIso })}>
          See next month →
        </a>
      </div>
    {/if}
    {#each listDateKeys as key (key)}
      <div class="day-group" class:today-group={key === todayKey}>
        <h2 class="day-heading">{fmtDateLong(key)}</h2>
        <ul class="perf-list">
          {#each byDate.get(key) ?? [] as p (p.id)}
            <li class="perf-row" data-production-id={p.production.id}>
              <span class="perf-time-list">{fmtTime(p.performs_at)}</span>
              <div class="perf-meat">
                <a class="perf-title-list" href={`/calendar/${p.production.id}`}>
                  {#if p.production.is_ssta_event}
                    <span class="ssta-pill" title="SSTA event">SSTA</span>
                  {/if}
                  {p.production.title}
                </a>
                <div class="perf-org-list">
                  {p.production.organization_name}
                  {#if p.note}
                    <span class="perf-note">{p.note}</span>
                  {/if}
                </div>
              </div>
              {#if p.production.detail_url}
                <a class="perf-link" href={p.production.detail_url} target="_blank" rel="noopener">Tickets ↗</a>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </section>
{/if}

<!-- WEEKLY DIGEST CTA -->
<aside class="digest-cta">
  <span class="eyebrow"><span class="num">·</span>Weekly digest</span>
  <p class="digest-blurb">
    One Sunday-evening email with new opportunities and shows opening this week.
    <a href="/callboard/subscribe">Subscribe →</a>
  </p>
</aside>

<style>
  /* WEEKLY DIGEST CTA - shared shape with /callboard's strip */
  .digest-cta {
    margin: 1.5rem var(--page-pad-x);
    padding: 1rem 1.25rem;
    background: var(--bg-raised);
    border: 1px dashed var(--rule);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .digest-blurb {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
    line-height: 1.5;
    margin: 0;
  }
  .digest-blurb a { color: var(--accent); font-weight: 500; }
  .digest-blurb a:hover { text-decoration: underline; }

  /* MASTHEAD - mirrors callboard styling */
  .masthead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    padding: clamp(2.5rem, 6vw, 3.5rem) var(--page-pad-x) 2rem;
    border-bottom: 1px solid var(--rule);
    flex-wrap: wrap;
  }
  .masthead-body {
    flex: 1;
    min-width: 260px;
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
  .search-bar {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    margin: 0 0 1rem;
    padding: 0 var(--page-pad-x);
    /* Cap at 540px + page padding so the box sits like a search box,
       not a banner, on wide viewports. */
    max-width: calc(540px + 2 * var(--page-pad-x));
  }
  .search-bar input[type="search"] {
    flex: 1 1 220px;
    min-width: 180px;
    padding: 0.55rem 0.85rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 14px;
  }
  .search-bar input[type="search"]:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .search-btn {
    padding: 0.55rem 1.1rem;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    background: var(--ink);
    color: var(--bg);
    font-family: var(--font-body);
    font-size: 14px;
    cursor: pointer;
  }
  .search-btn:hover { background: var(--accent); border-color: var(--accent); }
  .search-clear {
    padding: 0.55rem 0.85rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    font-family: var(--font-body);
    font-size: 14px;
    text-decoration: none;
  }
  .search-clear:hover { border-color: var(--ink-soft); color: var(--ink); }
  .search-meta {
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin: 0 0 0.75rem;
    padding: 0 var(--page-pad-x);
  }
  .search-meta strong { color: var(--accent); font-weight: 500; }

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
  /* Base .chip / .chip:hover / .chip.on come from app.css (shared
     across /calendar, /directory, /callboard). Only page-specific
     variants live here. */
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
  /* Softer treatment when the list is empty *because* everything's
     already played - this isn't a "no results" state, it's a "you've
     reached the end of this month" state. */
  .empty-only-past {
    padding: 2rem var(--page-pad-x);
    border-bottom: 1px solid var(--rule-soft);
  }
  .empty-only-past p { font-size: 1rem; font-style: italic; }
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
  /* Past days within the displayed month dim back to roughly the
     other-month treatment so the eye lands on today + future. The
     pills inside also fade so they read as "already played" rather
     than "currently bookable". today + past is impossible (today is
     never < todayKey) so the .today rule below still wins for today. */
  .day.past {
    background: var(--paper);
  }
  .day.past .day-num { opacity: 0.5; }
  .day.past .perf-pill,
  .day.past .perf-pill-link {
    opacity: 0.55;
  }
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
    padding: 0.3rem 0.45rem;
    background: var(--paper);
    border-left: 2px solid var(--accent);
    border-radius: 2px;
    font-size: 0.85rem;
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
  .ssta-pill {
    display: inline-block;
    padding: 0 0.4em;
    margin-right: 0.3em;
    border-radius: 999px;
    background: var(--accent);
    color: white;
    font-family: var(--font-mono);
    font-size: 0.65em;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    line-height: 1.6;
    vertical-align: 0.1em;
    font-weight: 600;
  }
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

  /* Highlight pulse: applied for ~2 seconds when the page is reached
     via /calendar?highlight=<production_id> (e.g. clicking a calendar
     item in the homepage marquee). The class is added at runtime via
     JS, so Svelte's scoper can't see it - hence :global() selectors.
     Animation runs once, then the class is removed by setTimeout. */
  .perf-pill:global(.is-highlighted) {
    animation: highlight-pulse 4s ease-out;
  }
  .perf-row:global(.is-highlighted) {
    animation: highlight-pulse-row 4s ease-out;
  }
  @keyframes highlight-pulse {
    0% {
      background: color-mix(in oklch, var(--accent), transparent 40%);
      box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent), transparent 60%);
    }
    100% {
      background: var(--paper);
      box-shadow: 0 0 0 0 transparent;
    }
  }
  @keyframes highlight-pulse-row {
    0% {
      background: color-mix(in oklch, var(--accent), transparent 40%);
      box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent), transparent 60%);
    }
    100% {
      background: transparent;
      box-shadow: 0 0 0 0 transparent;
    }
  }
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
    font-size: 0.75rem;
  }
  .perf-title {
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* Light tracking helps the all-caps titles breathe. Inter Tight
       at small caps without spacing reads as a wall. */
    letter-spacing: 0.02em;
  }
  .perf-org {
    color: var(--ink-soft);
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.8rem;
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
