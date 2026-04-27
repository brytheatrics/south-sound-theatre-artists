<script lang="ts">
  let { form } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Resend my edit link - SSTA</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>Edit your profile</span>
  <h1 class="h1-display">
    Resend your <span class="serif-it">link</span>.
  </h1>

  {#if form?.sent}
    <p class="lede">
      If a profile exists with that email, a fresh edit link is on its way.
      Check your inbox.
    </p>
    <p class="hint">Didn't get one? <a href="/edit-link">Try again</a> or
      <a href="/contact">get in touch</a>.</p>
  {:else}
    <p class="lede">
      Enter the email you used when you submitted your profile. We'll send
      a one-time edit link.
    </p>

    <form method="POST" onsubmit={() => (submitting = true)}>
      <label class="field">
        <span>Email</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="email"
          name="email"
          autocomplete="email"
          required
          autofocus
        />
      </label>
      {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
      <button type="submit" class="bt bt-pri" disabled={submitting}>
        {submitting ? "Sending..." : "Send edit link"}
      </button>
    </form>
  {/if}
</main>

<style>
  main {
    max-width: 480px;
    margin: 0 auto;
    padding: clamp(3rem, 8vw, 5rem) var(--page-pad-x);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .h1-display {
    margin: 0.5rem 0 1rem;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--ink-soft);
    margin: 0 0 1rem;
    line-height: 1.5;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field span {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  input {
    padding: 12px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 15px;
    font-family: var(--font-body);
    background: var(--bg-raised);
  }
  input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 11px 20px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
  }
  .bt-pri {
    background: var(--ink);
    color: var(--bg);
  }
  .bt-pri:hover:not(:disabled) {
    background: var(--accent);
  }
  .bt:disabled {
    opacity: 0.5;
    cursor: progress;
  }
  .error {
    color: var(--error);
    font-size: 13px;
    margin: 0;
    font-family: var(--font-body);
  }
  .hint {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 1rem 0 0;
  }
  .hint a {
    color: var(--accent);
  }
</style>
