<script lang="ts">
  let { form } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Verify admin code - SSTA</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>Admin</span>
  <h1 class="h1-display">Enter <span class="serif-it">code</span>.</h1>
  <p class="lede">
    Check the admin inbox for a 6-digit code.
  </p>

  <form
    method="POST"
    onsubmit={() => (submitting = true)}
  >
    <label class="field">
      <span>6-digit code</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        name="code"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="7"
        required
        autofocus
      />
    </label>

    {#if form?.error}
      <p class="error" role="alert">{form.error}</p>
    {/if}

    <button type="submit" class="bt bt-pri" disabled={submitting}>
      {submitting ? "Verifying..." : "Sign in"}
    </button>

    <p class="meta">
      Code expires in 10 minutes. <a href="/admin/login">Start over</a>.
    </p>
  </form>
</main>

<style>
  main {
    max-width: 420px;
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
    color: var(--muted);
    margin: 0 0 1rem;
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
    font-size: 24px;
    font-family: var(--font-mono);
    background: var(--bg-raised);
    text-align: center;
    letter-spacing: 0.4em;
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
  .meta {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 1rem 0 0;
  }
  .meta a {
    color: var(--accent);
  }
</style>
