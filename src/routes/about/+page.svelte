<svelte:head>
  <title>About - South Sound Theatre Artists</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>About</span>
  <h1 class="h1-display">A directory <span class="serif-it">for us</span>, by us.</h1>

  <p class="lede">
    South Sound Theatre Artists is a free, community-run home for the actors,
    directors, designers, technicians, and stage managers working between
    Tacoma and Gig Harbor.
  </p>

  <h2 class="h2-section">Why this exists</h2>
  <p class="body">
    Theatre work in the South Sound mostly happens through word of mouth.
    That works until it doesn't - newcomers can't find their way in, and
    directors rebuild the same shortlists every season. This site is meant
    to make us all easier to find without putting anything behind a paywall
    or an account.
  </p>

  <h2 class="h2-section">How it works</h2>
  <p class="body">
    Anyone can browse. Submitting a profile takes about five minutes and
    one email-verification click. An admin reviews each new profile and
    publishes it, usually within a day or two. Edits go through a magic
    link to your own email - no passwords, no recovery flows.
  </p>

  <h2 class="h2-section">Who runs it</h2>
  <p class="body">
    The site is maintained by a single volunteer admin. Hosting, email,
    and image storage all run on free tiers. If it ever stops being free,
    the goal is to find another free way before charging anyone.
  </p>

  <p class="cta">
    <a href="/submit">Submit your profile <span aria-hidden="true">↗</span></a>
  </p>
</main>

<style>
  main {
    max-width: 700px;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .h1-display {
    margin: 0.5rem 0 1.5rem;
  }
  .h2-section {
    margin: 1.5rem 0 0.25rem;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: clamp(18px, 2vw, 22px);
    color: var(--ink-soft);
    line-height: 1.5;
    margin: 0 0 1rem;
    max-width: 560px;
  }
  .body {
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.65;
    color: var(--ink-soft);
    margin: 0;
    max-width: 560px;
  }
  .cta {
    margin-top: 2rem;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }
  .cta a {
    color: var(--accent);
    text-decoration: none;
  }
  .cta a:hover {
    color: var(--ink);
  }
</style>
