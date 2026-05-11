<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PageData } from "./$types";

  let { data, form }: { data: PageData; form: any } = $props();

  // svelte-ignore state_referenced_locally
  const v = (form?.values ?? {}) as {
    category?: string;
    name?: string;
    email?: string;
    message?: string;
  };
  let category = $state(v.category ?? "");
  let name = $state(v.name ?? "");
  let email = $state(v.email ?? "");
  let message = $state(v.message ?? "");
  let submitting = $state(false);

  const errors = $derived((form?.errors ?? {}) as Record<string, string>);
  const description = $derived(
    data.categories.find((c) => c.slug === category)?.description ?? "",
  );
</script>

<svelte:head>
  <title>Contact - South Sound Theatre Artists</title>
  <meta name="description" content="Reach out to the South Sound Theatre Artists team. Pick a category, fill in your details, and we'll respond." />
</svelte:head>

<main>
  <header>
    <span class="eyebrow"><span class="num">→</span>Contact</span>
    <h1 class="h1-display">Get in <span class="serif-it">touch</span>.</h1>
    <p class="lede">
      Pick a category, leave a note, we'll come back to you. Required
      fields are marked with <span class="req">*</span>.
    </p>
  </header>

  {#if errors._form}
    <div class="form-error" role="alert"><strong>{errors._form}</strong></div>
  {/if}

  <form method="POST" use:enhance={() => { submitting = true; return async ({ update }) => { await update({ reset: false }); submitting = false; }; }}>
    <div class="honeypot" aria-hidden="true">
      <label for="website_url_extra">Leave this empty</label>
      <input id="website_url_extra" name="website_url_extra" type="text" tabindex="-1" autocomplete="off" />
    </div>

    <label class="field">
      <span>What's this about? <span class="req">*</span></span>
      <select name="category" bind:value={category} required>
        <option value="">Choose...</option>
        {#each data.categories as c (c.slug)}
          <option value={c.slug}>{c.label}</option>
        {/each}
      </select>
      {#if description}<p class="hint">{description}</p>{/if}
      {#if errors.category}<span class="error">{errors.category}</span>{/if}
    </label>

    <label class="field">
      <span>Your name <span class="req">*</span></span>
      <input name="name" type="text" required bind:value={name} />
      {#if errors.name}<span class="error">{errors.name}</span>{/if}
    </label>

    <label class="field">
      <span>Your email <span class="req">*</span></span>
      <input name="email" type="email" required bind:value={email} />
      {#if errors.email}<span class="error">{errors.email}</span>{/if}
    </label>

    <label class="field">
      <span>Message <span class="req">*</span></span>
      <textarea name="message" rows="8" required maxlength="5000" bind:value={message}></textarea>
      {#if errors.message}<span class="error">{errors.message}</span>{/if}
    </label>

    <button class="bt bt-pri" type="submit" disabled={submitting}>
      {submitting ? "Sending..." : "Send message"}
    </button>
  </form>
</main>

<style>
  main {
    max-width: 600px;
    margin: 0 auto;
    padding: clamp(2.5rem, 5vw, 4rem) var(--page-pad-x) 4rem;
  }
  header { margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 1rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 17px;
    color: var(--ink-soft);
    line-height: 1.5;
    margin: 0;
  }
  form { display: flex; flex-direction: column; gap: 1.25rem; }
  .field { display: flex; flex-direction: column; gap: 0.4rem; font-size: 14px; }
  .field span { font-weight: 600; color: var(--ink); }
  .field input, .field select, .field textarea {
    font: inherit;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink);
  }
  .hint { font-size: 13px; color: var(--ink-soft); font-style: italic; margin: 0; }
  .error { color: var(--warn); font-size: 13px; }
  .req { color: var(--accent); }
  .form-error {
    padding: 0.75rem 1rem;
    background: color-mix(in oklch, var(--warn), transparent 90%);
    border: 1px solid var(--warn);
    border-radius: var(--radius);
    margin-bottom: 1rem;
    color: var(--ink);
  }
  .honeypot { position: absolute; left: -9999px; height: 0; overflow: hidden; }
  .bt {
    font: inherit;
    padding: 0.7rem 1.5rem;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    align-self: flex-start;
  }
  .bt-pri {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); }
  .bt[disabled] { opacity: 0.6; cursor: progress; }
</style>
