<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Unsubscribe - SSTA Callboard</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="wrap">
  <span class="eyebrow"><span class="num">·</span>Callboard digest</span>
  {#if data.state === "ok"}
    <h1 class="h1-display">Unsubscribed.</h1>
    <p class="lede">
      We won't send any more weekly callboard digests to {data.email}.
    </p>
    <p>
      You can still browse <a href="/callboard">the callboard</a> any time. If
      you'd like to opt back in later, just let us know via the
      <a href="/contact">contact page</a>.
    </p>
  {:else if data.state === "already"}
    <h1 class="h1-display">Already off the list.</h1>
    <p class="lede">
      {data.email} is already unsubscribed - no action needed.
    </p>
    <p><a href="/callboard">Back to the callboard</a></p>
  {:else}
    <h1 class="h1-display">Link looks invalid.</h1>
    <p class="lede">
      That unsubscribe link doesn't match an active subscription. It may
      have already been used, or it may be malformed.
    </p>
    <p>
      Try the <a href="/contact">contact page</a> if you need help.
    </p>
  {/if}
</main>

<style>
  .wrap {
    max-width: 640px;
    margin: 0 auto;
    padding: clamp(3rem, 8vw, 6rem) var(--page-pad-x);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .h1-display { margin: 0.5rem 0 0; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    color: var(--ink-soft);
    margin: 0.5rem 0 1rem;
  }
</style>
