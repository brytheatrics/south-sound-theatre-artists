<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  let { data, form } = $props();
  let busy = $state<string | null>(null);

  let pendingForm = $state<HTMLFormElement | null>(null);
  let pendingName = $state("");

  function askRemove(e: MouseEvent, label: string) {
    pendingForm = (e.currentTarget as HTMLElement).closest("form");
    pendingName = label;
  }
  function cancelRemove() {
    pendingForm = null;
    pendingName = "";
  }
  function confirmRemove() {
    pendingForm?.requestSubmit();
    cancelRemove();
  }
</script>

<svelte:head><title>Callboard types - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · callboard types</span>
  <h1 class="h1-display">Callboard post types.</h1>
  <p class="lede">
    The categories visitors filter the callboard by, and the radio
    options on the public submit form. Add new ones (Workshop, Meetup,
    Director call, etc.) any time.
  </p>
</header>

{#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
{#if form?.added}<div class="form-ok" role="status">Added "{form.added}".</div>{/if}
{#if form?.updated}<div class="form-ok" role="status">Saved.</div>{/if}
{#if form?.removed}<div class="form-ok" role="status">
  Removed "{form.removed}".{#if form.purgedTrash}
    {" "}Also purged {form.purgedTrash} trashed post{form.purgedTrash === 1 ? "" : "s"} that referenced this type.
  {/if}
</div>{/if}

<ConfirmModal
  open={pendingForm !== null}
  title="Remove this type?"
  body={`"${pendingName}" will no longer be a category option. Live posts using this type will block the delete (re-tag them first). Trashed posts using this type will be permanently purged as part of the delete - they couldn't be restored to a type that no longer exists.`}
  confirmLabel="Remove"
  variant="warn"
  onConfirm={confirmRemove}
  onClose={cancelRemove}
/>

<section class="block">
  <h2 class="block-title">Add a type</h2>
  <form method="POST" action="?/add" class="card"
    use:enhance={() => { busy = "add"; return async ({ update }) => { await update({ reset: true }); busy = null; }; }}>
    <div class="row">
      <label class="field">
        <span>Slug</span>
        <input name="slug" type="text" required placeholder="workshop" />
      </label>
      <label class="field">
        <span>Sort order</span>
        <input name="sort_order" type="number" value="100" />
      </label>
    </div>
    <div class="row">
      <label class="field">
        <span>Label</span>
        <input name="label" type="text" required placeholder="Workshop" />
      </label>
      <label class="field">
        <span>Plural label</span>
        <input name="plural_label" type="text" placeholder="Workshops" />
      </label>
    </div>
    <label class="field">
      <span>Description (shown on the public submit form under the radio button)</span>
      <input name="description" type="text" placeholder="Hands-on training session, all experience levels welcome." />
    </label>
    <div class="row">
      <label class="field">
        <span>Glyph (homepage marquee)</span>
        <input name="glyph" type="text" maxlength="2" value="✦" />
      </label>
      <label class="field">
        <span>Marquee prefix (optional)</span>
        <input name="marquee_prefix" type="text" placeholder="Workshop" />
      </label>
    </div>
    <label class="check"><input type="checkbox" name="active" checked /><span>Active</span></label>
    <button type="submit" class="bt bt-pri" disabled={busy === "add"}>
      {busy === "add" ? "Adding..." : "Add type"}
    </button>
  </form>
</section>

<section class="block">
  <h2 class="block-title">Existing</h2>
  {#each data.types as t (t.slug)}
    {@const count = data.counts[t.slug] ?? 0}
    <form method="POST" action="?/update" class="card row-card"
      use:enhance={() => { busy = t.slug; return async ({ update }) => { await update({ reset: false }); busy = null; }; }}>
      <input type="hidden" name="slug" value={t.slug} />
      <div class="row">
        <label class="field">
          <span>Slug (read-only)</span>
          <input type="text" value={t.slug} disabled />
        </label>
        <label class="field">
          <span>Sort</span>
          <input name="sort_order" type="number" value={t.sort_order} />
        </label>
      </div>
      <div class="row">
        <label class="field"><span>Label</span><input name="label" type="text" value={t.label} required /></label>
        <label class="field"><span>Plural label</span><input name="plural_label" type="text" value={t.plural_label ?? ""} /></label>
      </div>
      <label class="field">
        <span>Description (shown on the public submit form)</span>
        <input name="description" type="text" value={t.description ?? ""} />
      </label>
      <div class="row">
        <label class="field"><span>Glyph</span><input name="glyph" type="text" maxlength="2" value={t.glyph} /></label>
        <label class="field"><span>Marquee prefix</span><input name="marquee_prefix" type="text" value={t.marquee_prefix ?? ""} /></label>
      </div>
      <div class="actions">
        <label class="check"><input type="checkbox" name="active" checked={t.active} /><span>Active</span></label>
        <span class="count" title={`${count} post${count === 1 ? "" : "s"} use this type`}>
          {count} post{count === 1 ? "" : "s"}
        </span>
        <button type="submit" class="bt bt-pri" disabled={busy === t.slug}>{busy === t.slug ? "Saving..." : "Save"}</button>
        <button
          type="button"
          formaction="?/remove"
          class="bt-link warn"
          disabled={count > 0}
          title={count > 0 ? "Re-tag posts first, or use the Active toggle." : "Remove this type"}
          onclick={(e) => askRemove(e, t.label)}
        >
          Remove
        </button>
      </div>
    </form>
  {/each}
</section>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 800px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 16px; color: var(--muted); margin: 0 0 1rem; }
  .block { margin: 0 0 2.5rem; max-width: 820px; }
  .block-title {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--muted);
    font-weight: 500;
    margin: 0 0 0.875rem;
  }
  .card { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; background: var(--bg-raised); border: 1px solid var(--rule); border-radius: var(--radius-lg); margin-bottom: 0.75rem; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field span { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .field input { padding: 8px 12px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-body); font-size: 14px; background: var(--bg); }
  .field input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  .field input:disabled { opacity: 0.6; background: var(--paper); cursor: not-allowed; }
  .row { display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem; }
  .check { display: flex; align-items: center; gap: 6px; font-family: var(--font-body); font-size: 13px; color: var(--ink); }
  .check input[type="checkbox"] { accent-color: var(--accent); }
  .count {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .bt { font-family: var(--font-body); font-size: 14px; padding: 9px 16px; border-radius: var(--radius); border: 1px solid transparent; cursor: pointer; }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt:disabled { opacity: 0.5; cursor: progress; }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--ink-soft); }
  .bt-link.warn { color: var(--warn); }
  .bt-link:hover:not(:disabled) { text-decoration: underline; }
  .bt-link:disabled { opacity: 0.4; cursor: not-allowed; }
  .form-error { background: color-mix(in oklch, var(--warn), var(--bg) 80%); border: 1px solid var(--warn); color: var(--warn); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }

  @media (max-width: 720px) {
    .row { grid-template-columns: 1fr; }
  }
</style>
