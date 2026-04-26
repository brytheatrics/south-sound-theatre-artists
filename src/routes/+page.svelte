<script lang="ts">
  import HeadshotPlaceholder from "$lib/components/HeadshotPlaceholder.svelte";

  let { data } = $props();

  let idx = $state(0);
  let paused = $state(false);

  $effect(() => {
    if (paused || data.featured.length <= 1) return;
    const t = setInterval(() => {
      idx = (idx + 1) % data.featured.length;
    }, 5000);
    return () => clearInterval(t);
  });

  const cur = $derived(data.featured[idx]);
  const split = $derived(cur ? splitName(cur.full_name) : { first: "", last: "" });

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
    A free, community-run directory of theatre artists from Tacoma to Gig
    Harbor. No accounts to browse. Five-minute submission to be listed.
    <span class="lede-cta">You belong here.</span>
  </p>
  <div class="stats">
    <span>{data.artistCount} artists listed</span>
    <span>14 open calls</span>
    <span>Spring intake closes May 8</span>
  </div>
</section>

{#if cur}
  <section
    class="featured"
    onmouseenter={() => (paused = true)}
    onmouseleave={() => (paused = false)}
    aria-label="Featured artist"
  >
    <div class="featured-meta">
      <span class="eyebrow"><span class="num">0{idx + 1}</span>Featured artist</span>
    </div>
    <button
      class="featured-name"
      type="button"
      onclick={advance}
      aria-label="Show next featured artist"
    >
      <span class="name-first">{split.first}</span>{#if split.last}<span class="name-last serif-it">{split.last}</span>{/if}
    </button>
    <div class="featured-line">
      <p class="featured-disc">{formatDisciplines(cur.disciplines, cur.geographic_area)}</p>
      <a class="featured-link" href={`/artists/${cur.slug}`}>
        View profile <span aria-hidden="true">↗</span>
      </a>
    </div>
    <div class="featured-rail">
      {#each data.featured as f, i (f.slug)}
        <button
          type="button"
          class="rail-dot"
          class:on={i === idx}
          aria-label={`Show ${f.full_name}`}
          onclick={() => (idx = i)}
        ></button>
      {/each}
    </div>
  </section>
{/if}

<hr class="rule section-rule" />

<section class="recent">
  <header class="recent-head">
    <span class="eyebrow"><span class="num">04</span>Recently added</span>
    <a class="recent-link" href="/directory">All artists ↗</a>
  </header>
  <div class="recent-grid">
    {#each data.recent as r, i (r.slug)}
      <a class="recent-card" href={`/artists/${r.slug}`}>
        <HeadshotPlaceholder
          name={r.full_name}
          src={r.headshot_url}
          ratio="3 / 4"
          tone={(i % 4) as 0 | 1 | 2 | 3}
        />
        <div class="recent-meta">
          <span class="recent-name">{r.full_name}</span>
          <span class="recent-disc">
            {r.disciplines.slice(0, 2).join(" · ")}
            {#if r.geographic_area}<span class="recent-area"> · {r.geographic_area}</span>{/if}
          </span>
        </div>
      </a>
    {/each}
  </div>
</section>

<style>
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

  .featured {
    padding: clamp(2.5rem, 6vw, 4rem) var(--page-pad-x) 1.5rem;
  }
  .featured-meta {
    margin-bottom: 1rem;
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
    letter-spacing: -0.05em;
    font-size: clamp(64px, 14vw, 220px);
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
    margin-left: 0.18em;
    letter-spacing: -0.03em;
  }
  .featured-line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--rule);
    flex-wrap: wrap;
  }
  .featured-disc {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
    margin: 0;
    text-transform: lowercase;
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
  .featured-rail {
    display: flex;
    gap: 6px;
    margin-top: 1.5rem;
  }
  .rail-dot {
    width: 24px;
    height: 2px;
    background: var(--rule);
    border: 0;
    padding: 0;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .rail-dot.on {
    background: var(--accent);
  }
  .rail-dot:hover {
    background: var(--ink);
  }

  .section-rule {
    margin: 2rem var(--page-pad-x) 2rem;
  }

  .recent {
    padding: 0 var(--page-pad-x);
  }
  .recent-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1.25rem;
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
    gap: 1.25rem;
  }
  .recent-card {
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .recent-card:hover {
    text-decoration: none;
  }
  .recent-card:hover .recent-name {
    color: var(--accent);
  }
  .recent-meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .recent-name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 18px;
    color: var(--ink);
    letter-spacing: -0.01em;
    transition: color 0.15s;
  }
  .recent-disc {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
    text-transform: lowercase;
  }
  .recent-area {
    color: var(--muted);
  }

  @media (max-width: 900px) {
    .recent-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 540px) {
    .hero {
      flex-direction: column;
    }
    .stats {
      text-align: left;
    }
    .featured-line {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
