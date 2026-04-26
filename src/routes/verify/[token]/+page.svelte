<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Verify your email - South Sound Theatre Artists</title>
</svelte:head>

<main>
  {#if data.state === "verified"}
    <h1>Email verified</h1>
    <p>
      Thanks. Your profile is now in the review queue. Our admin will look
      it over and publish it within a day or two. You'll get an email when
      it's live, with a magic link you can use to make edits any time.
    </p>
  {:else if data.state === "already_verified"}
    <h1>Already verified</h1>
    <p>
      This link has already been used. Your profile is either in the review
      queue or already live.
    </p>
  {:else if data.state === "expired"}
    <h1>Link expired</h1>
    <p>
      Verification links expire after 24 hours. <a href="/submit">Submit
      your profile again</a> to get a fresh one - we'll merge it into your
      original entry.
    </p>
  {:else if data.state === "invalid"}
    <h1>Invalid link</h1>
    <p>
      This link is not valid. If you haven't submitted a profile yet,
      <a href="/submit">start here</a>.
    </p>
  {:else}
    <h1>Something went wrong</h1>
    <p>
      Please try the link again, or
      <a href="/contact">get in touch</a> if it keeps failing.
    </p>
  {/if}
</main>

<style>
  main {
    max-width: 560px;
    margin: 0 auto;
    padding: 3rem 1rem;
    font-family: system-ui, sans-serif;
    color: #222;
    text-align: center;
  }
  h1 {
    color: #2d1f3d;
  }
  p {
    line-height: 1.6;
    color: #444;
  }
  a {
    color: #38817d;
  }
</style>
