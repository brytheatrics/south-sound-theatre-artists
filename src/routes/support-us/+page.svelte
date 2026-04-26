<svelte:head>
  <title>Support us - South Sound Theatre Artists</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>Support us</span>
  <h1 class="h1-display">Help keep this <span class="serif-it">free</span>.</h1>

  <p class="lede">
    The site runs on free tiers and volunteer time. If you'd like to help
    cover the eventual domain renewal or buy the admin a coffee, that
    keeps everything moving.
  </p>

  <p class="body">
    Ko-fi tip jar coming soon. For now, the best way to support the
    project is to <a href="/submit">add your profile</a> and tell other
    South Sound artists about it.
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
