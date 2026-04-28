<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";
  let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
  <title>Apply for verified status - South Sound Theatre Artists</title>
</svelte:head>

<main class="wrap">
  <header class="hd">
    <span class="eyebrow"><span class="num">&#10003;</span>Verified companies</span>
    <h1 class="h1-display">Get <span class="serif-it">verified.</span></h1>
    <p class="lede">
      Verified South Sound producing companies can post to the callboard
      without per-post admin review - posts go live immediately after email
      confirmation.
    </p>
    <p class="body">
      We verify by hand, usually within 48 hours. We're looking for established
      producing organizations based in the South Sound region.
    </p>
  </header>

  {#if form?.errors?._form}
    <div class="form-error" role="alert">{form.errors._form}</div>
  {/if}

  <form method="POST" use:enhance class="form">
    <!-- Honeypot -->
    <input type="text" name="website_url_extra" style="display:none" tabindex="-1" autocomplete="off" />

    <div class="field">
      <label for="name" class="label">Organization name <span class="req">*</span></label>
      <input
        id="name"
        name="name"
        type="text"
        class="input"
        class:error={!!form?.errors?.name}
        value={form?.values?.name ?? ""}
        placeholder="Lakewood Playhouse"
        required
      />
      {#if form?.errors?.name}
        <p class="field-error">{form.errors.name}</p>
      {/if}
    </div>

    <div class="field">
      <label for="contact_name" class="label">Your name <span class="req">*</span></label>
      <input
        id="contact_name"
        name="contact_name"
        type="text"
        class="input"
        class:error={!!form?.errors?.contact_name}
        value={form?.values?.contactName ?? ""}
        required
      />
      {#if form?.errors?.contact_name}
        <p class="field-error">{form.errors.contact_name}</p>
      {/if}
    </div>

    <div class="field">
      <label for="contact_email" class="label">
        Email address <span class="req">*</span>
        <span class="label-hint">Use the address you'll post from. Posts from this address go live immediately once verified.</span>
      </label>
      <input
        id="contact_email"
        name="contact_email"
        type="email"
        class="input"
        class:error={!!form?.errors?.contact_email}
        value={form?.values?.contactEmail ?? ""}
        required
      />
      {#if form?.errors?.contact_email}
        <p class="field-error">{form.errors.contact_email}</p>
      {/if}
    </div>

    <div class="field">
      <label for="website_url" class="label">Website</label>
      <input
        id="website_url"
        name="website_url"
        type="url"
        class="input"
        class:error={!!form?.errors?.website_url}
        value={form?.values?.websiteUrl ?? ""}
        placeholder="https://..."
      />
      {#if form?.errors?.website_url}
        <p class="field-error">{form.errors.website_url}</p>
      {/if}
    </div>

    <div class="field">
      <label for="description" class="label">
        About your organization
        <span class="label-hint">Briefly describe your company, where you produce, and what kind of work you do.</span>
      </label>
      <textarea
        id="description"
        name="description"
        class="textarea"
        rows="4"
      >{form?.values?.description ?? ""}</textarea>
    </div>

    <div class="submit-row">
      <button type="submit" class="bt bt-pri">Submit application &rarr;</button>
    </div>
  </form>

  <div class="back-row">
    <a href="/callboard" class="back-link">&larr; Back to callboard</a>
  </div>
</main>

<style>
  .wrap {
    max-width: 620px;
    margin: 0 auto;
    padding: clamp(2.5rem, 6vw, 3.5rem) 0 4rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  .hd { display: flex; flex-direction: column; gap: 0.75rem; }
  .h1-display { margin: 0.5rem 0 0; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: clamp(16px, 2vw, 18px);
    color: var(--ink-soft);
    line-height: 1.5;
    margin: 0;
  }
  .body { font-size: 15px; color: var(--ink-soft); line-height: 1.6; margin: 0; }
  .form { display: flex; flex-direction: column; gap: 1.25rem; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .label {
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label-hint { font-size: 12px; font-weight: 400; color: var(--muted); line-height: 1.4; }
  .req { color: var(--accent); }
  .input, .textarea {
    font-family: var(--font-body);
    font-size: 14px;
    padding: 9px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink);
    width: 100%;
    box-sizing: border-box;
  }
  .input:focus, .textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .input.error { border-color: var(--warn); }
  .textarea { resize: vertical; line-height: 1.5; }
  .field-error { font-size: 12px; color: var(--warn); margin: 0; }
  .form-error {
    background: color-mix(in oklch, var(--warn), var(--bg) 80%);
    border: 1px solid var(--warn);
    color: var(--warn);
    padding: 12px 16px;
    border-radius: var(--radius);
    font-size: 14px;
  }
  .submit-row { padding-top: 0.5rem; }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 11px 20px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
  .bt-pri { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); }
  .back-row { border-top: 1px solid var(--rule-soft); padding-top: 1rem; }
  .back-link {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    text-decoration: none;
  }
  .back-link:hover { color: var(--ink); }
</style>
