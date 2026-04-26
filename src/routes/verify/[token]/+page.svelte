<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Verify your email - South Sound Theatre Artists</title>
</svelte:head>

<main class="verify">
  {#if data.state === "verified"}
    <span class="eyebrow"><span class="num">✓</span>Email verified</span>
    <h1 class="h1-display">
      You're <span class="serif-it">in</span>.
    </h1>
    <p class="body-text">
      Your profile is now in the review queue. Our admin will look it over
      and publish it within a day or two. You'll get an email when it's live,
      with a magic link you can use to make edits any time.
    </p>
  {:else if data.state === "already_verified"}
    <span class="eyebrow"><span class="num">·</span>Already verified</span>
    <h1 class="h1-display">Looks good.</h1>
    <p class="body-text">
      This link has already been used. Your profile is either in the review
      queue or already live in the directory.
    </p>
  {:else if data.state === "expired"}
    <span class="eyebrow"><span class="num">!</span>Link expired</span>
    <h1 class="h1-display">
      Try <span class="serif-it">again</span>.
    </h1>
    <p class="body-text">
      Verification links expire after 24 hours. <a href="/submit">Submit your
      profile again</a> to get a fresh one - we'll merge it into your
      original entry.
    </p>
  {:else if data.state === "invalid"}
    <span class="eyebrow"><span class="num">?</span>Invalid link</span>
    <h1 class="h1-display">Hm.</h1>
    <p class="body-text">
      This link isn't valid. If you haven't submitted a profile yet,
      <a href="/submit">start here</a>.
    </p>
  {:else}
    <span class="eyebrow"><span class="num">!</span>Something went wrong</span>
    <h1 class="h1-display">Try once more.</h1>
    <p class="body-text">
      Please try the link again, or <a href="/contact">get in touch</a> if
      it keeps failing.
    </p>
  {/if}
</main>

<style>
  .verify {
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
</style>
