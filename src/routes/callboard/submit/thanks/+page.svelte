<svelte:head>
  <title>Check your email - South Sound Theatre Artists</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="wrap">
  <span class="eyebrow"><span class="num">&#10003;</span>Submitted</span>
  <h1 class="h1-display">Check your <span class="serif-it">email.</span></h1>
  <p class="lede">
    We sent a confirmation link to the address you provided. Click it to
    verify your email and send your post into review.
  </p>
  <p class="body">
    Verified companies go live as soon as you confirm. Everyone else goes
    into a short review queue - usually approved within 48 hours.
  </p>
  <div class="actions">
    <a class="bt bt-ghost" href="/callboard">Back to callboard</a>
    <a class="bt bt-pri" href="/callboard/submit">Submit another post</a>
  </div>
</main>

<style>
  .wrap {
    max-width: 600px;
    margin: 0 auto;
    padding: clamp(3rem, 8vw, 6rem) 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: clamp(16px, 2vw, 18px);
    color: var(--ink-soft);
    line-height: 1.5;
    margin: 0;
  }
  .body {
    font-size: 15px;
    color: var(--ink-soft);
    line-height: 1.6;
    margin: 0;
  }
  .actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 10px 18px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
  .bt-pri { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); text-decoration: none; }
  .bt-ghost { background: transparent; color: var(--ink); border-color: var(--rule); }
  .bt-ghost:hover { border-color: var(--ink); text-decoration: none; }
</style>
