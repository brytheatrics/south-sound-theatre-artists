<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Email verified - South Sound Theatre Artists</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="masthead">
  <div class="masthead-body">
    {#if data.verified}
      <span class="eyebrow"><span class="num">—</span>Email verified</span>
      <h1 class="h1-display">Thanks!</h1>
      {#if data.autoApproved}
        <p class="lede">
          <strong>{data.title}</strong> is live on
          <a href="/calendar">the calendar</a> right now. Verified
          companies skip the queue.
        </p>
      {:else}
        <p class="lede">
          We received your submission for <strong>{data.title}</strong>.
          Our admin will give it a quick review and you'll see it on
          <a href="/calendar">the calendar</a> shortly.
        </p>
      {/if}
    {:else if data.alreadyVerified}
      <span class="eyebrow"><span class="num">—</span>Already verified</span>
      <h1 class="h1-display">You've already confirmed this one.</h1>
      <p class="lede">
        <strong>{data.title}</strong> {data.verifiedOrg ? "is on" : "is in line for"}
        <a href="/calendar">the calendar</a>.
      </p>
    {/if}
    <a class="bt bt-pri" href="/calendar">Open the calendar →</a>
  </div>
</header>

<style>
  .masthead { padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) clamp(2rem, 4vw, 3rem); }
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
