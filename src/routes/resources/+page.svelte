<script lang="ts">
  import { renderMarkdownInline } from "$lib/util/markdown";
  let { data } = $props();
</script>

<svelte:head>
  <title>Resources - South Sound Theatre Artists</title>
  <meta
    name="description"
    content="Curated theatre resources for the South Sound community: classes, grants, producing tools, advocacy groups, and more."
  />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Resources</span>
  <h1 class="h1-display">Resources.</h1>
  <p class="lede">{@html renderMarkdownInline(data.lede)}</p>
</header>

<!-- Featured: theatres directory. Sits above the regular resource
     groups since it's a high-value internal link rather than an
     external resource. -->
<section class="featured">
  <a href="/theatres" class="feature-card">
    <div class="feature-body">
      <span class="feature-eyebrow">South Sound theatres</span>
      <h2 class="feature-title">Every South Sound theatre, in one place.</h2>
      <p class="feature-desc">
        From year-round professional houses to one-show-a-summer outdoor
        companies. Tickets, seasons, contact info — all in one place.
      </p>
    </div>
    <span class="feature-arrow" aria-hidden="true">→</span>
  </a>
</section>

{#if data.groups.length === 0}
  <p class="empty">
    Nothing curated yet. Check back soon.
  </p>
{:else}
  {#each data.groups as g (g.id)}
    <section class="group">
      <header class="group-head">
        <h2 class="group-title">{g.name}</h2>
        {#if g.description}
          <p class="group-desc">{g.description}</p>
        {/if}
      </header>
      <ul class="links">
        {#each g.resources as r (r.id)}
          <li class="row">
            <a class="row-link" href={r.url} target="_blank" rel="noopener">
              <span class="row-title">{r.title}</span>
              <span class="row-arrow" aria-hidden="true">↗</span>
            </a>
            {#if r.description}
              <p class="row-desc">{@html renderMarkdownInline(r.description)}</p>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}
{/if}

<style>
  .hd {
    padding: clamp(2rem, 5vw, 3.5rem) var(--page-pad-x) 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 760px;
  }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--muted);
    margin: 0 0 1.5rem;
  }
  .empty {
    padding: 4rem var(--page-pad-x);
    color: var(--muted);
    font-style: italic;
    text-align: center;
  }
  /* Featured: hero card linking to /theatres */
  .featured {
    padding: 0 var(--page-pad-x);
    margin-bottom: 1rem;
  }
  .feature-card {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.25rem 1.5rem;
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s ease, transform 0.15s ease;
    max-width: 900px;
  }
  .feature-card:hover {
    border-color: var(--ink-soft);
    text-decoration: none;
  }
  .feature-body { flex: 1; min-width: 0; }
  .feature-eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 600;
  }
  .feature-title {
    font-family: var(--font-display);
    font-size: clamp(1.25rem, 2.5vw, 1.5rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0.4rem 0 0.5rem;
    color: var(--ink);
  }
  .feature-desc {
    margin: 0;
    color: var(--ink-soft);
    font-size: 14.5px;
    line-height: 1.5;
  }
  .feature-arrow {
    flex: 0 0 auto;
    font-size: 1.5rem;
    color: var(--accent);
  }
  .feature-card:hover .feature-arrow { transform: translateX(2px); }
  .group {
    padding: 1.5rem var(--page-pad-x);
    border-top: 1px solid var(--rule);
    max-width: 900px;
  }
  .group-head { margin-bottom: 1rem; }
  .group-title {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 600;
    letter-spacing: -0.025em;
    margin: 0;
  }
  .group-desc {
    font-size: 14.5px;
    color: var(--ink-soft);
    margin: 0.5rem 0 0;
    line-height: 1.55;
    max-width: 640px;
  }
  .links {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }
  .row {
    border-bottom: 1px solid var(--rule-soft);
    padding-bottom: 0.875rem;
  }
  .row:last-child { border-bottom: 0; }
  .row-link {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    color: var(--accent);
    text-decoration: none;
    font-family: var(--font-body);
    font-size: 16px;
    font-weight: 500;
  }
  .row-link:hover .row-title { text-decoration: underline; }
  .row-arrow {
    color: var(--muted);
    font-size: 13px;
  }
  .row-desc {
    font-size: 14px;
    color: var(--ink-soft);
    line-height: 1.55;
    margin: 4px 0 0;
    max-width: 640px;
  }
</style>
