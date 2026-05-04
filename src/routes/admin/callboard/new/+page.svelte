<script lang="ts">
  import AdminCallboardForm from "$lib/components/AdminCallboardForm.svelte";
  let { data, form } = $props();
</script>

<svelte:head>
  <title>New callboard post - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · callboard · new</span>
  <h1 class="h1-display">New <span class="serif-it">post</span>.</h1>
  <p class="lede">
    Admin-authored posts skip the email-verify step and publish
    immediately by default. Untick "Publish immediately" to stage one
    for later review.
  </p>
  <p class="meta">
    <a href="/admin/callboard">← Back to callboard queue</a>
  </p>
</header>

<AdminCallboardForm
  mode="new"
  actionUrl="?/create"
  initial={{ published: true }}
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
    max-width: 60ch;
  }
  .meta {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 0.5rem 0 0;
  }
  .meta a { color: var(--accent); }
</style>
