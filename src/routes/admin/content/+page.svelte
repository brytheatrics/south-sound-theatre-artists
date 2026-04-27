<script lang="ts">
  import { enhance } from "$app/forms";
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

  function renderMarkdown(md: string): string {
    // Tiny markdown subset: paragraphs, **bold**, *italic*, # heading,
    // - lists, [link](url). Good enough for a live preview pane.
    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lines = escape(md).split(/\r?\n/);
    let html = "";
    let inList = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        html += "";
        continue;
      }
      if (line.startsWith("# ")) {
        if (inList) { html += "</ul>"; inList = false; }
        html += `<h1>${line.slice(2)}</h1>`;
        continue;
      }
      if (line.startsWith("## ")) {
        if (inList) { html += "</ul>"; inList = false; }
        html += `<h2>${line.slice(3)}</h2>`;
        continue;
      }
      if (line.startsWith("- ")) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${inline(line.slice(2))}</li>`;
        continue;
      }
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${inline(line)}</p>`;
    }
    if (inList) html += "</ul>";
    return html;
  }
  function inline(s: string): string {
    return s
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }
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
      <label class="field">
        <span>Body (markdown)</span>
        <textarea name="body" bind:value={bodyValue} rows="20"></textarea>
      </label>
      <div class="preview">
        <span class="preview-label">Preview</span>
        <div class="preview-body">{@html renderMarkdown(bodyValue)}</div>
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
  .field textarea { font-family: var(--font-mono); font-size: 13px; line-height: 1.55; resize: vertical; }
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
  .preview-label { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .preview-body :global(h1) { font-family: var(--font-display); font-weight: 600; font-size: 28px; margin: 8px 0; }
  .preview-body :global(h2) { font-family: var(--font-display); font-weight: 600; font-size: 20px; margin: 16px 0 6px; }
  .preview-body :global(p) { margin: 8px 0; line-height: 1.55; color: var(--ink-soft); }
  .preview-body :global(ul) { margin: 8px 0; padding-left: 20px; color: var(--ink-soft); }
  .preview-body :global(a) { color: var(--accent); }
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
