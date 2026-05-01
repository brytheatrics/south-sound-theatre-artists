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
    /* Wider container on desktop so static pages don't feel anemic on
       big screens. Per-paragraph line length is capped at 880px in
       app.css; headings + the team headshot float can span the
       wider main. */
    max-width: 1040px;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  /* The .prose styling lives in app.css so the admin preview pane can
     share it - both surfaces render identically. */
</style>
