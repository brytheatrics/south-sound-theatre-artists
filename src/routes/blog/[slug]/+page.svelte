<script lang="ts">
  import { renderMarkdown } from "$lib/util/markdown";
  let { data } = $props();
  // svelte-ignore state_referenced_locally
  const p = data.post;

  function fmtDate(iso: string | null): string {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<svelte:head>
  <title>{p.title} - Blog - South Sound Theatre Artists</title>
  {#if p.cover_url}
    <meta property="og:image" content={p.cover_url} />
  {/if}
  <meta property="og:title" content={p.title} />
</svelte:head>

<article class="page">
  <p class="crumb"><a href="/blog">← All posts</a></p>

  {#if !p.published}
    <p class="draft-note">○ Draft - only admins see this page.</p>
  {/if}

  <header class="head">
    <h1 class="t">{p.title}</h1>
    <p class="byline">
      {p.author_display_name} · {fmtDate(p.published_at)}
    </p>
  </header>

  {#if p.cover_url}
    <img src={p.cover_url} alt="" class="cover" />
  {/if}

  <div class="prose body">{@html renderMarkdown(p.body_markdown)}</div>
</article>

<style>
  .page {
    max-width: 720px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .crumb { margin: 0; font-family: var(--font-mono); font-size: 12px; }
  .crumb a { color: var(--muted); text-decoration: none; }
  .crumb a:hover { color: var(--ink); }
  .draft-note {
    margin: 0;
    padding: 8px 12px;
    border: 1px dashed var(--warn);
    border-radius: var(--radius);
    color: var(--warn);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .head { display: flex; flex-direction: column; gap: 6px; }
  .t {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(34px, 6vw, 52px);
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.025em;
    line-height: 1.1;
  }
  .byline {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .cover {
    width: 100%;
    border-radius: var(--radius);
    margin: 0;
  }
  .body {
    font-family: var(--font-body);
    font-size: 17px;
    line-height: 1.65;
    color: var(--ink);
  }
  .body :global(h2) {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 600;
    margin: 1.5em 0 0.5em;
    line-height: 1.2;
  }
  .body :global(h3) {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    margin: 1.25em 0 0.5em;
  }
  .body :global(p) { margin: 0.75em 0; }
  .body :global(blockquote) {
    margin: 1em 0;
    padding: 8px 16px;
    border-left: 3px solid var(--accent);
    color: var(--ink-soft);
    font-style: italic;
  }
  .body :global(img) {
    max-width: 100%;
    border-radius: var(--radius);
    margin: 1em 0;
  }
  .body :global(a) {
    color: var(--accent);
  }
</style>
