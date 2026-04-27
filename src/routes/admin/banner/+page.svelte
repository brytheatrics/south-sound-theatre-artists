<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let busy = $state<string | null>(null);

  function toLocal(iso: string | null): string {
    if (!iso) return "";
    // Format for datetime-local input: YYYY-MM-DDTHH:MM
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
</script>

<svelte:head><title>Banner - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · banner</span>
  <h1 class="h1-display">Announcement banner.</h1>
  <p class="lede">Site-wide notice. Stage future banners; only enabled-in-window ones show.</p>
</header>

{#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
{#if form?.created}<div class="form-ok" role="status">Created.</div>{/if}
{#if form?.saved}<div class="form-ok" role="status">Saved.</div>{/if}

<form method="POST" action="?/upsert" class="card" use:enhance={() => { busy = "new"; return async ({ update }) => { await update({ reset: true }); busy = null; }; }}>
  <h2>New banner</h2>
  <label class="field">
    <span>Body (markdown)</span>
    <textarea name="body" rows="3" required></textarea>
  </label>
  <div class="row">
    <label class="field"><span>Starts at (optional)</span><input type="datetime-local" name="starts_at" /></label>
    <label class="field"><span>Ends at (optional)</span><input type="datetime-local" name="ends_at" /></label>
    <label class="check"><input type="checkbox" name="enabled" /><span>Enabled</span></label>
  </div>
  <button type="submit" class="bt bt-pri" disabled={busy === "new"}>
    {busy === "new" ? "Saving..." : "Add banner"}
  </button>
</form>

{#each data.banners as b (b.id)}
  <form method="POST" action="?/upsert" class="card" use:enhance={() => { busy = b.id; return async ({ update }) => { await update({ reset: false }); busy = null; }; }}>
    <input type="hidden" name="id" value={b.id} />
    <label class="field">
      <span>Body</span>
      <textarea name="body" rows="3" required>{b.body_markdown}</textarea>
    </label>
    <div class="row">
      <label class="field"><span>Starts at</span><input type="datetime-local" name="starts_at" value={toLocal(b.starts_at)} /></label>
      <label class="field"><span>Ends at</span><input type="datetime-local" name="ends_at" value={toLocal(b.ends_at)} /></label>
      <label class="check"><input type="checkbox" name="enabled" checked={b.enabled} /><span>Enabled</span></label>
    </div>
    <div class="actions">
      <button type="submit" class="bt bt-pri" disabled={busy === b.id}>{busy === b.id ? "Saving..." : "Save"}</button>
      <button type="submit" formaction="?/remove" class="bt-link warn">Delete</button>
    </div>
  </form>
{/each}

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 800px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 16px; color: var(--muted); margin: 0 0 1rem; }
  .card { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; background: var(--bg-raised); border: 1px solid var(--rule); border-radius: var(--radius-lg); margin-bottom: 1rem; max-width: 720px; }
  .card h2 { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin: 0; font-weight: 500; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field span { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .field input, .field textarea { padding: 8px 12px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-body); font-size: 14px; background: var(--bg); }
  .field input:focus, .field textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  .row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; }
  .check { display: flex; align-items: center; gap: 6px; font-family: var(--font-body); font-size: 13px; color: var(--ink); padding-bottom: 8px; }
  .actions { display: flex; gap: 8px; align-items: center; }
  .bt { font-family: var(--font-body); font-size: 14px; padding: 9px 16px; border-radius: var(--radius); border: 1px solid transparent; cursor: pointer; }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt:disabled { opacity: 0.5; cursor: progress; }
  .form-error { background: color-mix(in oklch, var(--warn), var(--bg) 80%); border: 1px solid var(--warn); color: var(--warn); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--ink-soft); }
  .bt-link.warn { color: var(--warn); }
  .bt-link:hover { text-decoration: underline; }

  @media (max-width: 720px) {
    .row { grid-template-columns: 1fr; }
  }
</style>
