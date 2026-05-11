<script lang="ts">
  import { renderMarkdown } from "$lib/util/markdown";
  import KofiWidget from "$lib/components/KofiWidget.svelte";
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.content.title ?? "Support us"} - South Sound Theatre Artists</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>Support us</span>
  <article class="prose">{@html renderMarkdown(data.content.body_markdown)}</article>
  <KofiWidget />
</main>

<style>
  main {
    /* Match StaticPage's container width so /support-us reads the
       same on desktop as /about, /privacy, /terms, /contact. */
    max-width: 1040px;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
</style>
