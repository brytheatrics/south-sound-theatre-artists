<svelte:head><title>Report sent - SSTA</title></svelte:head>
<main>
  <span class="eyebrow"><span class="num">✓</span>Report sent</span>
  <h1 class="h1-display">Thanks.</h1>
  <p class="lede">
    The admin will look at it. If you left an email, you may hear back if
    they need more info.
  </p>
  <p><a href="/directory" class="bt bt-ghost">Back to directory</a></p>
</main>
<style>
  main { max-width: 560px; margin: 0 auto; padding: clamp(3rem, 8vw, 6rem) var(--page-pad-x); display: flex; flex-direction: column; gap: 1rem; }
  .h1-display { margin: 0.5rem 0 1rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 18px; color: var(--ink-soft); margin: 0 0 1rem; }
  .bt { font-family: var(--font-body); font-size: 14px; padding: 10px 18px; border-radius: var(--radius); border: 1px solid var(--rule); color: var(--ink); text-decoration: none; display: inline-flex; }
  .bt:hover { border-color: var(--ink); text-decoration: none; }
</style>
