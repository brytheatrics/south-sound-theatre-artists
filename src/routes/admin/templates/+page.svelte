<script lang="ts">
  import { enhance } from "$app/forms";
  import MarkdownToolbar from "$lib/components/MarkdownToolbar.svelte";
  import { renderMarkdown } from "$lib/util/markdown";
  let { data, form } = $props();
  /* svelte-ignore state_referenced_locally */
  let activeSlug = $state(data.rows[0]?.slug ?? "");
  let busy = $state(false);
  const active = $derived(data.rows.find((r) => r.slug === activeSlug));
  /* svelte-ignore state_referenced_locally */
  let subject = $state(active?.subject ?? "");
  /* svelte-ignore state_referenced_locally */
  let body = $state(active?.body_markdown ?? "");
  $effect(() => {
    subject = active?.subject ?? "";
    body = active?.body_markdown ?? "";
  });

  // Split tabs into two groups by audience. Community-bound first
  // (these are the ones whose copy / look matters because real
  // people see them); admin-bound second (Lexi reading her own inbox,
  // less polish needed).
  const communityRows = $derived(
    data.rows.filter((r) => r.audience !== "admin"),
  );
  const adminRows = $derived(
    data.rows.filter((r) => r.audience === "admin"),
  );
</script>

<svelte:head><title>Email templates - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · templates</span>
  <h1 class="h1-display">Email templates.</h1>
  <p class="lede">
    Subject lines and bodies for outbound mail. Variables in {"{{double_braces}}"}
    get filled in at send time.
    <strong>Community-facing</strong> emails (top group) go to artists,
    orgs, and audience members - the copy here is what real people see.
    <strong>Admin-only</strong> emails (bottom group) go to your inbox -
    polish doesn't matter as much.
  </p>
</header>

<div class="tab-group">
  <span class="tab-group-label">
    Community-facing
    <span class="tab-group-count">{communityRows.length}</span>
  </span>
  <div class="tabs">
    {#each communityRows as r (r.slug)}
      <button type="button" class:on={r.slug === activeSlug} onclick={() => (activeSlug = r.slug)}>{r.slug}</button>
    {/each}
  </div>
</div>

<div class="tab-group">
  <span class="tab-group-label tab-group-label-admin">
    Admin-only
    <span class="tab-group-count">{adminRows.length}</span>
  </span>
  <div class="tabs">
    {#each adminRows as r (r.slug)}
      <button type="button" class="tab-admin" class:on={r.slug === activeSlug} onclick={() => (activeSlug = r.slug)}>{r.slug}</button>
    {/each}
  </div>
</div>

{#if active}
  <form method="POST" action="?/save" class="editor" use:enhance={() => { busy = true; return async ({ update }) => { await update({ reset: false }); busy = false; }; }}>
    <input type="hidden" name="slug" value={active.slug} />
    {#if active.description}
      <div class="desc-box">
        <span class="desc-eyebrow">
          {active.audience === "admin" ? "Goes to admin (you)" : "Goes to community members"}
        </span>
        <p class="desc-body">{active.description}</p>
      </div>
    {/if}
    <label class="field">
      <span>Subject</span>
      <input type="text" name="subject" bind:value={subject} required />
    </label>
    <div class="split">
      <div class="field">
        <span>Body (markdown)</span>
        <MarkdownToolbar textareaId={`body-${active.slug}`} />
        <textarea
          id={`body-${active.slug}`}
          name="body"
          bind:value={body}
          rows="20"
        ></textarea>
        <span class="hint">
          Variables in {"{{double_braces}}"} are filled in at send time
          (they show literally in the preview here). The
          <code>{"{{signature}}"}</code> variable is auto-filled from
          the <a href="/admin/content?slug=email_signature">Email signature</a>
          page; insert it where you want the sign-off to appear.
        </span>
      </div>
      <div class="preview">
        <span class="preview-label">Preview</span>
        <div class="prose prose-compact">{@html renderMarkdown(body)}</div>
      </div>
    </div>
    <button type="submit" class="bt bt-pri" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
    {#if form?.saved === active.slug}<span class="ok">Saved.</span>{/if}
    {#if form?.error}<span class="err">{form.error}</span>{/if}
  </form>
{/if}

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 900px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 16px; color: var(--muted); margin: 0 0 1rem; }
  .tab-group { margin-bottom: 1rem; }
  .tab-group-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink);
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  .tab-group-label-admin { color: var(--muted); font-weight: 400; }
  .tab-group-count {
    background: var(--paper-2);
    color: var(--muted);
    padding: 1px 7px;
    border-radius: 100px;
    font-size: 10px;
  }
  .tabs { display: flex; flex-wrap: wrap; gap: 4px; }
  .tabs button {
    background: transparent;
    border: 1px solid var(--rule);
    padding: 6px 12px;
    border-radius: 100px;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    cursor: pointer;
  }
  .tabs button:hover { border-color: var(--ink); color: var(--ink); }
  .tabs button.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  /* Admin-only tabs read as secondary - dashed border, lighter background. */
  .tabs button.tab-admin { border-style: dashed; }
  .tabs button.tab-admin.on {
    background: var(--paper-2);
    color: var(--ink);
    border-color: var(--ink);
    border-style: solid;
  }
  /* Description box: prominent above the form so Lexi knows what
     she's editing before she touches the body. */
  .desc-box {
    padding: 12px 14px;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .desc-eyebrow {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 600;
  }
  .desc-body {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--ink-soft);
  }
  .editor { display: flex; flex-direction: column; gap: 1rem; max-width: 1200px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field > span:first-child { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .field input, .field textarea { padding: 10px 14px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-body); font-size: 14px; background: var(--bg-raised); }
  /* Square the textarea's top corners and tighten its top border so it
     reads as one element with the toolbar sitting above it. */
  .field textarea { font-family: var(--font-mono); font-size: 13px; line-height: 1.55; resize: vertical; border-radius: 0 0 var(--radius) var(--radius); border-top-color: var(--rule); }
  .field input:focus, .field textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  .hint { font-family: var(--font-mono); font-size: 11px; color: var(--muted); margin-top: 4px; line-height: 1.45; text-transform: none; letter-spacing: normal; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .preview {
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 14px 18px;
    background: var(--bg-raised);
    overflow-y: auto;
    max-height: 600px;
  }
  .preview-label { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); display: block; margin-bottom: 0.5rem; }
  .bt { font-family: var(--font-body); font-size: 14px; padding: 10px 18px; border-radius: var(--radius); border: 1px solid transparent; cursor: pointer; align-self: flex-start; }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt:disabled { opacity: 0.5; cursor: progress; }
  .ok { color: var(--accent); font-size: 13px; }
  .err { color: var(--warn); font-size: 13px; }

  @media (max-width: 900px) {
    .split { grid-template-columns: 1fr; }
  }
</style>
