<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";

  let { data, form } = $props();
  let busyId = $state<string | null>(null);

  let pendingDeleteForm = $state<HTMLFormElement | null>(null);
  let pendingDeleteName = $state<string>("");

  function askDelete(e: MouseEvent, fullName: string) {
    pendingDeleteForm = (e.currentTarget as HTMLElement).closest("form");
    pendingDeleteName = fullName;
  }
  function cancelDelete() {
    pendingDeleteForm = null;
    pendingDeleteName = "";
  }
  function confirmDelete() {
    pendingDeleteForm?.requestSubmit();
    cancelDelete();
  }

  function daysAgo(iso: string): string {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d === 0) return "today";
    if (d === 1) return "yesterday";
    return `${d}d ago`;
  }
</script>

<svelte:head>
  <title>Trash - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · trash</span>
  <h1 class="h1-display">Recently removed.</h1>
  <p class="lede">
    {data.trashed.length}
    {data.trashed.length === 1 ? "profile" : "profiles"} in trash.
    Admin-deleted profiles auto-purge after 30 days; profiles with the
    <span class="stale-pill inline">Stale</span> badge are auto-archived
    non-responders to the 18-month ping and stay here indefinitely so
    you can restore them if the artist comes back.
  </p>
  <p>
    <a class="bt bt-ghost" href="/admin/profiles">← Back to profiles</a>
  </p>
  {#if form?.restored}<div class="form-ok" role="status">Restored {form.restored}.</div>{/if}
  {#if form?.hardDeleted}<div class="form-ok" role="status">Permanently deleted {form.hardDeleted}.</div>{/if}
  {#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
</header>

{#if data.trashed.length === 0}
  <p class="empty">Nothing in trash.</p>
{:else}
  <ul class="rows">
    {#each data.trashed as t (t.id)}
      <li class="row">
        <div>
          <span class="name">{t.full_name}</span>
          {#if t.archived_stale}
            <span class="stale-pill" title="Auto-archived after 18-month ping with no response. Will not auto-purge.">Stale</span>
          {/if}
          <span class="meta">
            {t.email} · removed {daysAgo(t.deleted_at)}
            {#if t.archived_stale}· kept indefinitely{:else}· auto-purges in 30d{/if}
          </span>
        </div>
        <div class="actions">
          <form method="POST" action="?/restore" use:enhance={() => { busyId = t.id; return async ({ update }) => { await update(); busyId = null; }; }}>
            <input type="hidden" name="id" value={t.id} />
            <button type="submit" class="bt-link" disabled={busyId === t.id}>Restore</button>
          </form>
          <form
            method="POST"
            action="?/hardDelete"
            use:enhance={() => { busyId = t.id; return async ({ update }) => { await update(); busyId = null; }; }}
          >
            <input type="hidden" name="id" value={t.id} />
            <button
              type="button"
              class="bt-link warn"
              disabled={busyId === t.id}
              onclick={(e) => askDelete(e, t.full_name)}
            >
              Delete forever
            </button>
          </form>
        </div>
      </li>
    {/each}
  </ul>
{/if}

<ConfirmModal
  open={pendingDeleteForm !== null}
  title="Delete forever?"
  body={`${pendingDeleteName} will be permanently removed. This can't be undone.`}
  confirmLabel="Delete forever"
  variant="warn"
  onConfirm={confirmDelete}
  onClose={cancelDelete}
/>

<style>
  .hd {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 800px;
    margin-bottom: 2rem;
  }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 18px; color: var(--muted); margin: 0; }
  .bt {
    font-family: var(--font-body);
    font-size: 13px;
    padding: 8px 14px;
    border-radius: var(--radius);
    text-decoration: none;
    display: inline-flex;
    border: 1px solid var(--rule);
    color: var(--ink);
  }
  .bt:hover { border-color: var(--ink); text-decoration: none; }
  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; }
  .form-error { background: color-mix(in oklch, var(--warn), var(--bg) 80%); border: 1px solid var(--warn); color: var(--warn); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; }
  .empty { color: var(--muted); font-family: var(--font-accent); font-style: italic; padding: 3rem 0; text-align: center; }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-raised);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 12px 16px;
    border-bottom: 1px solid var(--rule-soft);
  }
  .row:last-child { border-bottom: 0; }
  .name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 15px;
    color: var(--ink);
    margin-right: 10px;
  }
  .meta {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
  }
  .actions { display: flex; gap: 8px; }
  .bt-link {
    background: none;
    border: 0;
    padding: 6px 10px;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
  }
  .bt-link.warn { color: var(--warn); }
  .bt-link:hover { text-decoration: underline; }
  .stale-pill {
    display: inline-block;
    padding: 1px 0.55em;
    margin-left: 0.4em;
    border-radius: 999px;
    background: #f4ecd8;
    color: #8a6e1c;
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    vertical-align: 0.1em;
    font-weight: 600;
    border: 1px solid #d4be7c;
  }
  .stale-pill.inline { margin-left: 0.1em; }
</style>
