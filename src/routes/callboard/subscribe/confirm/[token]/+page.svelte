<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Subscription confirmed - SSTA</title>
</svelte:head>

<main class="confirm">
  {#if data.state === "ok"}
    <span class="eyebrow"><span class="num">·</span>You're in</span>
    <h1 class="h1-display">Subscription <span class="serif-it">confirmed</span>.</h1>
    <p class="lede">
      Thanks {data.email}. Your first weekly digest will land Sunday
      evening, Pacific time. We skip weeks where nothing new is on
      offer, so you won't get an empty email.
    </p>
    <p class="meta">
      <a href="/callboard">Browse the callboard →</a>
      &nbsp;·&nbsp;
      <a href="/calendar">What's playing →</a>
    </p>
  {:else if data.state === "already"}
    <span class="eyebrow"><span class="num">·</span>Already confirmed</span>
    <h1 class="h1-display">All set.</h1>
    <p class="lede">
      You're already signed up - this confirmation link must have
      already been clicked.
    </p>
  {:else}
    <span class="eyebrow"><span class="num">·</span>Couldn't confirm</span>
    <h1 class="h1-display">Link <span class="serif-it">not valid</span>.</h1>
    <p class="lede">
      This confirmation link doesn't match anything in our records.
      It may have expired or been replaced by a newer signup attempt.
      <a href="/callboard/subscribe">Try subscribing again</a>.
    </p>
  {/if}
</main>

<style>
  .confirm {
    max-width: 540px;
    margin: 0 auto;
    padding: clamp(2.5rem, 6vw, 4rem) var(--page-pad-x);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .h1-display { margin: 0.25rem 0 0.5rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--muted);
    margin: 0 0 1.5rem;
    max-width: 50ch;
  }
  .meta {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .meta a { color: var(--accent); }
</style>
