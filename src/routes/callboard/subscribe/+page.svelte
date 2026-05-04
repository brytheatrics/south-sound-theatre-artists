<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>Weekly digest signup - SSTA</title>
</svelte:head>

<main class="thanks">
  {#if data.sent}
    <span class="eyebrow"><span class="num">·</span>Almost there</span>
    <h1 class="h1-display">Check <span class="serif-it">your inbox</span>.</h1>
    <p class="lede">
      We just emailed you a confirmation link. Click it and we'll add
      you to the Sunday-evening digest. The note expires harmlessly if
      you ignore it.
    </p>
  {:else}
    <span class="eyebrow"><span class="num">·</span>Subscribe</span>
    <h1 class="h1-display">Weekly <span class="serif-it">digest</span>.</h1>
    <p class="lede">
      One email a week, Sunday evening. New auditions, designer / crew
      calls, and upcoming shows across South Sound theatre.
    </p>

    <form method="POST" class="form">
      <label class="field">
        <span>Email</span>
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          value={(form?.values?.email) ?? ""}
        />
      </label>
      <!-- Honeypot: hidden from users + screen-readers, irresistible to bots. -->
      <label class="hp" aria-hidden="true">
        Website (leave blank): <input type="text" name="website" tabindex="-1" autocomplete="off" />
      </label>

      {#if form?.error}
        <p class="error" role="alert">{form.error}</p>
      {/if}

      <button type="submit" class="bt bt-pri">Subscribe</button>
      <p class="meta">
        We'll send a confirmation email. You can unsubscribe in one
        click any time from the footer of any digest.
      </p>
    </form>
  {/if}
</main>

<style>
  .thanks {
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
  .form { display: flex; flex-direction: column; gap: 1rem; max-width: 420px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field span {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  input {
    padding: 11px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 15px;
    font-family: var(--font-body);
    background: var(--bg-raised);
    color: var(--ink);
  }
  input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 11px 20px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    align-self: flex-start;
  }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover { background: var(--accent); }
  .error { color: var(--error); margin: 0; font-size: 13px; }
  .meta {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 0.5rem 0 0;
    line-height: 1.5;
  }
</style>
