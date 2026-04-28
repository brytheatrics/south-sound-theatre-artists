<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import type { PageData, ActionData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let busyId = $state<string | null>(null);
  let pendingDeleteForm = $state<HTMLFormElement | null>(null);
  let pendingDeleteName = $state("");

  function askDelete(e: MouseEvent, name: string) {
    pendingDeleteForm = (e.currentTarget as HTMLElement).closest("form");
    pendingDeleteName = name;
  }
  function cancelDelete() { pendingDeleteForm = null; pendingDeleteName = ""; }
  function confirmDelete() { pendingDeleteForm?.requestSubmit(); cancelDelete(); }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function buildUrl(overrides: Record<string, string | null>) {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = {
      q: data.q || null,
      verified: data.verifiedFilter || null,
    };
    const merged = { ...base, ...overrides };
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const s = p.toString();
    return "/admin/orgs" + (s ? "?" + s : "");
  }
</script>

<svelte:head>
  <title>Verified organizations - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · organizations</span>
  <h1 class="h1-display">Organizations.</h1>
  <p class="lede">{data.total} organization{data.total !== 1 ? "s" : ""}.</p>

  <form method="GET" class="search-row">
    <input type="search" name="q" placeholder="Search name or email..." value={data.q} />
    {#if data.verifiedFilter}<input type="hidden" name="verified" value={data.verifiedFilter} />{/if}
    <button type="submit" class="bt bt-pri">Search</button>
    {#if data.q || data.verifiedFilter}
      <a class="bt bt-ghost" href="/admin/orgs">Clear</a>
    {/if}
  </form>

  <div class="filter-row" data-sveltekit-noscroll data-sveltekit-replacestate>
    <span class="filter-label">Status</span>
    {#each [
      { value: "", label: "All" },
      { value: "0", label: "Pending" },
      { value: "1", label: "Verified" },
    ] as opt (opt.value)}
      <a
        class="chip"
        class:on={data.verifiedFilter === opt.value}
        href={buildUrl({ verified: opt.value || null })}
      >{opt.label}</a>
    {/each}
  </div>

  {#if form?.approved}<div class="form-ok" role="status">Verified {form.approved} organization{form.approved !== 1 ? "s" : ""}.</div>{/if}
  {#if form?.revoked}<div class="form-ok" role="status">Revoked verification for {form.revoked}.</div>{/if}
  {#if form?.deleted}<div class="form-ok" role="status">Deleted {form.deleted}.</div>{/if}
  {#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
</header>

{#if data.orgs.length === 0}
  <p class="empty">No organizations match.</p>
{:else}
  <table class="rows">
    <thead>
      <tr>
        <th>Organization</th>
        <th>Status</th>
        <th>Applied</th>
        <th class="actions-col">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.orgs as org (org.id)}
        <tr>
          <td data-label="Organization">
            <div class="org-name">
              {org.name}
              {#if org.verified}
                <span class="verified-badge" title="Verified">&#10003;</span>
              {/if}
            </div>
            <div class="org-email">{org.contact_email}</div>
            {#if org.website_url}
              <div class="org-web">
                <a href={org.website_url} target="_blank" rel="noopener" class="ext-link">{org.website_url}</a>
              </div>
            {/if}
            {#if org.description}
              <div class="org-desc">{org.description.slice(0, 120)}{org.description.length > 120 ? "…" : ""}</div>
            {/if}
          </td>
          <td data-label="Status">
            <span class="status-pill" class:verified={org.verified}>
              {org.verified ? "Verified" : "Pending"}
            </span>
          </td>
          <td data-label="Applied" class="mono-cell">{fmtDate(org.created_at)}</td>
          <td data-label="Actions" class="actions-col">
            {#if !org.verified}
              <form
                method="POST"
                action="?/approve"
                use:enhance={() => {
                  busyId = org.id;
                  return async ({ update }) => { await update(); busyId = null; };
                }}
                style="display:inline"
              >
                <input type="hidden" name="id" value={org.id} />
                <button type="submit" class="bt-link" disabled={busyId === org.id}>Verify</button>
              </form>
            {:else}
              <form
                method="POST"
                action="?/revoke"
                use:enhance={() => {
                  busyId = org.id;
                  return async ({ update }) => { await update(); busyId = null; };
                }}
                style="display:inline"
              >
                <input type="hidden" name="id" value={org.id} />
                <button type="submit" class="bt-link warn" disabled={busyId === org.id}>Revoke</button>
              </form>
            {/if}
            <form
              method="POST"
              action="?/softDelete"
              use:enhance={() => {
                busyId = org.id;
                return async ({ update }) => { await update(); busyId = null; };
              }}
              style="display:inline"
            >
              <input type="hidden" name="id" value={org.id} />
              <button
                type="button"
                class="bt-link warn"
                disabled={busyId === org.id}
                onclick={(e) => askDelete(e, org.name)}
              >Delete</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<ConfirmModal
  open={pendingDeleteForm !== null}
  title="Delete organization?"
  body={`${pendingDeleteName} will be removed. This cannot be easily undone.`}
  confirmLabel="Delete"
  variant="warn"
  onConfirm={confirmDelete}
  onClose={cancelDelete}
/>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 1000px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 18px; color: var(--muted); margin: 0 0 0.5rem; }
  .search-row { display: flex; gap: 8px; align-items: stretch; flex-wrap: wrap; }
  .search-row input[type="search"] { flex: 1; min-width: 220px; padding: 8px 12px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-body); font-size: 14px; background: var(--bg-raised); }
  .search-row input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  .filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 0.25rem; }
  .filter-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin-right: 4px; }
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
  .org-name { font-weight: 500; color: var(--ink); display: flex; align-items: center; gap: 6px; }
  .org-email { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .org-web { font-size: 12px; margin-top: 2px; }
  .ext-link { color: var(--accent); }
  .org-desc { font-size: 12px; color: var(--ink-soft); margin-top: 4px; line-height: 1.4; }
  .verified-badge { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 9px; font-weight: 700; }
  .status-pill { display: inline-block; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border-radius: 100px; border: 1px solid var(--rule); background: var(--paper); color: var(--muted); }
  .status-pill.verified { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border-color: var(--accent); color: var(--accent); }
  .mono-cell { font-family: var(--font-mono); font-size: 11px; color: var(--muted); white-space: nowrap; }
  .actions-col { text-align: right; width: 1%; white-space: nowrap; }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--ink-soft); text-decoration: none; display: inline-block; }
  .bt-link.warn { color: var(--warn); }
  .bt-link:hover { text-decoration: underline; color: var(--ink); }
  .bt-link:disabled { opacity: 0.4; cursor: not-allowed; }
  .chip { background: transparent; border: 1px solid var(--rule); color: var(--ink-soft); font-family: var(--font-body); font-size: 12px; padding: 5px 11px; border-radius: 100px; text-decoration: none; cursor: pointer; line-height: 1.2; }
  .chip:hover { border-color: var(--ink); color: var(--ink); text-decoration: none; }
  .chip.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
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
