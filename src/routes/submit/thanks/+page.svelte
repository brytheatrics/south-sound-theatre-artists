<svelte:head>
  <title>Thanks - South Sound Theatre Artists</title>
</svelte:head>

<main class="thanks">
  <span class="eyebrow"><span class="num">→</span>Submission received</span>
  <h1 class="h1-display">
    Check your <span class="serif-it">inbox</span>.
  </h1>
  <p class="lede">
    We've sent a verification link to your email. Click it within 24 hours to
    add your profile to the review queue.
  </p>
  <p class="body-text">
    After you confirm, our admin will review your profile and publish it,
    usually within a day or two. You'll get an email when it's live, with a
    magic link you can use to make edits any time.
  </p>
  <p class="hint">
    Didn't see the email? Check your spam folder. If it's not there, you can
    <a href="/submit">resubmit</a> or <a href="/contact">get in touch</a>.
  </p>
</main>

<style>
  .thanks {
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
    margin: 0 0 0.5rem;
  }
  .hint {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--muted);
    margin-top: 1.5rem;
  }
  .hint a {
    color: var(--accent);
  }
</style>
