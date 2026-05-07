<script lang="ts">
  import { enhance } from "$app/forms";
  let { form } = $props();
  let busy = $state(false);
</script>

<svelte:head><title>New post - SSTA admin</title></svelte:head>

<header class="hd">
  <p class="crumb"><a href="/admin/blog">← All posts</a></p>
  <h1 class="h1-display">New blog post</h1>
  <p class="lede">Pick a title and slug to get started. Body and cover image come on the next page.</p>
</header>

<form
  method="POST"
  use:enhance={() => { busy = true; return async ({ update }) => { await update(); busy = false; }; }}
  class="form"
>
  <label class="f">
    <span>Title</span>
    <input type="text" name="title" required placeholder="A welcome from SSTA" />
  </label>
  <label class="f">
    <span>Slug (optional - auto-generated from title if blank)</span>
    <input type="text" name="slug" placeholder="welcome-from-ssta" />
  </label>
  {#if form?.error}<p class="err">{form.error}</p>{/if}
  <button type="submit" class="bt bt-pri" disabled={busy}>
    {busy ? "Creating..." : "Create draft"}
  </button>
</form>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 600px; margin-bottom: 2rem; }
  .crumb { margin: 0; font-family: var(--font-mono); font-size: 12px; }
  .crumb a { color: var(--muted); text-decoration: none; }
  .crumb a:hover { color: var(--ink); }
  .h1-display { margin: 0; font-family: var(--font-display); font-size: 28px; }
  .lede { margin: 0; font-family: var(--font-body); font-size: 14px; color: var(--ink-soft); }
  .form { display: flex; flex-direction: column; gap: 1rem; max-width: 600px; }
  .f { display: flex; flex-direction: column; gap: 4px; }
  .f span { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .f input { padding: 10px 12px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-body); font-size: 14px; background: var(--bg); color: var(--ink); }
  .bt { align-self: flex-start; padding: 9px 18px; border-radius: var(--radius); border: 1px solid transparent; font-family: var(--font-body); font-size: 14px; cursor: pointer; }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:disabled { opacity: 0.5; cursor: progress; }
  .err { color: var(--warn); font-size: 13px; margin: 0; }
</style>
