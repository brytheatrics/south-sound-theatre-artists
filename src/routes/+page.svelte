<script lang="ts">
  let { data } = $props();

  let idx = $state(0);
  let paused = $state(false);
  let marqueePaused = $state(false);

  // Placeholder callboard items - swap for real `callboard_posts` rows in v1.2.
  const marqueeItems = [
    { glyph: "★", text: "Now appearing - Theo Park in Sweeney Todd, TLT thru May 18" },
    { glyph: "✦", text: "New audition - The Cherry Orchard, Lakewood, May 4" },
    { glyph: "★", text: "Now playing - Indecent at Centerstage thru May 12" },
    { glyph: "✦", text: "Crew call - LD needed, Tacoma Little Theatre spring season" },
    { glyph: "★", text: "Workshop - Devised theatre with Wren Castellanos, May 4 weekend" },
    { glyph: "✦", text: "Open call - Gig Harbor New Works festival, submissions thru June" },
  ];

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
  <p class="lede">
    A free, community-run directory of theatre artists from the South Puget
    Sound. No accounts to browse. Five-minute submission to be listed.
    <span class="lede-cta">You belong here.</span>
  </p>
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
      <span class="name-first">{split.first}</span>{#if split.last}<span class="name-last">&nbsp;{split.last}</span><span class="name-comma">,</span>{/if}
    </button>

    <p class="featured-disc">
      {formatDisciplines(cur.disciplines, cur.geographic_area)}.
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

<!-- Marquee: placeholder callboard ticker. Real entries come from the
     callboard table in v1.2. -->
<div
  class="marquee"
  onmouseenter={() => (marqueePaused = true)}
  onmouseleave={() => (marqueePaused = false)}
  role="presentation"
>
  <div class="marquee-track" class:paused={marqueePaused}>
    {#each [...marqueeItems, ...marqueeItems] as item, i (i)}
      <span class="m-item">
        <span class="m-glyph" aria-hidden="true">{item.glyph}</span>
        <span class="m-text">{item.text}</span>
      </span>
    {/each}
  </div>
</div>

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
  .lede-cta {
    font-family: var(--font-body);
    font-style: normal;
    font-weight: 500;
    font-size: 16px;
    color: var(--accent);
    margin-left: 4px;
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
    font-size: clamp(72px, 13vw, 200px);
    display: block;
    width: 100%;
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

  /* marquee - full bleed, edge to edge */
  .marquee {
    margin: clamp(2rem, 4vw, 3rem) 0 0;
    overflow: hidden;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
    padding: 16px 0;
    white-space: nowrap;
    background: var(--paper);
  }
  .marquee-track {
    display: inline-flex;
    gap: 2.5rem;
    animation: marquee 60s linear infinite;
    will-change: transform;
  }
  .marquee-track.paused {
    animation-play-state: paused;
  }
  @keyframes marquee {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
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
