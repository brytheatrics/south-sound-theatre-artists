<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData, PageData } from "./$types";
  let { data, form }: { data: PageData; form: ActionData } = $props();

  // svelte-ignore state_referenced_locally
  let pickedAreaId = $state<string>(form?.values?.areaId ?? "");
  // svelte-ignore state_referenced_locally
  let pickedCategories = $state<string[]>(form?.values?.categories ?? []);

  function toggleCategory(slug: string) {
    pickedCategories = pickedCategories.includes(slug)
      ? pickedCategories.filter((s) => s !== slug)
      : [...pickedCategories, slug];
  }
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
      >{form?.values?.description ?? ""}</textarea>
    </div>

    <div class="field">
      <span class="label">
        Area <span class="req">*</span>
        <span class="label-hint">Where your organization is based. Drives /theatres grouping + the digest's area filter.</span>
      </span>
      <div class="chip-row" class:error={!!form?.errors?.area_id}>
        {#each data.areas as a (a.id)}
          <label class="chip" class:on={pickedAreaId === a.id}>
            <input
              type="radio"
              name="area_id"
              value={a.id}
              checked={pickedAreaId === a.id}
              onchange={() => (pickedAreaId = a.id)}
              required
            />
            <span>{a.name}</span>
          </label>
        {/each}
      </div>
      {#if form?.errors?.area_id}
        <p class="field-error">{form.errors.area_id}</p>
      {/if}
    </div>

    <div class="field">
      <span class="label">
        Categories <span class="req">*</span>
        <span class="label-hint">Pick all that apply. Drives the chip filter + badges on /theatres. An organization that operates both a mainstage and an educational department should pick both.</span>
      </span>
      <div class="cat-grid">
        {#each data.categoryOptions as opt (opt.slug)}
          <label class="cat-opt" class:on={pickedCategories.includes(opt.slug)}>
            <input
              type="checkbox"
              name="categories"
              value={opt.slug}
              checked={pickedCategories.includes(opt.slug)}
              onchange={() => toggleCategory(opt.slug)}
            />
            <span>{opt.label}</span>
          </label>
        {/each}
      </div>
      {#if form?.errors?.categories}
        <p class="field-error">{form.errors.categories}</p>
      {/if}
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
  .textarea { resize: vertical; line-height: 1.5; min-height: 5rem; }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 4px;
  }
  .chip-row.error { outline: 1px solid var(--warn); border-radius: var(--radius); padding: 4px; }
  .chip {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 0.35rem 0.85rem;
    font-size: 13px;
    color: var(--ink-soft);
    background: transparent;
    cursor: pointer;
    user-select: none;
    transition: border-color 0.12s, background 0.12s, color 0.12s;
  }
  .chip:hover { border-color: var(--ink); color: var(--ink); }
  .chip.on {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  .chip input[type="radio"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 1px;
    height: 1px;
  }

  .cat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 6px 14px;
    margin-top: 4px;
  }
  .cat-opt {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--ink-soft);
    cursor: pointer;
    padding: 4px 0;
  }
  .cat-opt input[type="checkbox"] {
    width: auto;
    margin: 0;
    accent-color: var(--accent);
  }
  .cat-opt.on { color: var(--ink); font-weight: 500; }
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
