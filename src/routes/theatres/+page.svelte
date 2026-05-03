<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Theatres - South Sound Theatre Artists</title>
  <meta
    name="description"
    content="South Sound theatres: Tacoma, Olympia, Gig Harbor / Kitsap, South King County, and beyond."
  />
</svelte:head>

<header class="masthead">
  <div class="masthead-body">
    <span class="eyebrow"><span class="num">—</span>Theatres</span>
    <h1 class="h1-display">
      <span class="serif-it">{data.total}</span>
      {data.total === 1 ? "theatre" : "theatres"},<br />across the South Sound.
    </h1>
    <p class="lede">
      Every company on our calendar lives here — from year-round
      professional houses to one-show-a-summer outdoor companies. Click into a
      theatre's site for tickets, season info, or to reach their team directly.
    </p>
  </div>
  <div class="masthead-meta">
    <a class="meta-cta" href="/calendar">See What's Playing &rarr;</a>
    <span class="meta-stat">{data.total} listed</span>
  </div>
</header>

<!-- AREA FILTER STRIP -->
{#if data.areaOptions.length > 0}
  <div class="filter-strip" data-sveltekit-noscroll data-sveltekit-replacestate>
    <span class="filter-label eyebrow">Area</span>
    <a
      class="chip"
      class:on={!data.activeArea}
      href="/theatres"
    >
      All
    </a>
    {#each data.areaOptions as area (area)}
      <a
        class="chip"
        class:on={data.activeArea === area}
        href={`/theatres?area=${encodeURIComponent(area)}`}
      >
        {area}
      </a>
    {/each}
  </div>
{/if}

{#if data.grouped.length === 0}
  <div class="empty">
    <p>No theatres in this area yet.</p>
    <a class="bt bt-ghost" href="/theatres">Show all areas</a>
  </div>
{:else}
  {#each data.grouped as group (group.area)}
    <section class="area-section">
      <h2 class="area-h">
        <span class="area-name">{group.area}</span>
        <span class="area-count">{group.list.length}</span>
      </h2>
      <div class="card-grid">
        {#each group.list as t (t.slug)}
          <article class="card">
            <div class="card-logo">
              {#if t.logo_url}
                <img src={t.logo_url} alt="" loading="lazy" />
              {:else}
                <span class="logo-fallback" aria-hidden="true">
                  {t.name
                    .split(" ")
                    .filter((w) => /^[A-Z]/.test(w))
                    .slice(0, 3)
                    .map((w) => w[0])
                    .join("")}
                </span>
              {/if}
            </div>
            <div class="card-body">
              <h3 class="card-name">
                {#if t.homepage_url}
                  <a href={t.homepage_url} target="_blank" rel="noopener">
                    {t.name}
                  </a>
                {:else}
                  {t.name}
                {/if}
              </h3>
              <p class="card-area">{t.area_name ?? "South Sound"}</p>
              {#if t.description}
                <p class="card-desc">{t.description}</p>
              {/if}
              <div class="card-actions">
                {#if t.homepage_url}
                  <a class="card-link" href={t.homepage_url} target="_blank" rel="noopener">
                    Website &rarr;
                  </a>
                {/if}
              </div>
            </div>
          </article>
        {/each}
      </div>
    </section>
  {/each}
{/if}

<style>
  /* MASTHEAD - mirrors callboard / calendar styling */
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

  /* AREA SECTIONS */
  .area-section {
    padding: 2rem var(--page-pad-x);
    border-bottom: 1px solid var(--rule-soft);
  }
  .area-section:last-child { border-bottom: 0; }
  .area-h {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin: 0 0 1.5rem;
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink);
    font-weight: 600;
  }
  .area-name { color: var(--ink); }
  .area-count {
    color: var(--muted);
    font-weight: 400;
  }

  /* CARDS */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
  .card {
    display: flex;
    gap: 0.875rem;
    padding: 1rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    transition: border-color 0.15s ease;
  }
  .card:hover { border-color: var(--ink-soft); }
  .card-logo {
    flex: 0 0 64px;
    width: 64px;
    height: 64px;
    border-radius: var(--radius);
    background: var(--paper);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid var(--rule-soft);
  }
  .card-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 6px;
  }
  .logo-fallback {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 18px;
    color: var(--ink-soft);
    letter-spacing: 0.04em;
  }
  .card-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .card-name {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1rem;
    line-height: 1.2;
    font-weight: 600;
    color: var(--ink);
  }
  .card-name a {
    color: inherit;
    text-decoration: none;
  }
  .card-name a:hover {
    color: var(--accent);
    text-decoration: none;
  }
  .card-area {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .card-desc {
    margin: 0.4rem 0 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .card-actions {
    margin-top: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }
  .card-link {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
  }
  .card-link:hover { text-decoration: underline; }

  .empty {
    padding: 3rem var(--page-pad-x);
    text-align: center;
    color: var(--muted);
  }
  .empty p { margin: 0 0 1rem; }
</style>
