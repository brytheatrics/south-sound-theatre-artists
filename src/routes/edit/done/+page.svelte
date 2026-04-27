<script lang="ts">
  import { page } from "$app/state";
  const queued = $derived(page.url.searchParams.get("queued") === "1");
</script>

<svelte:head>
  <title>Saved - SSTA</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">✓</span>Saved</span>
  {#if queued}
    <h1 class="h1-display">Most changes <span class="serif-it">saved</span>.</h1>
    <p class="lede">
      Some of your edits (your name, bio, headshot, or disciplines) need a
      quick admin review before they go live. The rest are already updated
      on your profile. We'll email you if anything is rejected.
    </p>
  {:else}
    <h1 class="h1-display">Changes <span class="serif-it">saved</span>.</h1>
    <p class="lede">
      Your profile is updated.
    </p>
  {/if}
  <p class="lede">
    The edit link you used has been retired - request a fresh one from
    <a href="/edit-link">edit-link</a> next time you want to make changes.
  </p>
</main>

<style>
  main {
    max-width: 560px;
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
</style>
