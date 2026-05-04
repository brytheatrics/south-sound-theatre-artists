<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();

  function fmtDateRange(start: string | null, end: string | null) {
    if (!start && !end) return "—";
    if (start && !end) return start;
    if (!start && end) return end;
    if (start === end) return start;
    return `${start} → ${end}`;
  }

  function buildUrl(overrides: Record<string, string | null>) {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = {
      q: data.q || null,
      status: data.statusFilter || null,
      source: data.sourceFilter || null,
      when: data.whenFilter !== "upcoming" ? data.whenFilter : null,
      page: data.page > 1 ? String(data.page) : null,
    };
    const merged = { ...base, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return "/admin/calendar" + (s ? "?" + s : "");
  }

  const totalPages = $derived(Math.ceil(data.total / data.pageSize));
  let selectedIds = $state<Set<string>>(new Set());
  let showRejectReason = $state(false);

  function toggleSelect(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    selectedIds = next;
  }
</script>

<svelte:head>
  <title>Calendar - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · calendar</span>
  <h1 class="h1-display">Calendar productions.</h1>
  <p class="lede">
    Every show on the public calendar. Most are pulled automatically
    from theatre websites once a month; the rest you've added by hand.
    {data.pendingCount > 0
      ? `${data.pendingCount} ${data.pendingCount === 1 ? "production needs" : "productions need"} review.`
      : ""}
  </p>
  <div class="hd-actions">
    <a class="bt bt-pri" href="/admin/calendar/new">+ Add production</a>
    <a class="bt bt-ghost" href="/admin/organizations">Manage theatres →</a>
  </div>
</header>

{#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
{#if form?.approved}<div class="form-ok" role="status">Approved {form.approved}.</div>{/if}
{#if form?.rejected}<div class="form-ok" role="status">Rejected {form.rejected}.</div>{/if}
{#if form?.deleted}<div class="form-ok" role="status">Moved {form.deleted} to trash.</div>{/if}

<!-- FILTERS -->
<form method="GET" class="filters" data-sveltekit-noscroll>
  <input
    type="search"
    name="q"
    placeholder="Search title or org..."
    value={data.q}
    class="search-input"
  />
  <select name="status" class="filter-select">
    <option value="">All statuses</option>
    <option value="pending_review" selected={data.statusFilter === "pending_review"}>Pending review</option>
    <option value="approved" selected={data.statusFilter === "approved"}>Approved</option>
    <option value="rejected" selected={data.statusFilter === "rejected"}>Rejected</option>
  </select>
  <select name="source" class="filter-select">
    <option value="">All sources</option>
    <option value="auto" selected={data.sourceFilter === "auto"}>Auto-pop'd (cron)</option>
    <option value="manual" selected={data.sourceFilter === "manual"}>Manual</option>
  </select>
  <select name="when" class="filter-select">
    <option value="upcoming" selected={data.whenFilter === "upcoming"}>Upcoming + current</option>
    <option value="past" selected={data.whenFilter === "past"}>Past (closed)</option>
    <option value="all" selected={data.whenFilter === "all"}>All time</option>
  </select>
  <button type="submit" class="bt bt-ghost">Apply</button>
  {#if data.q || data.statusFilter || data.sourceFilter || data.whenFilter !== "upcoming"}
    <a class="bt bt-ghost" href="/admin/calendar">Clear</a>
  {/if}
</form>

{#if data.whenFilter === "upcoming" && data.pastCount > 0}
  <p class="hidden-past-note">
    {data.pastCount} past show{data.pastCount === 1 ? "" : "s"} hidden.
    <a href={buildUrl({ when: "all" })}>Show all</a>
    ·
    <a href={buildUrl({ when: "past" })}>Just past</a>
  </p>
{/if}

<!-- BULK ACTIONS BAR (only when something selected) -->
{#if selectedIds.size > 0}
  <div class="bulk-actions">
    <span>{selectedIds.size} selected</span>
    <form method="POST" action="?/approve" use:enhance>
      {#each Array.from(selectedIds) as id (id)}<input type="hidden" name="id" value={id} />{/each}
      <button type="submit" class="bt bt-ghost">Approve</button>
    </form>
    <form method="POST" action="?/softDelete" use:enhance>
      {#each Array.from(selectedIds) as id (id)}<input type="hidden" name="id" value={id} />{/each}
      <button type="submit" class="bt bt-ghost">Move to trash</button>
    </form>
    <button class="bt bt-ghost" onclick={() => (showRejectReason = !showRejectReason)}>
      Reject…
    </button>
  </div>
  {#if showRejectReason}
    <form method="POST" action="?/reject" use:enhance class="reject-form">
      {#each Array.from(selectedIds) as id (id)}<input type="hidden" name="id" value={id} />{/each}
      <input name="reason" type="text" placeholder="Rejection reason (optional, internal note)" />
      <button type="submit" class="bt bt-pri">Reject</button>
    </form>
  {/if}
{/if}

<!-- LIST TABLE -->
{#if data.productions.length === 0}
  <p class="empty">No productions match these filters.</p>
{:else}
  <table class="rows">
    <thead>
      <tr>
        <th class="sel"></th>
        <th>Title</th>
        <th>Organization</th>
        <th>Run</th>
        <th>Perfs</th>
        <th>Status</th>
        <th>Source</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.productions as p (p.id)}
        <tr>
          <td class="sel">
            <input
              type="checkbox"
              checked={selectedIds.has(p.id)}
              onchange={(e) => toggleSelect(p.id, (e.target as HTMLInputElement).checked)}
            />
          </td>
          <td class="title-cell">
            <a href="/admin/calendar/{p.id}/edit">{p.title}</a>
            {#if p.category_name}
              <span class="cat-pill">{p.category_name}</span>
            {/if}
          </td>
          <td>{p.organization_name}</td>
          <td class="mono">{fmtDateRange(p.run_start, p.run_end)}</td>
          <td class="num-cell">{p.performance_count}</td>
          <td><span class="status-pill st-{p.status}">{p.status.replace("_", " ")}</span></td>
          <td>
            {#if p.is_auto_pop}
              <span class="src-pill src-auto">auto</span>
            {:else}
              <span class="src-pill src-manual">manual</span>
            {/if}
            {#if p.is_admin_locked}
              <span class="src-pill src-locked" title="Admin-edited - cron will skip this row on future syncs">🔒 locked</span>
            {/if}
          </td>
          <td class="actions-cell">
            <a href="/admin/calendar/{p.id}/edit" class="bt bt-ghost bt-sm">Edit</a>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if totalPages > 1}
    <nav class="pagination">
      {#if data.page > 1}<a class="bt bt-ghost" href={buildUrl({ page: String(data.page - 1) })}>Prev</a>{/if}
      <span>Page {data.page} of {totalPages}</span>
      {#if data.page < totalPages}<a class="bt bt-ghost" href={buildUrl({ page: String(data.page + 1) })}>Next</a>{/if}
    </nav>
  {/if}
{/if}

<style>
  .hd { margin-bottom: 1.5rem; }
  .eyebrow {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin-bottom: 0.5rem;
  }
  .eyebrow .num { color: var(--accent); margin-right: 0.4em; }
  .h1-display { font-family: var(--font-display); font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 600; margin: 0 0 0.5rem; }
  .lede { color: var(--ink-soft); max-width: 60ch; margin: 0 0 1rem; }
  code { font-family: var(--font-mono); font-size: 0.9em; background: var(--paper-2); padding: 0 0.3em; border-radius: 3px; }

  .hd-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .bt {
    display: inline-block;
    padding: 0.45rem 0.95rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    text-decoration: none;
    font-size: 0.875rem;
    cursor: pointer;
    font-family: var(--font-body);
  }
  .bt:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }
  .bt-pri { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); color: white; }
  .bt-sm { padding: 0.25rem 0.6rem; font-size: 0.8rem; }

  .form-error, .form-ok {
    padding: 0.65rem 1rem;
    border-radius: var(--radius);
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .form-error { background: #f9e0d4; color: var(--error); border: 1px solid var(--error); }
  .form-ok { background: #dceadd; color: var(--accent); border: 1px solid var(--accent); }

  .filters {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
    align-items: center;
  }
  .search-input, .filter-select {
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 0.9rem;
    background: var(--bg-raised);
    color: var(--ink);
  }
  .search-input { min-width: 240px; flex: 1 1 200px; }

  .bulk-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.85rem;
    margin-bottom: 1rem;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 0.85rem;
  }
  .reject-form {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .reject-form input {
    flex: 1;
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }

  .empty { padding: 2rem; text-align: center; color: var(--muted); }

  .hidden-past-note {
    margin: 0 0 1rem;
    padding: 0.5rem 0.85rem;
    font-size: 0.85rem;
    color: var(--muted);
    background: var(--paper);
    border: 1px solid var(--rule-soft);
    border-radius: var(--radius);
  }
  .hidden-past-note a { color: var(--accent); }

  .rows {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .rows th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    border-bottom: 1px solid var(--rule);
  }
  .rows td {
    padding: 0.55rem 0.75rem;
    border-bottom: 1px solid var(--rule-soft);
    vertical-align: middle;
  }
  .rows tr:hover td { background: var(--paper); }
  .rows .sel { width: 28px; }
  .title-cell a { color: var(--ink); font-weight: 500; }
  .title-cell a:hover { color: var(--accent); }
  .cat-pill {
    display: inline-block;
    margin-left: 0.4rem;
    font-size: 0.7rem;
    color: var(--muted);
    background: var(--paper-2);
    padding: 0 0.4em;
    border-radius: 999px;
  }
  .mono { font-family: var(--font-mono); font-size: 0.8rem; color: var(--muted); }
  .num-cell { text-align: center; font-family: var(--font-mono); color: var(--muted); }
  .status-pill, .src-pill {
    display: inline-block;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-family: var(--font-mono);
    text-transform: uppercase;
  }
  .st-pending_review { background: #f4ecd8; color: #8a6e1c; }
  .st-approved { background: #dceadd; color: var(--accent); }
  .st-rejected { background: #f9e0d4; color: var(--error); }
  .src-auto { background: #e1ebf2; color: #406480; }
  .src-manual { background: #f1ede0; color: var(--muted); }
  .src-locked { background: #f4ecd8; color: #8a6e1c; margin-left: 0.25rem; }
  .actions-cell { text-align: right; white-space: nowrap; }

  .pagination {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 1rem 0;
    color: var(--muted);
    font-size: 0.875rem;
  }

  @media (max-width: 720px) {
    .rows thead { display: none; }
    .rows, .rows tbody, .rows tr, .rows td { display: block; }
    .rows tr { padding: 0.75rem; border: 1px solid var(--rule); border-radius: var(--radius); margin-bottom: 0.5rem; }
    .rows td { border: none; padding: 0.2rem 0; }
    .rows td.sel { display: none; }
  }
</style>
