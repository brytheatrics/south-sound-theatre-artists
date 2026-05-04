<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import type { PageData, ActionData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let busyId = $state<string | null>(null);
  let pendingDeleteForm = $state<HTMLFormElement | null>(null);
  let pendingDeleteTitle = $state("");

  let rejectingId = $state<string | null>(null);
  let rejectReason = $state("");
  let pendingRejectForm = $state<HTMLFormElement | null>(null);

  function askDelete(e: MouseEvent, title: string) {
    pendingDeleteForm = (e.currentTarget as HTMLElement).closest("form");
    pendingDeleteTitle = title;
  }
  function cancelDelete() { pendingDeleteForm = null; pendingDeleteTitle = ""; }
  function confirmDelete() { pendingDeleteForm?.requestSubmit(); cancelDelete(); }

  function askReject(e: MouseEvent, id: string) {
    rejectingId = id;
    rejectReason = "";
    pendingRejectForm = (e.currentTarget as HTMLElement).closest("form");
  }
  function cancelReject() { rejectingId = null; rejectReason = ""; pendingRejectForm = null; }

  const POST_TYPE_LABELS = $derived(
    Object.fromEntries(data.postTypes.map((t) => [t.slug, t.label])),
  );

  const STATUS_LABELS: Record<string, string> = {
    pending_email: "Awaiting email",
    pending_review: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
  };

  function buildUrl(overrides: Record<string, string | null>) {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = {
      q: data.q || null,
      status: data.statusFilter || null,
      type: data.typeFilter || null,
      page: data.page > 1 ? String(data.page) : null,
    };
    const merged = { ...base, ...overrides };
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const s = p.toString();
    return "/admin/callboard" + (s ? "?" + s : "");
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const totalPages = $derived(Math.ceil(data.total / data.pageSize));
</script>

<svelte:head>
  <title>Callboard management - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · callboard</span>
  <h1 class="h1-display">Callboard.</h1>
  <p class="lede">
    {data.total} post{data.total !== 1 ? "s" : ""}
    {data.pendingCount ? ` · ${data.pendingCount} pending review` : ""}
    {data.trashCount ? ` · ${data.trashCount} in trash` : ""}.
  </p>

  <form method="GET" class="search-row">
    <input type="search" name="q" placeholder="Search title, org, or email..." value={data.q} />
    {#if data.statusFilter}<input type="hidden" name="status" value={data.statusFilter} />{/if}
    {#if data.typeFilter}<input type="hidden" name="type" value={data.typeFilter} />{/if}
    <button type="submit" class="bt bt-pri">Search</button>
    {#if data.q || data.statusFilter || data.typeFilter}
      <a class="bt bt-ghost" href="/admin/callboard">Clear</a>
    {/if}
    <a class="bt bt-ghost" href="/admin/callboard/trash">Trash ({data.trashCount})</a>
  </form>

  <!-- Status filter chips -->
  <div class="filter-row" data-sveltekit-noscroll data-sveltekit-replacestate>
    <span class="filter-label">Status</span>
    {#each [
      { value: "", label: "All" },
      { value: "pending_review", label: "Pending review" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
      { value: "pending_email", label: "Awaiting email" },
    ] as opt (opt.value)}
      <a
        class="chip"
        class:on={data.statusFilter === opt.value}
        href={buildUrl({ status: opt.value || null, page: null })}
      >{opt.label}</a>
    {/each}
  </div>

  <!-- Type filter chips - dynamic from callboard_post_types -->
  <div class="filter-row" data-sveltekit-noscroll data-sveltekit-replacestate>
    <span class="filter-label">Type</span>
    <a class="chip" class:on={data.typeFilter === ""} href={buildUrl({ type: null, page: null })}>All</a>
    {#each data.postTypes as t (t.slug)}
      <a
        class="chip"
        class:on={data.typeFilter === t.slug}
        href={buildUrl({ type: t.slug, page: null })}
      >{t.label}</a>
    {/each}
  </div>

  {#if form?.approved}<div class="form-ok" role="status">Approved {form.approved} post{form.approved !== 1 ? "s" : ""}.</div>{/if}
  {#if form?.rejected}<div class="form-ok" role="status">Rejected {form.rejected} post{form.rejected !== 1 ? "s" : ""}.</div>{/if}
  {#if form?.deleted}<div class="form-ok" role="status">Moved {form.deleted} to trash.</div>{/if}
  {#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
</header>

{#if data.posts.length === 0}
  <p class="empty">No posts match.</p>
{:else}
  <table class="rows">
    <thead>
      <tr>
        <th>Post</th>
        <th>Type</th>
        <th>Status</th>
        <th>Submitted</th>
        <th class="actions-col">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.posts as p (p.id)}
        <tr>
          <td data-label="Post">
            <div class="post-title">
              <a href="/callboard/{p.id}" target="_blank" rel="noopener">{p.title}</a>
              {#if p.organization_id}
                <span class="verified-badge" title="Verified org">&#10003;</span>
              {/if}
            </div>
            <div class="post-sub">
              {p.organization_name}{p.area_name ? ` · ${p.area_name}` : ""}{p.location ? ` · ${p.location}` : ""}
              {#if !p.area_name}
                <span class="area-missing" title="No area set - cron treats this as universal until backfilled">no area</span>
              {/if}
            </div>
            <div class="post-email">{p.submitter_email}</div>
          </td>
          <td data-label="Type">
            <span class="type-badge">{POST_TYPE_LABELS[p.post_type] ?? p.post_type}</span>
          </td>
          <td data-label="Status">
            <span class="status-pill status-{p.status}">{STATUS_LABELS[p.status] ?? p.status}</span>
          </td>
          <td data-label="Submitted" class="mono-cell">{fmtDate(p.created_at)}</td>
          <td data-label="Actions" class="actions-col">
            <!-- Approve -->
            {#if p.status === "pending_review" || p.status === "pending_email"}
              <form
                method="POST"
                action="?/approve"
                use:enhance={() => {
                  busyId = p.id;
                  return async ({ update }) => { await update(); busyId = null; };
                }}
                style="display:inline"
              >
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" class="bt-link" disabled={busyId === p.id}>Approve</button>
              </form>
            {/if}

            <!-- Reject (shows inline reason field) -->
            {#if p.status === "pending_review"}
              {#if rejectingId === p.id}
                <form
                  method="POST"
                  action="?/reject"
                  use:enhance={() => {
                    busyId = p.id;
                    return async ({ update }) => { await update(); busyId = null; cancelReject(); };
                  }}
                  class="reject-inline"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <input
                    type="text"
                    name="reason"
                    class="reject-input"
                    placeholder="Rejection reason (sent to submitter)..."
                    bind:value={rejectReason}
                    required
                    autofocus
                  />
                  <button type="submit" class="bt-link warn" disabled={!rejectReason.trim()}>Send</button>
                  <button type="button" class="bt-link" onclick={cancelReject}>Cancel</button>
                </form>
              {:else}
                <button
                  type="button"
                  class="bt-link warn"
                  onclick={(e) => askReject(e, p.id)}
                >Reject</button>
              {/if}
            {/if}

            <!-- Trash -->
            <form
              method="POST"
              action="?/softDelete"
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
                onclick={(e) => askDelete(e, p.title)}
              >Trash</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <!-- Pagination -->
  {#if totalPages > 1}
    <nav class="pagination" aria-label="Pagination">
      {#if data.page > 1}
        <a class="bt bt-ghost" href={buildUrl({ page: String(data.page - 1) })}>&#8592; Prev</a>
      {/if}
      {#each Array.from({ length: totalPages }, (_, i) => i + 1) as pg}
        {#if pg === 1 || pg === totalPages || (pg >= data.page - 2 && pg <= data.page + 2)}
          <a
            class="bt"
            class:bt-pri={pg === data.page}
            class:bt-ghost={pg !== data.page}
            href={buildUrl({ page: pg === 1 ? null : String(pg) })}
          >{pg}</a>
        {:else if pg === data.page - 3 || pg === data.page + 3}
          <span class="pagination-ellipsis">&hellip;</span>
        {/if}
      {/each}
      {#if data.page < totalPages}
        <a class="bt bt-ghost" href={buildUrl({ page: String(data.page + 1) })}>Next &#8594;</a>
      {/if}
    </nav>
  {/if}
{/if}

<ConfirmModal
  open={pendingDeleteForm !== null}
  title="Move to trash?"
  body={`"${pendingDeleteTitle}" will be moved to the 30-day trash.`}
  confirmLabel="Move to trash"
  variant="warn"
  onConfirm={confirmDelete}
  onClose={cancelDelete}
/>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 1100px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 18px; color: var(--muted); margin: 0 0 0.5rem; }

  .search-row { display: flex; gap: 8px; align-items: stretch; flex-wrap: wrap; }
  .search-row input[type="search"] {
    flex: 1; min-width: 220px; padding: 8px 12px;
    border: 1px solid var(--rule); border-radius: var(--radius);
    font-family: var(--font-body); font-size: 14px; background: var(--bg-raised);
  }
  .search-row input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }

  .filter-row {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 0.25rem;
  }
  .filter-label {
    font-family: var(--font-mono); font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.14em; color: var(--muted); margin-right: 4px;
  }

  .bt { font-family: var(--font-body); font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: var(--radius); cursor: pointer; border: 1px solid transparent; text-decoration: none; display: inline-flex; align-items: center; line-height: 1.2; }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover { background: var(--accent); text-decoration: none; }
  .bt-ghost { background: transparent; color: var(--ink); border-color: var(--rule); }
  .bt-ghost:hover { border-color: var(--ink); text-decoration: none; }

  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; }
  .form-error { background: color-mix(in oklch, var(--warn), var(--bg) 80%); border: 1px solid var(--warn); color: var(--warn); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; }
  .empty { color: var(--muted); font-family: var(--font-accent); font-style: italic; padding: 3rem 0; text-align: center; }

  .rows { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 13px; }
  th { text-align: left; padding: 10px 12px; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); border-bottom: 1px solid var(--rule); font-weight: 500; }
  td { padding: 12px; border-bottom: 1px solid var(--rule-soft); vertical-align: top; }
  td a { color: var(--ink); font-weight: 500; }
  td a:hover { color: var(--accent); }

  .post-title { display: flex; align-items: center; gap: 6px; }
  .post-sub { color: var(--ink-soft); font-size: 12px; margin-top: 2px; }
  /* "no area" pill: small warn-tone badge on rows that pre-date mig 071's
     area_id requirement. Click-to-edit isn't built yet - admin can re-
     submit or hand-edit via SQL if they want to backfill. */
  .area-missing {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.05rem 0.45rem;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: color-mix(in oklch, var(--warn), var(--bg) 88%);
    color: var(--warn);
    border: 1px solid var(--warn);
  }
  .post-email { color: var(--muted); font-size: 12px; margin-top: 2px; }

  .verified-badge { display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 8px; font-weight: 700; }

  .type-badge { display: inline-block; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; background: var(--paper); border: 1px solid var(--rule); color: var(--ink); padding: 3px 7px; border-radius: 2px; }

  .status-pill { display: inline-block; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border-radius: 100px; border: 1px solid var(--rule); }
  .status-pending_review { background: color-mix(in oklch, var(--warn), var(--bg) 80%); border-color: var(--warn); color: var(--warn); }
  .status-approved { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border-color: var(--accent); color: var(--accent); }
  .status-rejected { background: var(--paper); color: var(--muted); }
  .status-pending_email { background: var(--paper); color: var(--muted); }

  .mono-cell { font-family: var(--font-mono); font-size: 11px; color: var(--muted); white-space: nowrap; }

  .actions-col { text-align: right; width: 1%; white-space: nowrap; }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--ink-soft); text-decoration: none; display: inline-block; }
  .bt-link.warn { color: var(--warn); }
  .bt-link:hover { text-decoration: underline; color: var(--ink); }
  .bt-link:disabled { opacity: 0.4; cursor: not-allowed; }

  .reject-inline { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .reject-input { font-family: var(--font-body); font-size: 12px; padding: 5px 8px; border: 1px solid var(--warn); border-radius: var(--radius); background: var(--bg-raised); color: var(--ink); width: 240px; }
  .reject-input:focus { outline: 2px solid var(--warn); outline-offset: -1px; }

  .pagination { display: flex; justify-content: center; gap: 6px; padding: 2rem 0; flex-wrap: wrap; align-items: center; }
  .pagination-ellipsis { font-family: var(--font-mono); color: var(--muted); padding: 0 4px; }

  .chip { background: transparent; border: 1px solid var(--rule); color: var(--ink-soft); font-family: var(--font-body); font-size: 12px; padding: 5px 11px; border-radius: 100px; text-decoration: none; cursor: pointer; line-height: 1.2; }
  .chip:hover { border-color: var(--ink); color: var(--ink); text-decoration: none; }
  .chip.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }

  /* Mobile card collapse */
  @media (max-width: 720px) {
    .rows, .rows thead, .rows tbody, .rows tr, .rows td, .rows th { display: block; }
    .rows thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .rows tr { border: 1px solid var(--rule); border-radius: var(--radius); margin-bottom: 12px; padding: 12px 14px; background: var(--bg-raised); }
    .rows td { padding: 6px 0; border-bottom: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .rows td::before { content: attr(data-label); font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); flex: 0 0 auto; }
    .rows td:first-child { flex-direction: column; align-items: flex-start; gap: 2px; padding-bottom: 10px; margin-bottom: 6px; border-bottom: 1px solid var(--rule-soft); font-size: 15px; }
    .rows td:first-child::before { display: none; }
    .actions-col { text-align: left !important; width: auto !important; white-space: normal !important; flex-wrap: wrap; gap: 4px; }
    .reject-inline { width: 100%; }
    .reject-input { width: 100%; }
  }
</style>
