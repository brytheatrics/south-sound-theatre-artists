<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>You're still listed - South Sound Theatre Artists</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="page">
  <span class="eyebrow"><span class="num">·</span>Confirmed</span>
  <h1 class="h1-display">Thanks, <span class="serif-it">{data.name}</span>.</h1>
  <p class="lede">
    We've marked your profile as still active. No further action needed -
    your listing stays right where it is.
  </p>

  <div class="actions">
    <a class="bt bt-pri" href="/artists/{data.slug}">View your profile →</a>
    <a class="bt bt-ghost" href="/">Back to home</a>
  </div>
</main>

<style>
  .page {
    max-width: 580px;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 3.5rem) var(--page-pad-x) 4rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .eyebrow .num { color: var(--accent); margin-right: 0.4em; }
  .h1-display {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 600;
    letter-spacing: -0.025em;
    margin: 0.5rem 0 0.5rem;
  }
  .serif-it {
    font-family: var(--font-accent);
    font-style: italic;
    font-weight: 400;
    color: var(--accent);
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--muted);
    margin: 0 0 1.5rem;
    line-height: 1.55;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 1rem;
  }
  .bt {
    display: inline-block;
    padding: 0.5rem 1rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    text-decoration: none;
    font-size: 14px;
    font-family: var(--font-body);
  }
  .bt:hover {
    border-color: var(--accent);
    color: var(--accent);
    text-decoration: none;
  }
  .bt-pri {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--bg);
  }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); color: white; }
</style>
