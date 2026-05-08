<script lang="ts">
  import { enhance } from "$app/forms";
  import SchedulePatternEditor from "$lib/components/SchedulePatternEditor.svelte";
  import CreditsSubmitForm from "$lib/components/CreditsSubmitForm.svelte";
  import PosterUpload from "$lib/components/PosterUpload.svelte";
  let { data, form } = $props();

  // Form state. Performances are required (server-side validated).
  // Bind run dates to local state so the SchedulePatternEditor expands
  // against live values as the user types.
  let runStart = $state(((form?.values as Record<string, string> | undefined) ?? {}).runStart ?? "");
  let runEnd = $state(((form?.values as Record<string, string> | undefined) ?? {}).runEnd ?? "");
  let perfs = $state<Array<{ wallClock: string; note: string }>>([]);

  function addPerf() {
    const seedDate = runStart || new Date().toISOString().slice(0, 10);
    perfs = [...perfs, { wallClock: `${seedDate}T19:30`, note: "" }];
  }
  function removePerf(i: number) {
    perfs = perfs.filter((_, j) => j !== i);
  }
  function applyGenerated(generated: Array<{ wallClock: string; note: string }>) {
    perfs = generated;
  }

  let busy = $state(false);
  const v = $derived((form?.values as Record<string, string> | undefined) ?? {});
  const errs = $derived((form?.errors as Record<string, string> | undefined) ?? {});
</script>

<svelte:head>
  <title>Post a performance - South Sound Theatre Artists</title>
  <meta
    name="description"
    content="Submit an upcoming theatre performance to the South Sound calendar."
  />
</svelte:head>

<header class="masthead">
  <div class="masthead-body">
    <span class="eyebrow"><span class="num">—</span>Post a performance</span>
    <h1 class="h1-display">
      Add your show to <span class="serif-it">What's Playing</span>.
    </h1>
    <p class="lede">
      Plays, musicals, staged readings, special events. After you submit,
      we'll send a verification link to your email. Once you click it,
      your post lands in the admin queue for a quick review.
    </p>
    <p class="lede small">
      <strong>Verified theatre companies</strong> skip the queue - your
      show goes live immediately on email verify. Apply at
      <a href="/callboard/apply-verified">/callboard/apply-verified</a>.
    </p>
  </div>
</header>

