<svelte:head>
  <title>Saved - SSTA</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">✓</span>Saved</span>
  <h1 class="h1-display">Changes <span class="serif-it">saved</span>.</h1>
  <p class="lede">
    Your profile is updated. The edit link you used has been retired -
    request a fresh one from <a href="/edit-link">edit-link</a> next time
    you want to make changes.
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
