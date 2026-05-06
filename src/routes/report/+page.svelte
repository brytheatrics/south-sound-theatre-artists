<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let submitting = $state(false);
  const errors = $derived((form?.errors ?? {}) as Record<string, string>);
</script>

<svelte:head>
  <title>Report a profile - SSTA</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>Report</span>
  <h1 class="h1-display">Report a <span class="serif-it">profile</span>.</h1>

  {#if !data.profile}
    <p class="lede">
      We couldn't find the profile you wanted to report. <a href="/directory">Pick a profile from the directory</a>.
    </p>
  {:else}
    <p class="lede">
      Reporting <strong>{data.profile.full_name}</strong> at
      <code>/artists/{data.profile.slug}</code>. The admin reviews every
      report.
    </p>

    {#if errors._form}<div class="form-error" role="alert">{errors._form}</div>{/if}

    <form method="POST" use:enhance={() => { submitting = true; return async ({ update }) => { await update({ reset: false }); submitting = false; }; }}>
      <div class="honeypot" aria-hidden="true">
        <label for="website_url_extra">Leave empty</label>
        <input id="website_url_extra" name="website_url_extra" type="text" tabindex="-1" autocomplete="off" />
      </div>

      <label class="field">
        <span>What's the issue?</span>
        <textarea name="reason" rows="6" required aria-invalid={!!errors.reason}>{form?.values?.reason ?? ""}</textarea>
        {#if errors.reason}<span class="error">{errors.reason}</span>{/if}
      </label>

      <label class="field">
        <span>Your email (optional)</span>
        <input
          name="reporter_email"
          type="email"
          value={form?.values?.reporterEmail ?? ""}
          aria-invalid={!!errors.reporter_email}
        />
        <span class="hint">If we need to follow up. Never shared with the reported profile.</span>
        {#if errors.reporter_email}<span class="error">{errors.reporter_email}</span>{/if}
      </label>

      <button type="submit" class="bt bt-pri" disabled={submitting}>
        {submitting ? "Sending..." : "Submit report"}
      </button>
    </form>
  {/if}
</main>

<style>
  main {
    max-width: 600px;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .h1-display { margin: 0.5rem 0 1rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 18px; color: var(--ink-soft); margin: 0 0 1.5rem; }
  .lede code { font-family: var(--font-mono); font-size: 14px; background: var(--paper); padding: 1px 6px; border-radius: 3px; }
  form { display: flex; flex-direction: column; gap: 1rem; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field > span:first-child {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  input, textarea {
    padding: 10px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 15px;
    font-family: var(--font-body);
    background: var(--bg-raised);
  }
  textarea { resize: vertical; min-height: 140px; }
  input:focus, textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .hint { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .error { color: var(--error); font-size: 13px; margin-top: 4px; }
  .form-error {
    background: color-mix(in oklch, var(--error), var(--bg) 80%);
    border: 1px solid var(--error);
    color: var(--error);
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
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
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt:disabled { opacity: 0.5; cursor: progress; }
  .honeypot { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
</style>
