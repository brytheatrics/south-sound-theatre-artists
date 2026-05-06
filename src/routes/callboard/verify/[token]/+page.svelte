<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Verify callboard post - South Sound Theatre Artists</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="wrap">
  {#if data.state === "verified_live"}
    <span class="eyebrow"><span class="num">&#10003;</span>Verified</span>
    <h1 class="h1-display">Your post is <span class="serif-it">live.</span></h1>
    <p class="lede">
      Email confirmed and your post is now live on the callboard. Thanks for
      keeping South Sound theatre connected.
    </p>
    <div class="actions">
      <a class="bt bt-pri" href="/callboard">View the callboard</a>
    </div>

  {:else if data.state === "verified_pending"}
    <span class="eyebrow"><span class="num">&#10003;</span>Verified</span>
    <h1 class="h1-display">Email <span class="serif-it">confirmed.</span></h1>
    <p class="lede">
      Your post is in the review queue and will usually be approved within
      48 hours. You'll get an email when it goes live.
    </p>
    <div class="actions">
      <a class="bt bt-ghost" href="/callboard">Back to callboard</a>
    </div>

  {:else if data.state === "already_verified"}
    <span class="eyebrow">Already confirmed</span>
    <h1 class="h1-display">Already <span class="serif-it">confirmed.</span></h1>
    <p class="lede">
      This link has already been used. Your post is in the queue (or already
      live if you're a verified company).
    </p>
    <div class="actions">
      <a class="bt bt-ghost" href="/callboard">View the callboard</a>
    </div>

  {:else if data.state === "expired"}
    <span class="eyebrow warn-text">Expired</span>
    <h1 class="h1-display">Link <span class="serif-it">expired.</span></h1>
    <p class="lede">
      This confirmation link has expired (links are valid for 24 hours).
      Please submit your post again.
    </p>
    <div class="actions">
      <a class="bt bt-pri" href="/callboard/submit">Resubmit</a>
    </div>

  {:else}
    <span class="eyebrow warn-text">Not found</span>
    <h1 class="h1-display">Link <span class="serif-it">not found.</span></h1>
    <p class="lede">
      This link is invalid or has already been used. If you need help,
      contact us at hello@ssta.org.
    </p>
    <div class="actions">
      <a class="bt bt-ghost" href="/callboard">Back to callboard</a>
    </div>
  {/if}
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
  .warn-text { color: var(--error); }
  .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.5rem; }
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
