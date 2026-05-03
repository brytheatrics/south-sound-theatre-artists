<script lang="ts">
  import { renderMarkdownInline } from "$lib/util/markdown";

  let { data } = $props();

  let idx = $state(0);
  let paused = $state(false);

  // Marquee items come from /admin/marquee - either every open callboard
  // post or the admin-picked subset. Empty array hides the bar entirely.
  const marqueeItems = $derived(data.marquee ?? []);

  // Scale animation duration with item count so the px/sec speed stays
  // roughly constant regardless of how many things are in the ticker.
  // ~10s per item reads as a calm crawl; min 60s so 1-3 items don't fly.
  const marqueeDuration = $derived(
    `${Math.max(60, marqueeItems.length * 10)}s`,
  );

  $effect(() => {
    if (paused || data.featured.length <= 1) return;
    const t = setInterval(() => {
      idx = (idx + 1) % data.featured.length;
    }, 5000);
    return () => clearInterval(t);
  });

  const cur = $derived(data.featured[idx]);
  const split = $derived(cur ? splitName(cur.full_name) : { first: "", last: "" });
  const todayLabel = new Date()
    .toLocaleDateString("en-US", { month: "long", day: "numeric" })
    .toUpperCase();

  function splitName(full: string) {
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
  }

  function formatDisciplines(d: string[], area: string | null): string {
    const parts = [...d];
    if (area) parts.push(area);
    return parts.join(" · ");
  }

  function advance() {
    idx = (idx + 1) % data.featured.length;
  }
</script>

<svelte:head>
  <title>South Sound Theatre Artists</title>
  <meta
    name="description"
    content="A free, community-run directory of theatre artists from Tacoma to Gig Harbor."
  />
</svelte:head>

<section class="hero">
  <p class="lede">{@html renderMarkdownInline(data.homeBody)}</p>
  <div class="stats">
    <span>{data.artistCount} artists listed</span>
    <span>14 open calls</span>
  </div>
</section>

