<script lang="ts">
  import { renderMarkdownInline } from "$lib/util/markdown";

  let { data } = $props();

  const cur = $derived(data.featured[0]);

  // Marquee items come from /admin/marquee - either every open callboard
  // post + upcoming productions, or the admin-picked subset. Empty
  // array hides the bar entirely.
  const marqueeItems = $derived(data.marquee ?? []);
  const marqueeDuration = $derived(
    `${Math.max(60, marqueeItems.length * 10)}s`,
  );

  // Spotlight bio excerpt: ~220 chars, ending on a sentence boundary
  // when reachable. Keeps the spotlight a sidebar feature, not an essay.
  function bioExcerpt(bio: string | null): string {
    if (!bio) return "";
    const trimmed = bio.trim();
    if (trimmed.length <= 240) return trimmed;
    const cap = trimmed.slice(0, 240);
    const lastStop = cap.lastIndexOf(". ");
    if (lastStop > 100) return cap.slice(0, lastStop + 1);
    return cap.replace(/\s+\S*$/, "") + "...";
  }

  function topDisciplines(d: string[]): string {
    return d.slice(0, 3).join(", ").toLowerCase();
  }

  // Recently-added cards use Title Case + spaced middot to match the
  // playbill-card treatment (different from the spotlight's lowercase italic).
  function recentDisciplines(d: string[]): string {
    return d
      .slice(0, 2)
      .map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase()))
      .join(" · ");
  }
</script>

<svelte:head>
  <title>South Sound Theatre Artists</title>
  <meta
    name="description"
    content="A free, community-run register of theatre artists from Tacoma to Gig Harbor. Add yourself, find collaborators, see who's working."
  />
</svelte:head>

<!-- LEDE: playbill front-page treatment. The page earns its existence
     in two seconds. Editor-controlled body via /admin/site-content. -->
