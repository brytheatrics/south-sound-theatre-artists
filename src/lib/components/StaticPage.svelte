<script lang="ts">
  import { renderMarkdown } from "$lib/util/markdown";

  type Props = {
    title: string | null;
    bodyMarkdown: string;
    eyebrow?: string;
  };
  let { title, bodyMarkdown, eyebrow }: Props = $props();
</script>

<svelte:head>
  <title>{title ?? "South Sound Theatre Artists"} - SSTA</title>
</svelte:head>

<main>
  {#if eyebrow}
    <span class="eyebrow"><span class="num">·</span>{eyebrow}</span>
  {/if}
  <article class="prose">{@html renderMarkdown(bodyMarkdown)}</article>
</main>

<style>
  main {
    max-width: 700px;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .prose {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-family: var(--font-body);
    color: var(--ink-soft);
  }
  .prose :global(h1) {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    line-height: 1.02;
    letter-spacing: -0.04em;
    font-size: clamp(40px, 8vw, 88px);
    margin: 0.5rem 0 1.5rem;
  }
  /* Editorial italic accent - admins write *word* in a heading to get
     this moss-green DM Serif Display italic treatment. */
  .prose :global(h1 em),
  .prose :global(h2 em),
  .prose :global(h3 em) {
    font-family: var(--font-accent);
    font-style: italic;
    font-weight: 400;
    color: var(--accent);
    letter-spacing: -0.02em;
  }
  .prose :global(h2) {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    font-size: clamp(20px, 2.4vw, 28px);
    letter-spacing: -0.015em;
    margin: 2.5rem 0 0.5rem;
  }
  .prose :global(h3) {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    font-size: 18px;
    margin: 1.5rem 0 0.5rem;
  }
  .prose :global(p) {
    font-size: 16px;
    line-height: 1.65;
    color: var(--ink-soft);
    margin: 0;
    max-width: 580px;
  }
  /* Lede: first paragraph after the H1. Larger, serif italic, muted -
     same treatment as the homepage and other landing-style intros. */
  .prose :global(h1 + p) {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: clamp(18px, 2vw, 22px);
    line-height: 1.5;
    color: var(--muted);
    margin-bottom: 1rem;
  }
  /* Body italic (not headings, not the lede) gets a quieter moss accent
     for inline emphasis. */
  .prose :global(p em) {
    font-family: var(--font-accent);
    font-style: italic;
    color: var(--accent);
  }
  .prose :global(ul) {
    margin: 0.5rem 0;
    padding-left: 22px;
    color: var(--ink-soft);
  }
  .prose :global(li) {
    margin: 6px 0;
    font-size: 16px;
    line-height: 1.6;
  }
  .prose :global(a) {
    color: var(--accent);
    text-decoration: none;
  }
  .prose :global(a:hover) {
    text-decoration: underline;
  }
  .prose :global(strong) {
    color: var(--ink);
    font-weight: 600;
  }
  .prose :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: var(--radius);
    margin: 1rem 0;
  }
</style>
