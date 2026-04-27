<script lang="ts">
  let { form } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Admin login - SSTA</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>Admin</span>
  <h1 class="h1-display">Sign in.</h1>

  <form
    method="POST"
    onsubmit={() => (submitting = true)}
  >
    <label class="field">
      <span>Password</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="password"
        name="password"
        autocomplete="current-password"
        required
        autofocus
      />
    </label>

    {#if form?.error}
      <p class="error" role="alert">{form.error}</p>
    {/if}

    <button type="submit" class="bt bt-pri" disabled={submitting}>
      {submitting ? "Sending code..." : "Continue"}
    </button>

    <p class="meta">
      A 6-digit code will be sent to the admin email. The code expires in
      10 minutes.
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
    margin: 0.5rem 0 1.5rem;
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
  .meta {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 1rem 0 0;
    line-height: 1.6;
  }
</style>
