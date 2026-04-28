<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";

  let { data, form } = $props();
  let busyId = $state<string | null>(null);

  // The form to submit when the user confirms the trash action.
  let pendingTrashForm = $state<HTMLFormElement | null>(null);
  let pendingTrashName = $state<string>("");

  function askTrash(e: MouseEvent, fullName: string) {
    pendingTrashForm = (e.currentTarget as HTMLElement).closest("form");
    pendingTrashName = fullName;
  }
  function cancelTrash() {
    pendingTrashForm = null;
    pendingTrashName = "";
  }
  function confirmTrash() {
    pendingTrashForm?.requestSubmit();
    cancelTrash();
  }
</script>

<svelte:head>
  <title>All profiles - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · profiles</span>
  <h1 class="h1-display">All profiles.</h1>
  <p class="lede">{data.total} live{data.trashCount ? `, ${data.trashCount} in trash` : ""}.</p>

  <form method="GET" class="search-row">
    <input type="search" name="q" placeholder="Search name, slug, or email..." value={data.q} />
    <input type="hidden" name="sort" value={data.sort} />
    <button type="submit" class="bt bt-pri">Search</button>
    {#if data.q}<a class="bt bt-ghost" href={`/admin/profiles?sort=${data.sort}`}>Clear</a>{/if}
    <a class="bt bt-acc" href="/admin/profiles/new">+ New profile</a>
    <a class="bt bt-ghost" href="/admin/profiles/trash">Trash ({data.trashCount})</a>
  </form>

  <div class="sort-row" aria-label="Sort" data-sveltekit-noscroll data-sveltekit-replacestate>
    <span class="sort-label">Sort</span>
    {#each [
      { value: "updated", label: "Recently updated" },
      { value: "newest", label: "Newest members" },
      { value: "name", label: "Last name A-Z" },
    ] as opt (opt.value)}
      <a
        class="chip"
        class:on={data.sort === opt.value}
        href={`?${new URLSearchParams({ ...(data.q ? { q: data.q } : {}), sort: opt.value }).toString()}`}
      >
        {opt.label}
      </a>
    {/each}
  </div>

  {#if form?.deleted}<div class="form-ok" role="status">Deleted {form.deleted}.</div>{/if}
  {#if form?.linkSent}<div class="form-ok" role="status">Edit link emailed to {form.linkSent}.</div>{/if}
  {#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
</header>

{#if data.profiles.length === 0}
  <p class="empty">No profiles match.</p>
{:else}
  <table class="rows">
    <thead>
      <tr>
        <th>Name</th>
        <th>Slug</th>
        <th>Disciplines</th>
        <th>Area</th>
        <th>Status</th>
        <th>Trust</th>
        <th class="actions-col">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.profiles as p (p.id)}
        <tr>
          <td data-label="Name">
            <a href={`/artists/${p.slug}`} target="_blank" rel="noopener">
              {p.full_name}
            </a>
            <div class="email">{p.email}</div>
          </td>
          <td data-label="Slug"><code>/{p.slug}</code></td>
          <td data-label="Disciplines" class="disc">{p.disciplines.slice(0, 3).join(", ")}{p.disciplines.length > 3 ? " +" + (p.disciplines.length - 3) : ""}</td>
          <td data-label="Area">{p.geographic_area ?? "—"}</td>
          <td data-label="Status">
            <form
              method="POST"
              action="?/togglePublish"
              use:enhance={() => {
                busyId = p.id;
                return async ({ update }) => {
                  await update();
                  busyId = null;
                };
              }}
            >
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="publish" value={(!p.published).toString()} />
              <button type="submit" class="pill" class:on={p.published} disabled={busyId === p.id}>
                {p.published ? "Live" : "Hidden"}
              </button>
            </form>
          </td>
          <td data-label="Trust">
            <form
              method="POST"
              action="?/toggleTrust"
              use:enhance={() => {
                busyId = p.id;
                return async ({ update }) => {
                  await update();
                  busyId = null;
                };
              }}
            >
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="trust" value={(!p.trusted).toString()} />
              <button
                type="submit"
                class="pill"
                class:on={p.trusted}
                disabled={busyId === p.id}
                title={p.trusted ? "Trusted - their edits apply directly. Click to revoke." : "Not trusted - major edits (headshot, disciplines) will queue for admin review. Click to grant trust."}
              >
                {p.trusted ? "Trusted" : "Not trusted"}
              </button>
            </form>
          </td>
          <td data-label="Actions" class="actions-col">
            <a class="bt-link" href={`/admin/profiles/${p.id}/edit`}>Edit</a>
            <form
              method="POST"
              action="?/sendEditLink"
              use:enhance={() => {
                busyId = p.id;
                return async ({ update }) => {
                  await update();
                  busyId = null;
                };
              }}
              style="display: inline"
            >
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" class="bt-link" disabled={busyId === p.id}>
                Send edit link
              </button>
            </form>
            <form
              method="POST"
              action="?/softDelete"
              use:enhance={() => {
                busyId = p.id;
                return async ({ update }) => {
                  await update();
                  busyId = null;
                };
              }}
              style="display: inline"
            >
              <input type="hidden" name="id" value={p.id} />
              <button
                type="button"
                class="bt-link warn"
                disabled={busyId === p.id}
                onclick={(e) => askTrash(e, p.full_name)}
              >
                Trash
              </button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<ConfirmModal
  open={pendingTrashForm !== null}
  title="Move to trash?"
  body={`${pendingTrashName} will be moved to the 30-day trash. You can restore them anytime within that window.`}
  confirmLabel="Move to trash"
  variant="warn"
  onConfirm={confirmTrash}
  onClose={cancelTrash}
/>

<style>
  .hd {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 1000px;
    margin-bottom: 2rem;
  }
  .h1-display {
    margin: 0.5rem 0 0.25rem;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--muted);
    margin: 0 0 1rem;
  }
  .search-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
    flex-wrap: wrap;
  }
  .search-row input {
    flex: 1;
    min-width: 220px;
    padding: 8px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg-raised);
  }
  .search-row input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .bt {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    padding: 8px 14px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    line-height: 1.2;
  }
  .bt-pri {
    background: var(--ink);
    color: var(--bg);
  }
  .bt-pri:hover {
    background: var(--accent);
    text-decoration: none;
  }
  .bt-acc {
    background: var(--accent);
    color: #fff;
  }
  .bt-acc:hover {
    background: var(--ink);
    text-decoration: none;
  }
  .bt-ghost {
    background: transparent;
    color: var(--ink);
    border-color: var(--rule);
  }
  .bt-ghost:hover {
    border-color: var(--ink);
    text-decoration: none;
  }
  .form-ok {
    background: color-mix(in oklch, var(--accent), var(--bg) 85%);
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
  }
  .form-error {
    background: color-mix(in oklch, var(--warn), var(--bg) 80%);
    border: 1px solid var(--warn);
    color: var(--warn);
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
  }

  .empty {
    color: var(--muted);
    font-family: var(--font-accent);
    font-style: italic;
    padding: 3rem 0;
    text-align: center;
  }

  .rows {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-body);
    font-size: 13px;
  }
  th {
    text-align: left;
    padding: 10px 12px;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    border-bottom: 1px solid var(--rule);
    font-weight: 500;
  }
  td {
    padding: 12px 12px;
    border-bottom: 1px solid var(--rule-soft);
    vertical-align: top;
  }
  td a {
    color: var(--ink);
    font-weight: 500;
  }
  td a:hover {
    color: var(--accent);
  }
  .email {
    color: var(--muted);
    font-size: 12px;
    margin-top: 2px;
  }
  td code {
    font-family: var(--font-mono);
    font-size: 12px;
    background: var(--paper);
    padding: 2px 6px;
    border-radius: 3px;
  }
  .disc {
    color: var(--ink-soft);
    max-width: 240px;
  }
  .actions-col {
    text-align: right;
    width: 1%;
    white-space: nowrap;
  }

  .pill {
    background: var(--paper);
    border: 1px solid var(--rule);
    padding: 4px 10px;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    cursor: pointer;
    border-radius: 100px;
  }
  .pill:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .pill.on {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .bt-link {
    background: none;
    border: 0;
    padding: 6px 10px;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
    text-decoration: none;
    display: inline-block;
  }
  .bt-link.warn {
    color: var(--warn);
  }
  .bt-link:hover {
    text-decoration: underline;
    color: var(--ink);
  }

  .sort-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }
  .sort-label {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin-right: 4px;
  }
  .sort-row .chip {
    background: transparent;
    border: 1px solid var(--rule);
    color: var(--ink-soft);
    font-family: var(--font-body);
    font-size: 12px;
    padding: 5px 11px;
    border-radius: 100px;
    text-decoration: none;
    cursor: pointer;
    line-height: 1.2;
  }
  .sort-row .chip:hover {
    border-color: var(--ink);
    color: var(--ink);
    text-decoration: none;
  }
  .sort-row .chip.on {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }

  /* Mobile: collapse the 7-column table into stacked cards. Each row
     becomes a self-contained card with labels rendered inline next to
     each value via data-label attributes (set in the markup). */
  @media (max-width: 720px) {
    .rows, .rows thead, .rows tbody, .rows tr, .rows td, .rows th {
      display: block;
    }
    .rows thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
    .rows tr {
      border: 1px solid var(--rule);
      border-radius: var(--radius);
      margin-bottom: 12px;
      padding: 12px 14px;
      background: var(--bg-raised);
    }
    .rows td {
      padding: 6px 0;
      border-bottom: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .rows td::before {
      content: attr(data-label);
      font-family: var(--font-mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      flex: 0 0 auto;
    }
    .rows td:first-child {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding-top: 0;
      padding-bottom: 10px;
      margin-bottom: 6px;
      border-bottom: 1px solid var(--rule-soft);
      font-size: 16px;
    }
    .rows td:first-child::before {
      display: none;
    }
    .rows td:first-child a {
      font-size: 16px;
    }
    .actions-col {
      text-align: left !important;
      width: auto !important;
      white-space: normal !important;
      flex-wrap: wrap;
      gap: 4px;
    }
    .disc {
      max-width: none !important;
      text-align: right;
    }
  }
</style>
