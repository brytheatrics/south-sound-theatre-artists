<script lang="ts">
  import { page } from "$app/state";
  import ProductionCreditsEditor from "$lib/components/ProductionCreditsEditor.svelte";
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.production.title} - Manage credits - SSTA</title>
</svelte:head>

<article class="page">
  <p class="crumb">
    <a href={`/org-edit/${page.params.token}`}>← All productions for {data.org?.name ?? "this org"}</a>
  </p>
  <header class="head">
    <h1 class="t">{data.production.title}</h1>
    <p class="public-link">
      <a href={`/calendar/${data.production.id}`} target="_blank" rel="noopener">View public production page ↗</a>
    </p>
  </header>

  <ProductionCreditsEditor
    initial={data.credits}
    apiBase={`/api/org-edit/${page.params.token}/productions/${data.production.id}`}
  />
</article>

<style>
  .page {
    max-width: 920px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .crumb { margin: 0; font-family: var(--font-mono); font-size: 12px; }
  .crumb a { color: var(--muted); text-decoration: none; }
  .crumb a:hover { color: var(--ink); }
  .head { display: flex; flex-direction: column; gap: 6px; }
  .t {
    margin: 0;
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.02em;
  }
  .public-link { margin: 0; font-family: var(--font-body); font-size: 13px; }
  .public-link a { color: var(--accent); }
</style>
