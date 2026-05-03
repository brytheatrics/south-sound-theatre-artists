<svelte:head>
  <title>Submitted - South Sound Theatre Artists</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="masthead">
  <div class="masthead-body">
    <span class="eyebrow"><span class="num">—</span>Submitted</span>
    <h1 class="h1-display">
      Check your inbox.
    </h1>
    <p class="lede">
      We sent a verification link to the email you entered. Click it
      within 24 hours to confirm your submission. After that, our admin
      gives it a quick look-over and approves it onto the calendar.
    </p>
    <p class="lede small">
      Didn't get the email? Check spam, then try submitting again - if
      it still doesn't show up, get in touch via
      <a href="/contact">the contact form</a>.
    </p>
    <a class="bt bt-pri" href="/calendar">Back to the calendar</a>
  </div>
</header>

<style>
  .masthead {
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) clamp(2rem, 4vw, 3rem);
  }
  .masthead-body { max-width: 640px; }
  .eyebrow {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin-bottom: 0.5rem;
  }
  .eyebrow .num { color: var(--accent); margin-right: 0.4em; }
  .h1-display {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 600;
    margin: 0 0 0.75rem;
  }
  .lede { color: var(--ink-soft); margin: 0 0 0.75rem; max-width: 60ch; }
  .lede.small { font-size: 0.9rem; }
  .bt {
    display: inline-block;
    margin-top: 1rem;
    padding: 0.6rem 1.1rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    text-decoration: none;
    font-size: 0.9rem;
  }
  .bt-pri { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); color: white; text-decoration: none; }
</style>
