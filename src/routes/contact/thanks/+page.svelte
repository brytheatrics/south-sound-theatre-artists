<svelte:head>
  <title>Message sent - SSTA</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">✓</span>Sent</span>
  <h1 class="h1-display">Got it. <span class="serif-it">Thanks.</span></h1>
  <p class="lede">
    We'll respond as soon as we can - usually within a couple of days,
    longer if it lands over a weekend. Reply will come from
    <code>lexi@southsoundtheatreartists.org</code>.
  </p>
  <p class="lede">
    Back to <a href="/">home</a>.
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
  .h1-display { margin: 0.5rem 0 1rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--ink-soft);
    line-height: 1.55;
    margin: 0;
  }
  .lede a { color: var(--accent); }
  code { font-family: var(--font-mono); font-size: 14px; }
</style>