{#if errs._form}
  <div class="form-error" role="alert">{errs._form}</div>
{/if}

<form method="POST" use:enhance={() => { busy = true; return async ({ update }) => { await update(); busy = false; }; }} class="form">
  <!-- Honeypot -->
  <label class="honeypot" aria-hidden="true" tabindex="-1">
    Leave this empty
    <input name="website_url_extra" type="text" tabindex="-1" autocomplete="off" />
  </label>

  <!-- Hidden serialised performances. Updates reactively. -->
  <input type="hidden" name="performances_json" value={JSON.stringify(perfs)} />

  <h2 class="block-title">The show</h2>

  <label class="field">
    <span>Title <em>required</em></span>
    <input name="title" type="text" required value={v.title ?? ""} />
    <span class="hint">Will be saved in ALL CAPS so the calendar reads consistently.</span>
    {#if errs.title}<span class="err">{errs.title}</span>{/if}
  </label>

  <label class="field">
    <span>Organization / theatre <em>required</em></span>
    <input name="organization_name" type="text" required value={v.organizationName ?? ""} />
    {#if errs.organization_name}<span class="err">{errs.organization_name}</span>{/if}
  </label>

  <div class="row-2">
    <label class="field">
      <span>Run start <em>required</em></span>
      <input name="run_start" type="date" required bind:value={runStart} />
      {#if errs.run_start}<span class="err">{errs.run_start}</span>{/if}
    </label>
    <label class="field">
      <span>Run end <em>required</em></span>
      <input name="run_end" type="date" required bind:value={runEnd} />
      {#if errs.run_end}<span class="err">{errs.run_end}</span>{/if}
    </label>
  </div>

  <div class="row-2">
    <label class="field">
      <span>Category <em>required</em></span>
      <select name="category_id" required>
        <option value="">— pick —</option>
        {#each data.categories as c (c.id)}
          <option value={c.id} selected={v.categoryId === c.id}>{c.name}</option>
        {/each}
      </select>
      {#if errs.category_id}<span class="err">{errs.category_id}</span>{/if}
    </label>
    <label class="field">
      <span>Area <em>required</em></span>
      <select name="area_id" required>
        <option value="">— pick —</option>
        {#each data.areas as a (a.id)}
          <option value={a.id} selected={v.areaId === a.id}>{a.name}</option>
        {/each}
      </select>
      {#if errs.area_id}<span class="err">{errs.area_id}</span>{/if}
    </label>
  </div>

  <label class="field">
    <span>Detail / ticket URL</span>
    <input name="detail_url" type="url" value={v.detailUrl ?? ""} placeholder="https://..." />
    <span class="hint">Where calendar visitors click to learn more or buy tickets.</span>
    {#if errs.detail_url}<span class="err">{errs.detail_url}</span>{/if}
  </label>

  <!-- Performances -->
  <h2 class="block-title perf-h">Performances <em class="req-marker">required</em></h2>
  <p class="perf-help">
    Times in Pacific. List every public performance.
  </p>

  <SchedulePatternEditor
    {runStart}
    {runEnd}
    existingCount={perfs.length}
    onApply={applyGenerated}
  />

  {#if perfs.length === 0}
    <p class="empty-perfs">No performances added yet — use the pattern generator above or click the button below.</p>
  {/if}

  <ul class="perf-list">
    {#each perfs as p, i (i)}
      <li class="perf-row">
        <input type="datetime-local" bind:value={perfs[i].wallClock} class="dt-input" />
        <input type="text" bind:value={perfs[i].note} placeholder="Note (e.g., Pay What You Can)" class="note-input" />
        <button type="button" class="bt bt-ghost bt-sm" onclick={() => removePerf(i)}>×</button>
      </li>
    {/each}
  </ul>

  <button type="button" class="bt bt-ghost" onclick={addPerf}>+ Add performance</button>
  {#if errs.performances}<p class="err perf-err">{errs.performances}</p>{/if}

  <!-- Poster -->
  <h2 class="block-title">Poster (optional)</h2>
  <PosterUpload />

  <!-- Cast & production -->
  <h2 class="block-title">Cast &amp; production (optional)</h2>
  <CreditsSubmitForm />

  <!-- Submitter -->
  <h2 class="block-title">You</h2>

  <label class="field">
    <span>Your name <em>required</em></span>
    <input name="submitter_name" type="text" required value={v.submitterName ?? ""} />
    {#if errs.submitter_name}<span class="err">{errs.submitter_name}</span>{/if}
  </label>

  <label class="field">
    <span>Your email <em>required</em></span>
    <input name="submitter_email" type="email" required value={v.submitterEmail ?? ""} />
    <span class="hint">We send a verification link here. Never displayed publicly.</span>
    {#if errs.submitter_email}<span class="err">{errs.submitter_email}</span>{/if}
  </label>

  <div class="actions">
    <button type="submit" class="bt bt-pri" disabled={busy}>
      {busy ? "Submitting..." : "Submit performance"}
    </button>
    <a class="bt bt-ghost" href="/calendar">Cancel</a>
  </div>
</form>

<style>
  .masthead {
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) clamp(1rem, 3vw, 2rem);
    border-bottom: 1px solid var(--rule);
  }
  .masthead-body { max-width: 720px; }
  .eyebrow {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin-bottom: 0.5rem;
  }
  .eyebrow .num { color: var(--accent); margin-right: 0.4em; }
  .h1-display {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.02em;
    margin: 0 0 0.75rem;
  }
  .h1-display .serif-it {
    font-family: var(--font-accent);
    font-style: italic;
    font-weight: 400;
    color: var(--accent);
  }
  .lede { color: var(--ink-soft); margin: 0 0 0.5rem; max-width: 60ch; }
  .lede.small { font-size: 0.9rem; }

  .form {
    padding: 1.5rem var(--page-pad-x) 3rem;
    max-width: 720px;
  }
  .honeypot { position: absolute; left: -10000px; top: auto; width: 1px; height: 1px; overflow: hidden; }
  .block-title {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    margin: 1.25rem 0 0.75rem;
    color: var(--ink);
  }
  .block-title:first-child { margin-top: 0; }
  .perf-h { margin-top: 1.5rem; }
  .perf-help { font-size: 0.85rem; color: var(--muted); margin: 0 0 0.6rem; }

  .field { display: block; margin-bottom: 0.95rem; }
  .field > span:first-child {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 0.3rem;
  }
  .field em { font-style: normal; color: var(--accent); margin-left: 0.25rem; }
  .field input, .field select {
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 0.95rem;
    background: var(--bg);
    color: var(--ink);
  }
  .field .hint { display: block; margin-top: 0.25rem; font-size: 0.78rem; color: var(--muted); }
  .field .err { display: block; margin-top: 0.25rem; font-size: 0.85rem; color: var(--error); }
  .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

  .empty-perfs { color: var(--muted); font-style: italic; padding: 0.4rem 0; font-size: 0.9rem; }
  .req-marker {
    margin-left: 0.5rem;
    font-family: var(--font-body);
    font-size: 0.75rem;
    text-transform: none;
    color: var(--accent);
    font-style: normal;
    font-weight: 400;
  }
  .perf-err { color: var(--error); margin: 0.5rem 0; font-size: 0.9rem; }
  .perf-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.6rem; }
  .perf-row {
    display: grid;
    grid-template-columns: 11rem 1fr auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.4rem;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }
  .dt-input, .note-input {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 0.85rem;
    background: var(--bg);
    color: var(--ink);
  }

  .form-error {
    margin: 1rem var(--page-pad-x);
    max-width: 720px;
    padding: 0.75rem 1rem;
    background: #f9e0d4;
    color: var(--error);
    border: 1px solid var(--error);
    border-radius: var(--radius);
    font-size: 0.9rem;
  }

  .actions { display: flex; gap: 0.5rem; margin-top: 1.5rem; }
  .bt {
    padding: 0.55rem 1rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    text-decoration: none;
    font-size: 0.9rem;
    cursor: pointer;
    font-family: var(--font-body);
  }
  .bt:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .bt-pri { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); color: white; }
  .bt-sm { padding: 0.2rem 0.5rem; font-size: 0.85rem; }
  .bt:disabled { opacity: 0.6; cursor: not-allowed; }

  @media (max-width: 720px) {
    .row-2 { grid-template-columns: 1fr; }
    .perf-row { grid-template-columns: 1fr auto; }
    .perf-row .note-input { grid-column: 1 / -1; }
  }
</style>
