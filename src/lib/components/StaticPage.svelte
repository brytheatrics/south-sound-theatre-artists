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
    letter-spacing: -0.035em;
    font-size: clamp(40px, 7vw, 72px);
    margin: 0 0 1rem;
  }
  .prose :global(h2) {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    font-size: clamp(20px, 2.4vw, 26px);
    letter-spacing: -0.015em;
    margin: 1.5rem 0 0.25rem;
  }
  .prose :global(h3) {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    font-size: 18px;
    margin: 1rem 0 0.25rem;
  }
  .prose :global(p) {
    font-size: 16px;
    line-height: 1.65;
    color: var(--ink-soft);
    margin: 0;
    max-width: 580px;
  }
  .prose :global(ul) {
    margin: 0;
    padding-left: 22px;
    color: var(--ink-soft);
  }
  .prose :global(li) {
    margin: 4px 0;
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
  .prose :global(em) {
    font-family: var(--font-accent);
    font-style: italic;
    color: var(--ink);
  }
  .prose :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: var(--radius);
    margin: 1rem 0;
  }
</style>
