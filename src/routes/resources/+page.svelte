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
  <p class="lede">
    A hand-curated library of links the South Sound theatre community
    might find useful. If something's missing,
    <a href="/contact">let us know</a>.
  </p>
</header>

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
