<script lang="ts">
  let { data, form } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Accept admin invite - SSTA</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>Admin invite</span>
  <h1 class="h1-display">Set your password</h1>
  <p class="lede">
    Hi {data.admin.name ?? data.admin.email}. Pick a password (at least
    12 characters). After this, sign in at /admin/login with your email
    + this password.
  </p>

  <form method="POST" onsubmit={() => (submitting = true)}>
    <label class="field">
      <span>New password</span>
      <input
        type="password"
        name="password"
        autocomplete="new-password"
        required
        minlength="12"
      />
    </label>
    <label class="field">
      <span>Confirm</span>
      <input
        type="password"
        name="confirm"
        autocomplete="new-password"
        required
        minlength="12"
      />
    </label>

    {#if form?.error}
      <p class="error" role="alert">{form.error}</p>
    {/if}

    <button type="submit" class="bt bt-pri" disabled={submitting}>
      {submitting ? "Setting..." : "Set password and continue"}
    </button>
  </form>
</main>

<style>
  main {
    max-width: 460px;
    margin: 0 auto;
    padding: clamp(3rem, 8vw, 5rem) var(--page-pad-x);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    display: inline-flex;
    gap: 8px;
  }
  .num { color: var(--accent); }
  .h1-display {
    margin: 0.5rem 0;
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 600;
    color: var(--ink);
  }
  .lede {
    margin: 0 0 1.5rem;
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--ink-soft);
    line-height: 1.55;
  }
  form { display: flex; flex-direction: column; gap: 1rem; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field span {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  input {
    padding: 12px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 15px;
    background: var(--bg-raised);
  }
  input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    padding: 11px 20px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
  }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:disabled { opacity: 0.5; cursor: progress; }
  .error { color: var(--warn); font-size: 13px; margin: 0; font-family: var(--font-body); }
</style>
