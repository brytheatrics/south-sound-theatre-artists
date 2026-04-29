<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import type { PageData, ActionData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let pendingHardDeleteForm = $state<HTMLFormElement | null>(null);
  let pendingHardDeleteTitle = $state("");
  let busyId = $state<string | null>(null);

  function askHardDelete(e: MouseEvent, title: string) {
    pendingHardDeleteForm = (e.currentTarget as HTMLElement).closest("form");
    pendingHardDeleteTitle = title;
  }
  function cancelHardDelete() { pendingHardDeleteForm = null; pendingHardDeleteTitle = ""; }
  function confirmHardDelete() { pendingHardDeleteForm?.requestSubmit(); cancelHardDelete(); }

  const POST_TYPE_LABELS = $derived(
    Object.fromEntries(data.postTypes.map((t) => [t.slug, t.label])),
  );

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
</script>

<svelte:head>
  <title>Callboard trash - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · callboard · trash</span>
  <h1 class="h1-display">Callboard trash.</h1>
  <p class="lede">{data.trashed.length} post{data.trashed.length !== 1 ? "s" : ""} in trash. Posts are permanently deleted after 30 days.</p>
  <a class="bt bt-ghost" href="/admin/callboard">&larr; Back to callboard</a>

  {#if form?.restored}<div class="form-ok" role="status">Restored {form.restored}.</div>{/if}
  {#if form?.hardDeleted}<div class="form-ok" role="status">Permanently deleted {form.hardDeleted}.</div>{/if}
  {#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
</header>

{#if data.trashed.length === 0}
  <p class="empty">Trash is empty.</p>
{:else}
  <table class="rows">
    <thead>
      <tr>
        <th>Post</th>
        <th>Type</th>
        <th>Trashed</th>
        <th class="actions-col">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.trashed as p (p.id)}
        <tr>
          <td data-label="Post">
            <div class="post-name">{p.title}</div>
            <div class="post-sub">{p.organization_name}</div>
            <div class="post-email">{p.submitter_email}</div>
          </td>
          <td data-label="Type">
            <span class="type-badge">{POST_TYPE_LABELS[p.post_type] ?? p.post_type}</span>
          </td>
          <td data-label="Trashed" class="mono-cell">{fmtDate(p.deleted_at)}</td>
          <td data-label="Actions" class="actions-col">
            <form
              method="POST"
              action="?/restore"
              use:enhance={() => {
                busyId = p.id;
                return async ({ update }) => { await update(); busyId = null; };
              }}
              style="display:inline"
            >
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" class="bt-link" disabled={busyId === p.id}>Restore</button>
            </form>
            <form
              method="POST"
              action="?/hardDelete"
              use:enhance={() => {
                busyId = p.id;
                return async ({ update }) => { await update(); busyId = null; };
              }}
              style="display:inline"
            >
              <input type="hidden" name="id" value={p.id} />
              <button
                type="button"
                class="bt-link warn"
                disabled={busyId === p.id}
                onclick={(e) => askHardDelete(e, p.title)}
              >Delete permanently</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<ConfirmModal
  open={pendingHardDeleteForm !== null}
  title="Delete permanently?"
  body={`"${pendingHardDeleteTitle}" will be permanently deleted. This cannot be undone.`}
  confirmLabel="Delete permanently"
  variant="warn"
  onConfirm={confirmHardDelete}
  onClose={cancelHardDelete}
/>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 900px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 18px; color: var(--muted); margin: 0 0 0.5rem; }
  .bt { font-family: var(--font-body); font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: var(--radius); cursor: pointer; border: 1px solid transparent; text-decoration: none; display: inline-flex; align-items: center; line-height: 1.2; width: fit-content; }
  .bt-ghost { background: transparent; color: var(--ink); border-color: var(--rule); }
  .bt-ghost:hover { border-color: var(--ink); text-decoration: none; }
  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; }
  .form-error { background: color-mix(in oklch, var(--warn), var(--bg) 80%); border: 1px solid var(--warn); color: var(--warn); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; }
  .empty { color: var(--muted); font-family: var(--font-accent); font-style: italic; padding: 3rem 0; text-align: center; }
  .rows { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 13px; }
  th { text-align: left; padding: 10px 12px; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); border-bottom: 1px solid var(--rule); font-weight: 500; }
  td { padding: 12px; border-bottom: 1px solid var(--rule-soft); vertical-align: top; }
  .post-name { font-weight: 500; color: var(--ink); }
  .post-sub { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
  .post-email { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .type-badge { display: inline-block; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; background: var(--paper); border: 1px solid var(--rule); color: var(--ink); padding: 3px 7px; border-radius: 2px; }
  .mono-cell { font-family: var(--font-mono); font-size: 11px; color: var(--muted); white-space: nowrap; }
  .actions-col { text-align: right; width: 1%; white-space: nowrap; }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--ink-soft); text-decoration: none; display: inline-block; }
  .bt-link.warn { color: var(--warn); }
  .bt-link:hover { text-decoration: underline; color: var(--ink); }
  .bt-link:disabled { opacity: 0.4; cursor: not-allowed; }
  @media (max-width: 720px) {
    .rows, .rows thead, .rows tbody, .rows tr, .rows td, .rows th { display: block; }
    .rows thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .rows tr { border: 1px solid var(--rule); border-radius: var(--radius); margin-bottom: 12px; padding: 12px 14px; background: var(--bg-raised); }
    .rows td { padding: 6px 0; border-bottom: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .rows td::before { content: attr(data-label); font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); flex: 0 0 auto; }
    .rows td:first-child { flex-direction: column; align-items: flex-start; gap: 2px; padding-bottom: 10px; margin-bottom: 6px; border-bottom: 1px solid var(--rule-soft); }
    .rows td:first-child::before { display: none; }
    .actions-col { text-align: left !important; width: auto !important; white-space: normal !important; }
  }
</style>
