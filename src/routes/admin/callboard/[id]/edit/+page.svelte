<script lang="ts">
  import { page } from "$app/state";
  import AdminCallboardForm from "$lib/components/AdminCallboardForm.svelte";

  let { data, form } = $props();

  const justSaved = $derived(page.url.searchParams.get("saved") === "1");
  const justCreated = $derived(page.url.searchParams.get("created") === "1");

  // Roles arrives as a Postgres text[] from supabase-js, but pass it
  // through unchanged - the form component renders it as joined lines
  // in the textarea.
</script>

<svelte:head>
  <title>Edit callboard post - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · callboard · edit</span>
  <h1 class="h1-display">Edit <span class="serif-it">post</span>.</h1>
  <p class="lede">
    Originally submitted by <strong>{data.post.submitter_email}</strong>.
    Saving keeps the row in place; toggle "Published" off to hide it from
    the public callboard without deleting.
  </p>
  <p class="meta">
    <a href="/admin/callboard">← Back to callboard queue</a>
    &nbsp;·&nbsp;
    <a href={`/callboard/${data.post.id}`} target="_blank" rel="noopener">View public page ↗</a>
  </p>
</header>

{#if justCreated}
  <div class="form-ok" role="status">Post created.</div>
{/if}
{#if justSaved}
  <div class="form-ok" role="status">Saved.</div>
{/if}

<AdminCallboardForm
  mode="edit"
  actionUrl="?/save"
  initial={data.post}
  areas={data.areas}
  postTypes={data.postTypes}
  formErrors={form?.errors}
/>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 720px; margin-bottom: 1.5rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 16px;
    color: var(--muted);
    margin: 0;
  }
  .lede strong { color: var(--ink); font-style: normal; font-family: var(--font-mono); font-size: 13px; }
  .meta {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 0.5rem 0 0;
  }
  .meta a { color: var(--accent); }
  .form-ok {
    background: color-mix(in oklch, var(--accent), var(--bg) 88%);
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 0.65rem 0.9rem;
    border-radius: var(--radius);
    margin-bottom: 1rem;
    font-size: 14px;
  }
</style>
