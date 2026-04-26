<svelte:head>
  <title>Terms - South Sound Theatre Artists</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>Legal</span>
  <h1 class="h1-display">Terms.</h1>

  <p class="draft-banner">
    Draft text - not yet reviewed by a lawyer or template service. Real
    terms of service land before public launch.
  </p>

  <h2 class="h2-section">Use of the site</h2>
  <p class="body">
    Browse and read whatever you like. Don't scrape, spam, harass, or
    pretend to be someone you're not. The admin reserves the right to
    remove any profile or post that breaks those.
  </p>

  <h2 class="h2-section">Your content</h2>
  <p class="body">
    Profile content (text, headshot, links) belongs to you. By submitting,
    you grant the directory the right to display that content on the site
    and in associated promotional channels (e.g. featured-artist rotation).
    You can unpublish or delete your profile at any time.
  </p>

  <h2 class="h2-section">Headshot rights</h2>
  <p class="body">
    By uploading a headshot you confirm you have the rights to use it. If
    a photographer credit is required, include it in your bio.
  </p>

  <h2 class="h2-section">Liability</h2>
  <p class="body">
    The site is provided as-is. We do our best to keep it accurate and
    available, but make no guarantees about uptime or the conduct of
    listed artists or theatres.
  </p>
</main>

<style>
  main {
    max-width: 700px;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) 4rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .h1-display {
    margin: 0.5rem 0 1rem;
  }
  .h2-section {
    margin: 1.5rem 0 0.25rem;
  }
  .body {
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.65;
    color: var(--ink-soft);
    margin: 0;
    max-width: 560px;
  }
  .draft-banner {
    background: color-mix(in oklch, var(--warn), var(--bg) 80%);
    border: 1px solid var(--warn);
    color: var(--warn);
    padding: 12px 16px;
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.5;
    margin: 0 0 1.5rem;
  }
</style>
