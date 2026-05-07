<script lang="ts">
  import { enhance } from "$app/forms";
  import MarkdownToolbar from "$lib/components/MarkdownToolbar.svelte";
  import { renderMarkdown } from "$lib/util/markdown";

  let { data, form } = $props();
  // svelte-ignore state_referenced_locally
  const p = data.post;

  let title = $state(p.title);
  let slug = $state(p.slug);
  let body = $state(p.body_markdown ?? "");
  let coverUrl = $state(p.cover_url ?? "");
  let author = $state(p.author_display_name ?? "Lexi Barnett");
  let publish = $state(p.published);
  let busy = $state(false);

  let coverInput = $state<HTMLInputElement | undefined>();
  let uploading = $state(false);

  async function uploadCover(file: File) {
    uploading = true;
    try {
      const sigRes = await fetch("/api/cloudinary/sign-content", { method: "POST" });
      if (!sigRes.ok) throw new Error("Could not get signed upload params.");
      const sig = await sigRes.json();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.apiKey);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);
      if (sig.transformation) fd.append("transformation", sig.transformation);
      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: "POST",
        body: fd,
      });
      if (!upRes.ok) throw new Error("Cloudinary upload failed.");
      const up = await upRes.json();
      coverUrl = up.secure_url;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      uploading = false;
      if (coverInput) coverInput.value = "";
    }
  }
</script>

<svelte:head><title>{title} - Edit - SSTA admin</title></svelte:head>

<header class="hd">
  <p class="crumb"><a href="/admin/blog">← All posts</a></p>
  <h1 class="h1-display">{title || "(untitled)"}</h1>
  {#if p.published}
    <p class="status">
      ● Published · <a href={`/blog/${p.slug}`} target="_blank" rel="noopener">View public page ↗</a>
    </p>
  {:else}
    <p class="status draft">○ Draft - not visible to the public</p>
  {/if}
</header>

<form
  method="POST"
  action="?/save"
  use:enhance={() => { busy = true; return async ({ update }) => { await update({ reset: false }); busy = false; }; }}
  class="editor"
>
  <div class="row two-col">
    <label class="f">
      <span>Title</span>
      <input type="text" name="title" bind:value={title} required />
    </label>
    <label class="f">
      <span>Slug</span>
      <input type="text" name="slug" bind:value={slug} required />
    </label>
  </div>

  <div class="row two-col">
    <label class="f">
      <span>Cover image (optional)</span>
      <input type="text" name="cover_url" bind:value={coverUrl} placeholder="https://res.cloudinary.com/..." />
      <input
        type="file"
        accept="image/*"
        bind:this={coverInput}
        onchange={(e) => {
          const f = (e.currentTarget as HTMLInputElement).files?.[0];
          if (f) uploadCover(f);
        }}
        style="margin-top: 6px;"
      />
      {#if uploading}<span class="hint">Uploading...</span>{/if}
      {#if coverUrl}
        <img src={coverUrl} alt="Cover preview" class="cover-preview" />
      {/if}
    </label>
    <label class="f">
      <span>Author byline</span>
      <input type="text" name="author" bind:value={author} />
    </label>
  </div>

  <div class="split">
    <div class="f">
      <span>Body (markdown)</span>
      <MarkdownToolbar textareaId="blog-body" />
      <textarea id="blog-body" name="body" bind:value={body} rows="24"></textarea>
    </div>
    <div class="preview">
      <span class="preview-label">Preview</span>
      <div class="prose">{@html renderMarkdown(body)}</div>
    </div>
  </div>

  <label class="checkbox">
    <input type="checkbox" name="publish" bind:checked={publish} />
    <span>Published (visible at /blog/{slug})</span>
  </label>

  <div class="actions">
    <button type="submit" class="bt bt-pri" disabled={busy}>
      {busy ? "Saving..." : "Save"}
    </button>
    {#if form?.saved}<span class="ok">Saved.</span>{/if}
    {#if form?.error}<span class="err">{form.error}</span>{/if}
  </div>
</form>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 920px; margin-bottom: 1.5rem; }
  .crumb { margin: 0; font-family: var(--font-mono); font-size: 12px; }
  .crumb a { color: var(--muted); text-decoration: none; }
  .crumb a:hover { color: var(--ink); }
  .h1-display { margin: 0; font-family: var(--font-display); font-size: 28px; }
  .status { margin: 0; font-family: var(--font-body); font-size: 13px; color: var(--accent); }
  .status.draft { color: var(--muted); }
  .editor { display: flex; flex-direction: column; gap: 1rem; max-width: 1200px; }
  .row { display: flex; flex-direction: column; gap: 1rem; }
  .row.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 720px) { .row.two-col { grid-template-columns: 1fr; } }
  .f { display: flex; flex-direction: column; gap: 4px; }
  .f span { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .f input { padding: 9px 12px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-body); font-size: 14px; background: var(--bg); color: var(--ink); }
  .f textarea { padding: 10px 12px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-mono); font-size: 13px; background: var(--bg); color: var(--ink); resize: vertical; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 1024px) { .split { grid-template-columns: 1fr; } }
  .preview { display: flex; flex-direction: column; gap: 6px; }
  .preview-label { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .prose { padding: 14px; border: 1px solid var(--rule); border-radius: var(--radius); background: var(--bg-raised); min-height: 300px; }
  .checkbox { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-body); font-size: 14px; }
  .actions { display: flex; gap: 12px; align-items: center; }
  .bt { padding: 9px 18px; border-radius: var(--radius); border: 1px solid transparent; font-family: var(--font-body); font-size: 14px; cursor: pointer; }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:disabled { opacity: 0.5; cursor: progress; }
  .ok { color: var(--accent); font-size: 13px; font-family: var(--font-body); }
  .err { color: var(--warn); font-size: 13px; font-family: var(--font-body); }
  .hint { font-family: var(--font-body); font-size: 12px; color: var(--muted); }
  .cover-preview { max-width: 200px; max-height: 120px; margin-top: 8px; border-radius: var(--radius); }
</style>
