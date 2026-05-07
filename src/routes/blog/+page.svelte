<script lang="ts">
  import { renderMarkdown } from "$lib/util/markdown";
  let { data } = $props();

  function fmtDate(iso: string | null): string {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function preview(md: string): string {
    // Strip basic markdown for the listing snippet. Conservative.
    const text = md
      .replace(/```[\s\S]*?```/g, "")
      .replace(/[#>*_`~\[\]\(\)!]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 220 ? text.slice(0, 220) + "..." : text;
  }
</script>

<svelte:head>
  <title>Blog - South Sound Theatre Artists</title>
  <meta
    name="description"
    content={data.lede ? data.lede.slice(0, 160) : "Notes from the SSTA team."}
  />
</svelte:head>

<article class="page">
  <header class="head">
    <span class="eyebrow"><span class="num">·</span>Blog</span>
    <h1 class="t">Notes</h1>
    {#if data.lede}
      <div class="prose lede">{@html renderMarkdown(data.lede)}</div>
    {/if}
  </header>

  {#if data.posts.length === 0}
    <div class="prose empty">{@html renderMarkdown(data.emptyState)}</div>
  {:else}
    <ul class="posts">
      {#each data.posts as p (p.slug)}
        <li class="post">
          {#if p.cover_url}
            <a class="cover-link" href={`/blog/${p.slug}`}>
              <img src={p.cover_url} alt="" loading="lazy" />
            </a>
          {/if}
          <div class="meta">
            <a class="title-link" href={`/blog/${p.slug}`}>
              <h2 class="post-t">{p.title}</h2>
            </a>
            <p class="byline">
              {p.author_display_name} · {fmtDate(p.published_at)}
            </p>
            <p class="snip">{preview(p.body_markdown)}</p>
            <a class="read-more" href={`/blog/${p.slug}`}>Read more →</a>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</article>

<style>
  .page {
    max-width: 760px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  .head { display: flex; flex-direction: column; gap: 8px; }
  .eyebrow { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); display: inline-flex; gap: 8px; }
  .num { color: var(--accent); }
  .t {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(34px, 6vw, 56px);
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.025em;
  }
  .lede {
    font-family: var(--font-body);
    font-size: 17px;
    color: var(--ink-soft);
    line-height: 1.55;
  }
  .empty {
    padding: 14px 16px;
    border: 1px dashed var(--rule);
    border-radius: var(--radius);
    color: var(--muted);
    font-family: var(--font-body);
  }
  .posts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1.5rem; }
  .post { display: grid; grid-template-columns: 1fr 2fr; gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--rule); }
  .post:last-child { border-bottom: 0; }
  @media (max-width: 600px) { .post { grid-template-columns: 1fr; } }
  .cover-link { display: block; }
  .cover-link img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius); aspect-ratio: 16/10; }
  .meta { display: flex; flex-direction: column; gap: 6px; }
  .title-link { color: var(--ink); text-decoration: none; }
  .title-link:hover .post-t { color: var(--accent); }
  .post-t {
    margin: 0;
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.2;
  }
  .byline { margin: 0; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .snip { margin: 0; font-family: var(--font-body); font-size: 14px; color: var(--ink-soft); line-height: 1.5; }
  .read-more { font-family: var(--font-body); font-size: 13px; color: var(--accent); text-decoration: none; align-self: flex-start; }
  .read-more:hover { text-decoration: underline; }
</style>
