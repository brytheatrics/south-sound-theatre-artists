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
  let bodyValue = $state(active?.body_markdown ?? "");
  /* svelte-ignore state_referenced_locally */
  let titleValue = $state(active?.title ?? "");
  $effect(() => {
    bodyValue = active?.body_markdown ?? "";
    titleValue = active?.title ?? "";
  });
</script>

<svelte:head><title>Site content - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · content</span>
  <h1 class="h1-display">Site content.</h1>
  <p class="lede">Markdown bodies for the public pages.</p>
</header>

<div class="tabs">
  {#each data.rows as r (r.slug)}
    <button type="button" class:on={r.slug === activeSlug} onclick={() => (activeSlug = r.slug)}>
      {r.slug}
    </button>
  {/each}
</div>

{#if active}
  <form
    method="POST"
    action="?/save"
    use:enhance={() => { busy = true; return async ({ update }) => { await update({ reset: false }); busy = false; }; }}
    class="editor"
  >
    <input type="hidden" name="slug" value={active.slug} />
    <label class="field">
      <span>Title (optional)</span>
      <input type="text" name="title" bind:value={titleValue} />
    </label>
    <div class="split">
      <div class="field">
        <span>Body (markdown)</span>
        <MarkdownToolbar textareaId={`body-${active.slug}`} />
        <textarea
          id={`body-${active.slug}`}
          name="body"
          bind:value={bodyValue}
          rows="20"
        ></textarea>
      </div>
      <div class="preview">
        <span class="preview-label">Preview</span>
        <div class="prose prose-compact">{@html renderMarkdown(bodyValue)}</div>
      </div>
    </div>
    <button type="submit" class="bt bt-pri" disabled={busy}>
      {busy ? "Saving..." : "Save"}
    </button>
    {#if form?.saved === active.slug}<span class="ok">Saved.</span>{/if}
    {#if form?.error}<span class="err">{form.error}</span>{/if}
  </form>
{/if}

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 800px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 18px; color: var(--muted); margin: 0 0 1rem; }
  .tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 1rem; }
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
  .editor { display: flex; flex-direction: column; gap: 1rem; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field > span:first-child { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .field input, .field textarea {
    padding: 10px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg-raised);
  }
  .field textarea { font-family: var(--font-mono); font-size: 13px; line-height: 1.55; resize: vertical; border-radius: 0 0 var(--radius) var(--radius); border-top-color: var(--rule); }
  .field input:focus, .field textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
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
  .err { color: var(--error); font-size: 13px; }

  @media (max-width: 900px) {
    .split { grid-template-columns: 1fr; }
  }
</style>