<section class="lede">
  <h1 class="lede-h1">
    Made for the people who make <span class="serif-it">South Sound theatre.</span>
  </h1>
  {#if data.homeBody}
    <p class="lede-body">{@html renderMarkdownInline(data.homeBody)}</p>
  {/if}
  <p class="lede-cta">
    <a class="lede-link" href="/submit"><span aria-hidden="true">→</span>&nbsp;Add yourself to the register</a>
    <span class="lede-aside">takes about three minutes</span>
  </p>
</section>

<!-- DOORS: three primary destinations. Italic moss numerals like act
     numbers in a script; live counts read as reportage, not metrics. -->
<nav class="doors" aria-label="Main sections">
  <a class="door" href="/directory">
    <span class="door-eyebrow">The Directory</span>
    <span class="door-count">
      {data.artistCount} <span class="serif-it">artists</span>
    </span>
    <span class="door-blurb">every craft, every town</span>
  </a>
  <a class="door" href="/calendar">
    <span class="door-eyebrow">What's Playing</span>
    <span class="door-count">
      {data.upcomingProductionCount} <span class="serif-it">productions</span>
    </span>
    <span class="door-blurb">the whole region's season</span>
  </a>
  <a class="door" href="/callboard">
    <span class="door-eyebrow">Opportunities</span>
    <span class="door-count">
      {data.openCallCount} <span class="serif-it">open calls</span>
    </span>
    <span class="door-blurb">auditions, design, crew</span>
  </a>
</nav>

<!-- FEATURED SPOTLIGHT: today's artist. Framed as "today on the board"
     so it reads as a rotation, not a static fan page. -->
{#if cur}
  <section class="spotlight" aria-label="Featured artist">
    {#if cur.headshot_url}
      <a class="spot-photo" href={`/artists/${cur.slug}`}>
        <img src={cur.headshot_url} alt={cur.full_name} loading="lazy" />
      </a>
    {:else}
      <a class="spot-photo spot-photo-empty" href={`/artists/${cur.slug}`} aria-hidden="true">
        <span>HEADSHOT</span>
      </a>
    {/if}
    <div class="spot-body">
      <p class="eyebrow"><span aria-hidden="true">—</span>&nbsp;TODAY ON THE BOARD <span aria-hidden="true">·</span> FEATURED ARTIST</p>
      <h2 class="spot-name">{cur.full_name}</h2>
      <p class="spot-disc">
        <span class="serif-it">{topDisciplines(cur.disciplines)}</span>{#if cur.city || cur.geographic_area}
          <span class="spot-town"> <span aria-hidden="true">·</span> {cur.city || cur.geographic_area}</span>
        {/if}
      </p>
      {#if cur.bio}
        <p class="spot-bio">{bioExcerpt(cur.bio)}</p>
      {/if}
      <a class="spot-link" href={`/artists/${cur.slug}`}>
        <span aria-hidden="true">→</span>&nbsp;Read the rest of {cur.full_name.split(" ")[0]}'s page
      </a>
      <div class="spot-rotation">
        {#if data.yesterdayName}
          <span>YESTERDAY: {#if data.yesterdaySlug}<a class="spot-rotation-link" href={`/artists/${data.yesterdaySlug}`}>{data.yesterdayName}</a>{:else}{data.yesterdayName}{/if}.</span>
        {/if}
        {#if data.tomorrowName}
          <span>TOMORROW: {#if data.tomorrowSlug}<a class="spot-rotation-link" href={`/artists/${data.tomorrowSlug}`}>{data.tomorrowName}</a>{:else}{data.tomorrowName}{/if}.</span>
        {:else}
          <span>TOMORROW: <span class="serif-it">someone new.</span></span>
        {/if}
        <a class="spot-rotation-link" href="/directory">
          <span aria-hidden="true">→</span>&nbsp;See the full register
        </a>
      </div>
    </div>
  </section>
{/if}

<!-- MARQUEE: scrolling ticker mixing callboard posts + upcoming
     productions. Sits between the spotlight and the recently-added
     cards so the edge fade mask (bounded by main) doesn't overlap it
     at the bottom of scroll. -->
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

<!-- RECENTLY ADDED: numbered playbill-card grid. Eyebrow on the left,
     full-bleed rule beneath, then a 2-col grid of cards with vertical
     dividers between cards in the same row and horizontal dividers
     between rows. -->
{#if data.recent.length > 0}
  <section class="recent">
    <p class="eyebrow"><span aria-hidden="true">—</span>&nbsp;RECENTLY ADDED</p>
    <ol class="recent-grid">
      {#each data.recent as p, i (p.slug)}
        <li class="recent-card">
          <a class="recent-card-link" href={`/artists/${p.slug}`}>
            <span class="recent-num">{String(i + 1).padStart(2, "0")}</span>
            <span class="recent-name">{p.full_name}</span>
            <span class="recent-disc">{recentDisciplines(p.disciplines)}</span>
          </a>
        </li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  /* Shared "serif-italic-moss" treatment used across sections.
     Mirrors the .serif-it pattern from /directory etc. */
  .serif-it {
    font-family: var(--font-accent);
    font-style: italic;
    font-weight: 400;
    color: var(--accent);
    letter-spacing: -0.01em;
  }

  /* Cap homepage content at a centered ~1280px column on wide screens,
     while letting section borders and the marquee stay full bleed.
     Trick: override --page-pad-x so its calc grows past the original
     clamp once the viewport exceeds the cap. */
  /* All sections share the same 1280px content column on wide screens
     so they line up flush vertically. The block stays centered on
     wide viewports (the calc() padding eats the extra width on each
     side); content inside flows left. */
  .lede,
  .doors,
  .spotlight,
  .recent {
    --page-pad-x: max(clamp(20px, 4vw, 48px), calc((100vw - 1280px) / 2));
  }
  .doors {
    padding-left: var(--page-pad-x);
    padding-right: var(--page-pad-x);
  }

  /* LEDE -------------------------------------------------------- */
  /* Section is centered on wide screens via the --page-pad-x trick at
     the top of this block; content INSIDE is left-aligned, not text-
     centered. The 20ch / 60ch caps still apply but they hug the left
     padding edge instead of being centered within the block. */
  .lede {
    padding: clamp(2.5rem, 5vw, 4rem) var(--page-pad-x) clamp(2rem, 3.5vw, 3rem);
    border-bottom: 1px solid var(--rule);
  }
  .lede .eyebrow {
    margin: 0 0 1.5rem;
  }
  .lede-h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 0.95;
    color: var(--ink);
    font-size: clamp(44px, 6.5vw, 104px);
    max-width: 20ch;
  }
  /* Keep the italic accent phrase from breaking mid-phrase. */
  .lede-h1 .serif-it {
    white-space: nowrap;
  }
  .lede-body {
    margin: 1.75rem 0 0;
    font-family: var(--font-body);
    font-size: clamp(20px, 1.85vw, 24px);
    line-height: 1.45;
    color: var(--ink-soft);
    /* Wide enough that the current admin-managed homeBody copy lands
       on two lines at desktop widths. If admin lengthens the body
       past ~210 chars it'll wrap to three; that's an acceptable
       degrade rather than a typography-redline fix. */
    max-width: 100ch;
  }
  /* Lede-body emphasis is markdown italics, lifted into serif-italic-moss. */
  .lede-body :global(em) {
    font-family: var(--font-accent);
    font-style: italic;
    font-weight: 400;
    color: var(--accent);
  }
  .lede-body :global(strong) {
    color: var(--accent);
    font-weight: 500;
    font-style: normal;
  }
  .lede-body :global(a) {
    color: var(--accent);
  }
  .lede-cta {
    margin: 1.5rem 0 0;
    display: flex;
    gap: 1.25rem;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .lede-link {
    font-family: var(--font-mono);
    font-size: 13px;
    letter-spacing: 0.05em;
    color: var(--ink);
    text-decoration: none;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 1px;
    transition: border-color 0.15s ease;
  }
  .lede-link:hover {
    border-bottom-color: var(--ink);
    text-decoration: none;
  }
  .lede-aside {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 14px;
    color: var(--muted);
  }

  /* DOORS ------------------------------------------------------- */
  .doors {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-bottom: 1px solid var(--rule);
  }
  .door {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: clamp(1.5rem, 2.5vw, 2rem) clamp(1.25rem, 2vw, 1.875rem);
    text-decoration: none;
    color: inherit;
    transition: background-color 0.15s ease;
    position: relative;
  }
  .door + .door {
    border-left: 1px solid var(--rule);
  }
  .door:hover {
    background: var(--paper);
    text-decoration: none;
  }
  .door-eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-soft);
    font-weight: 500;
  }
  .door-count {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(22px, 2.4vw, 30px);
    color: var(--ink);
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .door-count .serif-it {
    font-size: 0.88em;
    font-weight: 500;
  }
  .door-blurb {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 14px;
    color: var(--muted);
    line-height: 1.4;
  }
  .door::after {
    content: "→";
    position: absolute;
    top: clamp(1.5rem, 2.5vw, 2rem);
    right: clamp(1.25rem, 2vw, 1.875rem);
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--ink-soft);
    transition: transform 0.15s ease, color 0.15s ease;
  }
  .door:hover::after {
    transform: translateX(4px);
    color: var(--accent);
  }

  /* FEATURED SPOTLIGHT ------------------------------------------ */
  .spotlight {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: clamp(1.75rem, 3.5vw, 3rem);
    align-items: start;
    padding: clamp(2.5rem, 4.5vw, 4rem) var(--page-pad-x);
    border-bottom: 1px solid var(--rule);
  }
  .spot-photo {
    display: block;
    width: 240px;
    height: 320px;
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--paper);
    border: 1px solid var(--rule-soft);
  }
  .spot-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .spot-photo-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-decoration: none;
  }
  .spot-body .eyebrow {
    margin: 0 0 0.85rem;
  }
  .spot-name {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(32px, 3.8vw, 56px);
    letter-spacing: -0.02em;
    line-height: 1.05;
    color: var(--ink);
  }
  .spot-disc {
    margin: 0.5rem 0 0;
    font-size: clamp(16px, 1.6vw, 20px);
  }
  .spot-town {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .spot-bio {
    margin: 1.25rem 0 0;
    font-family: var(--font-body);
    font-size: 17px;
    line-height: 1.6;
    color: var(--ink-soft);
    max-width: 56ch;
  }
  .spot-link {
    display: inline-block;
    margin-top: 1.1rem;
    font-family: var(--font-mono);
    font-size: 13px;
    letter-spacing: 0.05em;
    color: var(--ink);
    text-decoration: none;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 1px;
  }
  .spot-link:hover {
    border-bottom-color: var(--ink);
    text-decoration: none;
  }
  .spot-rotation {
    margin-top: 1.5rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--rule);
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .spot-rotation .serif-it {
    text-transform: none;
    letter-spacing: 0;
    font-size: 13px;
  }
  .spot-rotation-link {
    color: var(--ink);
    text-decoration: underline;
    text-decoration-color: var(--rule);
    text-underline-offset: 3px;
  }
  .spot-rotation-link:hover {
    text-decoration-color: var(--ink);
  }

  /* RECENTLY ADDED --------------------------------------------- */
  .recent {
    padding: clamp(1.75rem, 3vw, 2.5rem) var(--page-pad-x) 0;
  }
  .recent .eyebrow {
    margin: 0 0 1rem;
  }
  .recent-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    border-top: 1px solid var(--rule);
  }
  .recent-card {
    padding: clamp(1.5rem, 2.5vw, 2rem) clamp(1.25rem, 2vw, 1.875rem);
  }
  /* Vertical divider between cards in the same row (every even-indexed
     card gets a left border). */
  .recent-card:nth-child(2n) {
    border-left: 1px solid var(--rule);
  }
  /* Horizontal divider for cards on a second row. */
  .recent-card:nth-child(n + 3) {
    border-top: 1px solid var(--rule);
  }
  .recent-card-link {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
  }
  .recent-num {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    color: var(--muted);
    font-weight: 500;
  }
  .recent-name {
    margin-top: 0.4rem;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(22px, 2.4vw, 32px);
    letter-spacing: -0.02em;
    line-height: 1.05;
    color: var(--ink);
    transition: color 0.15s;
  }
  .recent-card-link:hover .recent-name {
    color: var(--accent);
  }
  .recent-disc {
    margin-top: 0.5rem;
    font-family: var(--font-accent);
    font-style: italic;
    font-size: clamp(15px, 1.4vw, 17px);
    color: var(--ink-soft);
    letter-spacing: -0.01em;
  }

  /* MARQUEE ---------------------------------------------------- */
  .marquee {
    margin: 0;
    overflow: hidden;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
    padding: 14px 0;
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
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-50%, 0, 0); }
  }
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

  /* RESPONSIVE ------------------------------------------------- */
  @media (max-width: 880px) {
    .doors {
      grid-template-columns: 1fr;
    }
    .door + .door {
      border-left: 0;
      border-top: 1px solid var(--rule);
    }
    .spotlight {
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }
    .spot-photo {
      width: 140px;
      height: 187px;
    }
    .recent-grid {
      grid-template-columns: 1fr;
    }
    .recent-card:nth-child(2n) {
      border-left: 0;
    }
    .recent-card:nth-child(n + 2) {
      border-top: 1px solid var(--rule);
    }
  }
</style>