{#if cur}
  <section
    class="featured"
    onmouseenter={() => (paused = true)}
    onmouseleave={() => (paused = false)}
    aria-label="Featured artist"
  >
    <div class="featured-head">
      <span class="eyebrow">
        <span aria-hidden="true">✦</span>&nbsp;Today's spotlight · {todayLabel}&nbsp;<span aria-hidden="true">✦</span>
      </span>
      <div class="featured-counter">
        <div class="rail" aria-hidden="true">
          {#each data.featured as f, i (f.slug)}
            <button
              type="button"
              class="rail-dash"
              class:on={i === idx}
              aria-label={`Show ${f.full_name}`}
              onclick={() => (idx = i)}
            ></button>
          {/each}
        </div>
        <span class="counter-num">{idx + 1} / {data.featured.length}</span>
      </div>
    </div>

    <button
      class="featured-name"
      type="button"
      onclick={advance}
      aria-label={`Show next featured artist (current: ${cur.full_name})`}
    >
      <span class="name-first">{split.first}</span>{#if split.last}{' '}<span class="name-last">{split.last}</span><span class="name-comma">,</span>{/if}
    </button>

    <p class="featured-disc">
      {formatDisciplines(cur.disciplines, cur.city || cur.geographic_area)}.
    </p>

    <div class="featured-foot">
      <a class="featured-link" href={`/artists/${cur.slug}`}>
        View profile <span aria-hidden="true">↗</span>
      </a>
      <span class="featured-meta">
        <span aria-hidden="true">↻</span> Rotates daily · {idx + 1} of {data.artistCount}
      </span>
    </div>
  </section>
{/if}

<!-- Marquee: scrolling callboard ticker. Items + cycle-all toggle live in
     /admin/marquee. Hidden when there's nothing approved to show. Pause
     on hover is CSS-only - no Svelte state churn while the animation
     runs, which keeps motion buttery. -->
{#if marqueeItems.length > 0}
  <div class="marquee" role="presentation">
    <div class="marquee-track" style="--marquee-duration: {marqueeDuration}">
      {#each [...marqueeItems, ...marqueeItems] as item, i (i)}
        <a class="m-item" href={item.href}>
          <span class="m-glyph" aria-hidden="true">{item.glyph}</span>
          <span class="m-text">{item.text}</span>
        </a>
      {/each}
    </div>
  </div>
{/if}

<section class="recent">
  <header class="recent-head">
    <span class="eyebrow"><span aria-hidden="true">—</span>&nbsp;Recently added</span>
    <a class="recent-link" href="/directory">
      Browse all {data.artistCount} <span aria-hidden="true">↗</span>
    </a>
  </header>
  <hr class="rule" />
  <div class="recent-grid">
    {#each data.recent as r, i (r.slug)}
      <a class="recent-card" href={`/artists/${r.slug}`}>
        <span class="recent-num">{String(i + 1).padStart(2, "0")}</span>
        <span class="recent-name">{r.full_name}</span>
        <span class="recent-disc">
          {r.disciplines.slice(0, 2).join(" · ")}
        </span>
      </a>
    {/each}
  </div>
</section>

<style>
  /* hero */
  .hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    padding: clamp(2rem, 5vw, 3.5rem) var(--page-pad-x) 0;
    flex-wrap: wrap;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: clamp(16px, 1.6vw, 18px);
    max-width: 460px;
    line-height: 1.55;
    color: var(--muted);
    margin: 0;
  }
  /* Italic markup inside the lede picks up the moss accent. Admins can
     write *You belong here.* (or any phrase) to flag a CTA / emphasis. */
  .lede :global(em) {
    color: var(--accent);
  }
  .lede :global(strong) {
    color: var(--accent);
    font-style: normal;
    font-weight: 500;
  }
  .lede :global(a) {
    color: var(--accent);
  }
  .stats {
    display: flex;
    flex-direction: column;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    line-height: 1.7;
    flex-shrink: 0;
  }

  /* featured rotator */
  .featured {
    padding: clamp(3rem, 6vw, 5rem) var(--page-pad-x) 1.5rem;
  }
  .featured-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }
  .featured-counter {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }
  .rail {
    display: flex;
    gap: 6px;
  }
  .rail-dash {
    width: 26px;
    height: 2px;
    background: var(--rule);
    border: 0;
    padding: 0;
    cursor: pointer;
    transition: background-color 0.2s, height 0.2s;
  }
  .rail-dash.on {
    background: var(--ink);
    height: 3px;
  }
  .rail-dash:hover {
    background: var(--ink);
  }
  .counter-num {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .featured-name {
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    line-height: 0.92;
    letter-spacing: -0.04em;
    /* Lower clamp floor (was 72px) so longer names fit on narrow
       phones. word-break: normal prevents breaking inside individual
       names ("Walters" stays as one word) - long multi-word names
       wrap at the space between first + last instead. */
    font-size: clamp(48px, 13vw, 200px);
    display: block;
    width: 100%;
    word-break: normal;
  }
  .featured-name:focus-visible {
    outline-offset: 6px;
  }
  .name-last {
    font-family: var(--font-accent);
    font-style: italic;
    font-weight: 400;
    color: var(--accent);
    letter-spacing: -0.02em;
  }
  .name-comma {
    font-family: var(--font-accent);
    font-style: italic;
    color: var(--accent);
  }

  .featured-disc {
    margin: clamp(1rem, 2vw, 1.75rem) 0 0;
    font-family: var(--font-accent);
    font-style: italic;
    font-weight: 400;
    color: var(--ink-soft);
    font-size: clamp(28px, 4.5vw, 56px);
    line-height: 1.05;
    letter-spacing: -0.02em;
    text-transform: lowercase;
  }

  .featured-foot {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    margin-top: clamp(1.5rem, 3vw, 2.25rem);
    flex-wrap: wrap;
  }
  .featured-link {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--accent);
    text-decoration: none;
  }
  .featured-link:hover {
    color: var(--ink);
    text-decoration: none;
  }
  .featured-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }

  /* marquee - full bleed, edge to edge.
     Smoothness recipe:
     - translate3d() instead of translateX() forces a compositor layer
       so the browser scrolls a pre-rendered bitmap rather than re-painting
       text every frame (kills the per-character subpixel jitter).
     - backface-visibility: hidden + transform: translateZ(0) on parents
       lock the layer flat to avoid stacking-context surprises.
     - :hover pause lives in CSS so there's zero JS / Svelte state churn
       while the animation runs.
     - Duration scales with item count (~10s/item) via the
       --marquee-duration custom property set inline in the markup, so
       a longer ticker doesn't read as a faster scroll. */
  .marquee {
    margin: clamp(2rem, 4vw, 3rem) 0 0;
    overflow: hidden;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
    padding: 16px 0;
    white-space: nowrap;
    background: var(--paper);
    transform: translateZ(0);
  }
  .marquee-track {
    display: inline-flex;
    gap: 2.5rem;
    animation: marquee var(--marquee-duration, 90s) linear infinite;
    will-change: transform;
    backface-visibility: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .marquee:hover .marquee-track {
    animation-play-state: paused;
  }
  @keyframes marquee {
    from {
      transform: translate3d(0, 0, 0);
    }
    to {
      transform: translate3d(-50%, 0, 0);
    }
  }
  /* Respect prefers-reduced-motion: hold the track still. */
  @media (prefers-reduced-motion: reduce) {
    .marquee-track {
      animation: none;
    }
  }
  .m-item {
    display: inline-flex;
    align-items: baseline;
    gap: 10px;
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--ink-soft);
    letter-spacing: -0.005em;
    text-decoration: none;
    backface-visibility: hidden;
  }
  .m-item:hover {
    color: var(--accent);
  }
  .m-glyph {
    color: var(--accent);
    font-size: 13px;
  }
  .m-text {
    color: var(--ink-soft);
  }

  /* recently added: 4-col grid spanning full width */
  .recent {
    padding: clamp(2rem, 3vw, 2.5rem) var(--page-pad-x) 0;
  }
  .recent-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.75rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .recent-link {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--accent);
    text-decoration: none;
  }
  .recent-link:hover {
    color: var(--ink);
    text-decoration: none;
  }
  .recent-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    margin-top: 1.25rem;
  }
  .recent-card {
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-right: 1rem;
    border-right: 1px solid var(--rule-soft);
  }
  .recent-card:last-child {
    border-right: none;
  }
  .recent-card:hover {
    text-decoration: none;
  }
  .recent-card:hover .recent-name {
    color: var(--accent);
  }
  .recent-num {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .recent-name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(20px, 2vw, 26px);
    color: var(--ink);
    letter-spacing: -0.02em;
    line-height: 1.05;
    transition: color 0.15s;
    margin-top: 0.15rem;
  }
  .recent-disc {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 15px;
    color: var(--muted);
    line-height: 1.3;
  }

  @media (max-width: 900px) {
    .recent-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .recent-card:nth-child(2) {
      border-right: none;
    }
  }
  @media (max-width: 540px) {
    .hero {
      flex-direction: column;
    }
    .stats {
      text-align: left;
    }
    .featured-foot {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .recent-grid {
      grid-template-columns: 1fr;
    }
    .recent-card {
      padding-right: 0;
      border-right: none;
      border-bottom: 1px solid var(--rule-soft);
      padding-bottom: 1rem;
    }
    .recent-card:last-child {
      border-bottom: none;
    }
  }
</style>
