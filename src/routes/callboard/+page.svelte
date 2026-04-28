<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const POST_TYPE_LABELS: Record<string, string> = {
    audition: "Audition",
    designer: "Designer",
    crew: "Crew",
    production: "Production",
    general: "General",
  };

  const FILTER_TABS = [
    { value: "", label: "All" },
    { value: "audition", label: "Auditions" },
    { value: "designer", label: "Designer calls" },
    { value: "crew", label: "Crew calls" },
    { value: "production", label: "Production" },
    { value: "general", label: "General" },
  ];

  const SORT_OPTS = [
    { value: "deadline", label: "Deadline soonest" },
    { value: "newest", label: "Newest first" },
  ];

  function buildUrl(overrides: Record<string, string | null>) {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = {
      type: data.type || null,
      verified: data.verifiedOnly ? "1" : null,
      sort: data.sort === "newest" ? "newest" : null,
      view: data.view === "cards" ? "cards" : null,
      page: data.page > 1 ? String(data.page) : null,
    };
    const merged = { ...base, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return "/callboard" + (s ? "?" + s : "");
  }

  function fmtRelative(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const d = Math.floor(ms / 86400000);
    if (d < 1) return "today";
    if (d === 1) return "yesterday";
    if (d < 7) return `${d} days ago`;
    const w = Math.floor(d / 7);
    if (w < 5) return `${w} week${w > 1 ? "s" : ""} ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function isClosingSoon(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000;
  }

  const totalPages = $derived(Math.ceil(data.total / data.pageSize));
</script>

<svelte:head>
  <title>Callboard - South Sound Theatre Artists</title>
  <meta name="description" content="Auditions, designer and crew calls, and production announcements for South Sound theatre artists." />
</svelte:head>

<!-- MASTHEAD -->
<header class="masthead">
  <div class="masthead-body">
    <span class="eyebrow"><span class="num">—</span>The Callboard</span>
    <h1 class="h1-display">
      <span class="serif-it">{data.totalActive}</span> open
      {data.totalActive === 1 ? "call" : "calls"},<br />
      from Tacoma to Gig Harbor.
    </h1>
    <p class="lede">
      Auditions, designer and crew calls, and production announcements. Posting
      is free - anyone can submit, and verified South Sound companies post
      immediately.
    </p>
  </div>
  <div class="masthead-meta">
    <a class="meta-cta" href="/callboard/submit">Post a call &rarr;</a>
    <span class="meta-stat">{data.totalActive} active</span>
    {#if data.closingSoon.length > 0}
      <span class="meta-stat warn">{data.closingSoon.length} closing this week</span>
    {/if}
  </div>
</header>

<!-- TYPE FILTER STRIP -->
<div class="filter-strip" data-sveltekit-noscroll data-sveltekit-replacestate>
  <span class="filter-label eyebrow">Filter</span>
  {#each FILTER_TABS as tab (tab.value)}
    <a
      class="chip"
      class:on={data.type === tab.value}
      href={buildUrl({ type: tab.value || null, page: null })}
    >
      {tab.label}
    </a>
  {/each}
</div>

<!-- SECONDARY ROW: verified, sort, view -->
<div class="secondary-row" data-sveltekit-noscroll data-sveltekit-replacestate>
  <a
    class="verified-toggle"
    class:on={data.verifiedOnly}
    href={buildUrl({ verified: data.verifiedOnly ? null : "1", page: null })}
    aria-pressed={data.verifiedOnly}
  >
    <span class="toggle-box" aria-hidden="true"></span>
    Verified companies only
  </a>

  <div class="sort-group">
    <span class="secondary-label">Sort</span>
    {#each SORT_OPTS as opt (opt.value)}
      <a
        class="chip chip-sm"
        class:on={data.sort === opt.value}
        href={buildUrl({ sort: opt.value === "deadline" ? null : opt.value, page: null })}
      >
        {opt.label}
      </a>
    {/each}
  </div>

  <div class="view-group">
    <a
      class="view-btn"
      class:on={data.view === "list"}
      href={buildUrl({ view: null, page: null })}
      title="List view"
    >
      ≡ List
    </a>
    <a
      class="view-btn"
      class:on={data.view === "cards"}
      href={buildUrl({ view: "cards", page: null })}
      title="Card view"
    >
      ▦ Cards
    </a>
  </div>
</div>

<!-- CLOSING-SOON STRIP -->
{#if data.closingSoon.length > 0}
  <div class="closing-strip">
    <span class="eyebrow warn-text">&#9679; Closing this week</span>
    <span class="closing-list">
      {#each data.closingSoon as item, i (item.id)}
        <a class="closing-item" href="/callboard/{item.id}">
          <em>{item.title}</em>
          {#if item.deadline_text}
            &mdash; {item.deadline_text}
          {/if}
        </a>
        {#if i < data.closingSoon.length - 1}
          <span class="closing-sep" aria-hidden="true">&middot;</span>
        {/if}
      {/each}
    </span>
  </div>
{/if}

<!-- POSTS -->
{#if data.posts.length === 0}
  <div class="empty">
    <p>No posts match your filters.</p>
    {#if data.type || data.verifiedOnly}
      <a class="bt bt-ghost" href="/callboard">Clear filters</a>
    {/if}
  </div>
{:else if data.view === "cards"}
  <!-- CARD GRID -->
  <div class="cards-grid">
    {#each data.posts as p, i (p.id)}
      <article class="card">
        <div class="card-top">
          <span class="type-badge">{POST_TYPE_LABELS[p.post_type] ?? p.post_type}</span>
          {#if p.verified_org_id}
            <span class="verified-badge" title="Verified producing company">&#10003;</span>
          {/if}
        </div>
        <div class="card-company">{p.organization_name}</div>
        <h2 class="card-title">{p.title}</h2>
        {#if p.description}
          <p class="card-body">{p.description.slice(0, 160)}{p.description.length > 160 ? "…" : ""}</p>
        {/if}
        <div class="card-footer">
          {#if p.compensation}
            <span class="card-comp">{p.compensation}</span>
          {/if}
          {#if p.deadline_text}
            <span class="card-deadline" class:warn-text={isClosingSoon(p.expires_at)}>{p.deadline_text}</span>
          {/if}
          <a class="bt bt-pri card-cta" href="/callboard/{p.id}">View</a>
        </div>
      </article>
    {/each}
  </div>
{:else}
  <!-- LIST VIEW -->
  <div class="posts-list">
    {#each data.posts as p, i (p.id)}
      <article class="post-row">
        <!-- LEFT: index, type, posted -->
        <div class="post-left">
          <div class="post-num mono-label">No. {String((data.page - 1) * data.pageSize + i + 1).padStart(2, "0")}</div>
          <span class="type-badge">{POST_TYPE_LABELS[p.post_type] ?? p.post_type}</span>
          <div class="post-meta mono-label">
            {fmtRelative(p.created_at)}
            {#if p.compensation}
              <br /><span class="comp-text">{p.compensation}</span>
            {/if}
          </div>
        </div>

        <!-- MIDDLE: company, title, body, roles -->
        <div class="post-mid">
          <div class="post-org">
            <a class="org-name serif-it" href="/callboard/{p.id}">{p.organization_name}</a>
            {#if p.verified_org_id}
              <span class="verified-badge" title="Verified producing company">&#10003;</span>
            {/if}
            {#if p.location}
              <span class="post-location mono-label">{p.location}</span>
            {/if}
          </div>
          <h2 class="post-title">
            <a href="/callboard/{p.id}">{p.title}</a>
          </h2>
          {#if p.description}
            <p class="post-body">{p.description.slice(0, 240)}{p.description.length > 240 ? "…" : ""}</p>
          {/if}
          {#if p.roles.length > 0}
            <div class="roles-row">
              {#each p.roles.slice(0, 6) as role}
                <span class="chip chip-sm">{role}</span>
              {/each}
              {#if p.roles.length > 6}
                <span class="chip chip-sm muted">+{p.roles.length - 6}</span>
              {/if}
            </div>
          {/if}
        </div>

        <!-- RIGHT: key dates + CTA -->
        <div class="post-right">
          {#if p.key_dates && (p.key_dates as [string, string][]).length > 0}
            <div class="eyebrow">Key dates</div>
            <dl class="dates-list">
              {#each p.key_dates as [label, value]}
                <div class="date-row">
                  <dt class="date-label">{label}</dt>
                  <dd class="date-value">{value}</dd>
                </div>
              {/each}
            </dl>
          {/if}
          {#if p.deadline_text}
            <div class="deadline-box" class:warn-deadline={isClosingSoon(p.expires_at)}>
              <span class="deadline-label mono-label">Deadline</span>
              <span class="deadline-val">{p.deadline_text}</span>
            </div>
            {#if isClosingSoon(p.expires_at)}
              <div class="eyebrow warn-text closing-flag">&#9679; Closing soon</div>
            {/if}
          {/if}
          <a class="bt bt-pri apply-btn" href="/callboard/{p.id}">Read &amp; apply</a>
        </div>
      </article>
    {/each}
  </div>
{/if}

<!-- PAGINATION -->
{#if totalPages > 1}
  <nav class="pagination" aria-label="Pagination">
    {#if data.page > 1}
      <a class="bt bt-ghost" href={buildUrl({ page: String(data.page - 1) })}>&#8592; Prev</a>
    {/if}
    {#each Array.from({ length: totalPages }, (_, i) => i + 1) as pg}
      {#if pg === 1 || pg === totalPages || (pg >= data.page - 2 && pg <= data.page + 2)}
        <a
          class="bt"
          class:bt-pri={pg === data.page}
          class:bt-ghost={pg !== data.page}
          href={buildUrl({ page: pg === 1 ? null : String(pg) })}
          aria-current={pg === data.page ? "page" : undefined}
        >{pg}</a>
      {:else if pg === data.page - 3 || pg === data.page + 3}
        <span class="pagination-ellipsis">&hellip;</span>
      {/if}
    {/each}
    {#if data.page < totalPages}
      <a class="bt bt-ghost" href={buildUrl({ page: String(data.page + 1) })}>Next &#8594;</a>
    {/if}
  </nav>
{/if}

<!-- FOOTER CTA -->
<footer class="board-footer">
  <div class="footer-copy">
    <span class="eyebrow"><span class="num">+</span>For producing companies</span>
    <h2 class="footer-heading">Post a call. <span class="serif-it">It's free.</span></h2>
    <p class="footer-body">
      Verified South Sound companies can post auditions, designer and crew
      calls, and production announcements at no cost. Anyone can submit - new
      companies are vetted by hand, usually within 48 hours.
    </p>
  </div>
  <div class="footer-actions">
    <a class="bt bt-pri" href="/callboard/submit">Post a call</a>
    <a class="bt bt-ghost" href="/callboard/apply-verified">Get verified</a>
    <div class="footer-contact mono-label">Questions &middot; hello@ssta.org</div>
  </div>
</footer>

<style>
  /* === MASTHEAD === */
  .masthead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    padding: clamp(2.5rem, 6vw, 3.5rem) 0 2rem;
    border-bottom: 1px solid var(--rule);
    flex-wrap: wrap;
  }
  .masthead-body {
    flex: 1;
    min-width: 260px;
  }
  .h1-display {
    font-size: clamp(2.8rem, 7vw, 5.25rem);
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
    max-width: 560px;
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
  .warn { color: var(--warn) !important; }

  /* === FILTER STRIP === */
  .filter-strip {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 1.25rem 0 0.875rem;
    border-bottom: 1px solid var(--rule-soft);
    flex-wrap: wrap;
  }
  .filter-label {
    margin-right: 4px;
  }

  /* === SECONDARY ROW === */
  .secondary-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--rule-soft);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
    flex-wrap: wrap;
  }
  .verified-toggle {
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    text-decoration: none;
    color: var(--ink-soft);
  }
  .verified-toggle:hover { color: var(--ink); }
  .toggle-box {
    width: 14px;
    height: 14px;
    border: 1px solid var(--ink);
    border-radius: 3px;
    background: var(--bg-raised);
    display: inline-block;
    flex-shrink: 0;
  }
  .verified-toggle.on .toggle-box {
    background: var(--accent);
    border-color: var(--accent);
  }
  .sort-group {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
  .secondary-label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--muted);
  }
  .view-group {
    display: flex;
    gap: 10px;
    align-items: center;
    border-left: 1px solid var(--rule);
    padding-left: 1.25rem;
  }
  .view-btn {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    text-decoration: none;
    cursor: pointer;
  }
  .view-btn:hover, .view-btn.on { color: var(--ink); }

  /* === CLOSING SOON === */
  .closing-strip {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    padding: 0.875rem 0;
    border-bottom: 1px solid var(--rule);
    background: var(--paper);
    margin: 0 calc(-1 * var(--page-pad-x));
    padding-left: var(--page-pad-x);
    padding-right: var(--page-pad-x);
    flex-wrap: wrap;
  }
  .warn-text { color: var(--warn) !important; }
  .closing-list {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
  }
  .closing-item {
    color: var(--ink-soft);
    text-decoration: none;
  }
  .closing-item:hover { color: var(--ink); }
  .closing-item em { font-style: italic; }
  .closing-sep { color: var(--muted); margin: 0 4px; }

  /* === EMPTY === */
  .empty {
    padding: 4rem 0;
    text-align: center;
    color: var(--muted);
    font-family: var(--font-accent);
    font-style: italic;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  /* === SHARED BITS === */
  .type-badge {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    background: var(--paper);
    border: 1px solid var(--rule);
    color: var(--ink);
    padding: 4px 8px;
    border-radius: 2px;
  }
  .verified-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
    vertical-align: middle;
  }
  .mono-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .comp-text { color: var(--ink-soft); }

  /* === LIST VIEW === */
  .posts-list {
    margin-top: 0.5rem;
  }
  .post-row {
    display: grid;
    grid-template-columns: 160px 1fr 240px;
    gap: 2rem;
    padding: 1.75rem 0;
    border-bottom: 1px solid var(--rule-soft);
    align-items: start;
  }
  .post-left {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }
  .post-num { line-height: 1.7; }
  .post-meta { line-height: 1.7; }
  .post-mid {
    min-width: 0;
  }
  .post-org {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .org-name {
    font-size: 16px;
    color: var(--accent);
    text-decoration: none;
  }
  .org-name:hover { text-decoration: underline; }
  .post-location { color: var(--muted); }
  .post-title {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 3vw, 2.25rem);
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin: 0 0 0.75rem;
  }
  .post-title a {
    color: var(--ink);
    text-decoration: none;
  }
  .post-title a:hover { color: var(--accent); }
  .post-body {
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 1.55;
    color: var(--ink-soft);
    margin: 0 0 0.875rem;
    max-width: 560px;
  }
  .roles-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip-sm {
    font-size: 11.5px;
    padding: 4px 10px;
  }
  .muted { color: var(--muted) !important; }

  /* RIGHT PANEL */
  .post-right {
    border-left: 1px solid var(--rule-soft);
    padding-left: 1.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .dates-list {
    margin: 0.625rem 0 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .date-row {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.25rem 0;
    font-family: var(--font-body);
    font-size: 13.5px;
    color: var(--ink-soft);
  }
  .date-label { color: var(--muted); }
  .date-value { text-align: right; color: var(--ink); }
  .deadline-box {
    padding: 0.625rem 0.75rem;
    background: var(--paper);
    border-radius: var(--radius);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .warn-deadline .deadline-val { color: var(--warn); }
  .deadline-label { font-size: 10px; }
  .deadline-val {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    text-align: right;
  }
  .closing-flag { margin-top: -0.25rem; }
  .apply-btn { justify-content: center; }

  /* === CARD GRID === */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
    margin-top: 1.25rem;
    margin-bottom: 1rem;
  }
  .card {
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .card-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .card-company {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 14px;
    color: var(--accent);
  }
  .card-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin: 0;
    color: var(--ink);
  }
  .card-body {
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--ink-soft);
    margin: 0;
    flex: 1;
  }
  .card-footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.25rem;
    border-top: 1px solid var(--rule-soft);
    padding-top: 0.75rem;
  }
  .card-comp {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    flex: 1;
  }
  .card-deadline {
    font-size: 12px;
    color: var(--ink-soft);
  }
  .card-cta {
    margin-left: auto;
    font-size: 12px;
    padding: 6px 12px;
  }

  /* === PAGINATION === */
  .pagination {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 2rem 0;
    flex-wrap: wrap;
    align-items: center;
  }
  .pagination-ellipsis {
    font-family: var(--font-mono);
    color: var(--muted);
    padding: 0 4px;
  }

  /* === FOOTER CTA === */
  .board-footer {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 3rem;
    align-items: center;
    border-top: 1px solid var(--rule);
    padding: 2.5rem 0 3.5rem;
    margin-top: 1rem;
    background: var(--bg-raised);
    margin-left: calc(-1 * var(--page-pad-x));
    margin-right: calc(-1 * var(--page-pad-x));
    padding-left: var(--page-pad-x);
    padding-right: var(--page-pad-x);
  }
  .footer-heading {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.75rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
    margin: 0.875rem 0 0;
  }
  .footer-body {
    font-size: 15px;
    line-height: 1.6;
    color: var(--ink-soft);
    margin: 0.875rem 0 0;
    max-width: 480px;
  }
  .footer-actions {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    align-items: flex-start;
  }
  .footer-contact {
    margin-top: 0.5rem;
  }

  /* === BUTTON STYLES === */
  .bt {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    padding: 9px 16px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    line-height: 1.2;
  }
  .bt-pri {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); text-decoration: none; }
  .bt-ghost {
    background: transparent;
    color: var(--ink);
    border-color: var(--rule);
  }
  .bt-ghost:hover { border-color: var(--ink); text-decoration: none; }

  /* === MOBILE === */
  @media (max-width: 860px) {
    .post-row {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .post-left {
      flex-direction: row;
      align-items: center;
      gap: 0.75rem;
      padding-bottom: 0.75rem;
      flex-wrap: wrap;
    }
    .post-num { display: none; }
    .post-meta { order: 3; }
    .post-right {
      border-left: none;
      border-top: 1px solid var(--rule-soft);
      padding-left: 0;
      padding-top: 0.875rem;
      margin-top: 0.875rem;
    }
    .post-mid { padding-bottom: 0; }
    .apply-btn { width: 100%; justify-content: center; margin-top: 0.25rem; }
  }
  @media (max-width: 640px) {
    .board-footer {
      grid-template-columns: 1fr;
    }
    .view-group { display: none; }
    .secondary-row { gap: 0.75rem; }
    .sort-group { margin-left: 0; }
    .masthead-meta { display: none; }
    .cards-grid { grid-template-columns: 1fr; }
  }
</style>
