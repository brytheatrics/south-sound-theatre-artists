<svelte:head>
  <title>Directory - South Sound Theatre Artists</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">→</span>Directory</span>
  <h1 class="h1-display">
    Coming <span class="serif-it">soon</span>.
  </h1>
  <p class="lede">
    The full searchable directory ships in the next update. For now, you
    can see a few profiles on the <a href="/">homepage</a>, or
    <a href="/submit">submit your own</a>.
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
