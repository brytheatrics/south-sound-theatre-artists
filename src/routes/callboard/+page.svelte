<svelte:head>
  <title>Callboard - South Sound Theatre Artists</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">→</span>Callboard</span>
  <h1 class="h1-display">
    Coming in <span class="serif-it">v1.2</span>.
  </h1>
  <p class="lede">
    Auditions, designer / crew calls, and production announcements show up
    here once the callboard launches. Until then, the
    <a href="/directory">directory</a> is the best way to find collaborators.
  </p>
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
    font-size: clamp(18px, 2vw, 22px);
    color: var(--ink-soft);
    line-height: 1.5;
    margin: 0;
  }
</style>
