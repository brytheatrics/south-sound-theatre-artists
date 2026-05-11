<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PageData } from "./$types";

  let { data, form }: { data: PageData; form: any } = $props();

  let busy = $state<string | null>(null);
</script>

<svelte:head>
  <title>Contact categories - Admin</title>
</svelte:head>

<main>
  <header>
    <h1>Contact form categories</h1>
    <p class="lede">
      Each category on the public <a href="/contact">/contact</a> form
      routes to a primary email + optional CC addresses. Edit the
      recipients here without touching code. Slugs are fixed (other
      tables reference them).
    </p>
    {#if form?.savedSlug}
      <p class="form-ok">Saved <code>{form.savedSlug}</code>.</p>
    {/if}
    {#if form?.error}
      <p class="form-err">{form.error}</p>
    {/if}
  </header>

  <div class="cats">
    {#each data.categories as c (c.slug)}
      <form
        method="POST"
        action="?/save"
        class="cat"
        use:enhance={() => { busy = c.slug; return async ({ update }) => { await update({ reset: false }); busy = null; }; }}
      >
        <input type="hidden" name="slug" value={c.slug} />
        <div class="cat-head">
          <code class="slug">{c.slug}</code>
          <label class="lbl">
            <span>Label</span>
            <input type="text" name="label" value={c.label} required />
          </label>
        </div>
        <label class="lbl">
          <span>Description (hint shown under the dropdown)</span>
          <input type="text" name="description" value={c.description ?? ""} />
        </label>
        <label class="lbl">
          <span>Primary email</span>
          <input type="email" name="primary_email" value={c.primary_email} required />
        </label>
        <label class="lbl">
          <span>CC emails (comma or newline separated)</span>
          <textarea name="cc_emails" rows="2">{(c.cc_emails ?? []).join(", ")}</textarea>
        </label>
        <button class="bt bt-pri" type="submit" disabled={busy === c.slug}>
          {busy === c.slug ? "Saving..." : "Save"}
        </button>
      </form>
    {/each}
  </div>
</main>

<style>
  main { max-width: 800px; margin: 0 auto; padding: 2rem var(--page-pad-x); }
  h1 { font-family: var(--font-display); font-size: 2rem; margin: 0 0 0.5rem; }
  .lede { color: var(--ink-soft); font-size: 14px; max-width: 60ch; margin: 0 0 1rem; }
  .lede a { color: var(--accent); }

  .cats { display: flex; flex-direction: column; gap: 1.5rem; }
  .cat {
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .cat-head { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
  .slug {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: var(--paper);
    padding: 2px 8px;
    border-radius: 999px;
    color: var(--muted);
  }
  .lbl { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; }
  .lbl span { font-size: 12.5px; color: var(--ink-soft); }
  input, textarea {
    font: inherit;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--ink);
  }

  .form-ok { color: var(--accent); font-size: 13px; }
  .form-err { color: var(--warn); font-size: 13px; }
  .bt {
    font: inherit;
    padding: 0.45rem 1rem;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    align-self: flex-start;
  }
  .bt-pri {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); }
  .bt[disabled] { opacity: 0.6; cursor: progress; }
</style>
