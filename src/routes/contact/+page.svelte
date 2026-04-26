<svelte:head>
  <title>Contact - South Sound Theatre Artists</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>Contact</span>
  <h1 class="h1-display">Get in <span class="serif-it">touch</span>.</h1>

  <p class="lede">
    Questions about the directory, callboard, or your profile? Drop a note
    and we'll get back to you.
  </p>

  <p class="body">
    For now, email <a href="mailto:lexi@southsoundtheatreartists.com">lexi@southsoundtheatreartists.com</a>.
    A proper contact form lands in the next update.
  </p>
</main>

<style>
  main {
    max-width: 600px;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) 4rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .h1-display {
    margin: 0.5rem 0 1.5rem;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: clamp(18px, 2vw, 22px);
    color: var(--ink-soft);
    line-height: 1.5;
    margin: 0 0 1rem;
  }
  .body {
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.65;
    color: var(--ink-soft);
    margin: 0;
  }
</style>
