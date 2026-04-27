<script lang="ts">
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>{page.status} - South Sound Theatre Artists</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>Error</span>
  {#if page.status === 404}
    <h1 class="h1-display">Not <span class="serif-it">found</span>.</h1>
    <p class="lede">
      The page you wanted isn't here. <a href="/">Head home</a> or
      <a href="/directory">browse the directory</a>.
    </p>
  {:else if page.status >= 500}
    <h1 class="h1-display">Back <span class="serif-it">soon</span>.</h1>
    <p class="lede">
      Something on our end is having a moment. We're aware and working on
      it. Try again in a few minutes, or
      <a href="/contact">get in touch</a> if it keeps happening.
    </p>
    {#if page.error?.message}
      <p class="trace">{page.error.message}</p>
    {/if}
  {:else}
    <h1 class="h1-display">{page.status}</h1>
    <p class="lede">{page.error?.message ?? "Something went wrong."}</p>
  {/if}
</main>

<style>
  main {
    max-width: 600px;
    margin: 0 auto;
    padding: clamp(3rem, 8vw, 6rem) var(--page-pad-x);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .h1-display {
    margin: 0.5rem 0 1rem;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--ink-soft);
    line-height: 1.55;
    margin: 0;
  }
  .trace {
    margin-top: 1rem;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
</style>
