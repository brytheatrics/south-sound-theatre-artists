<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function fmtRelative(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return `${Math.floor(ms / 86_400_000)}d ago`;
  }

  function snippet(s: string): string {
    return s.length > 140 ? s.slice(0, 140) + "…" : s;
  }

  const TABS = [
    { value: "new", label: "New" },
    { value: "in_progress", label: "In progress" },
    { value: "resolved", label: "Resolved" },
    { value: "spam", label: "Spam" },
    { value: "all", label: "All" },
  ];
</script>

<svelte:head>
  <title>Contact submissions - Admin</title>
</svelte:head>

<main>
  <header>
    <h1>Contact submissions</h1>
    <p class="lede">
      Public messages from the /contact form. Routing per category lives
      at <a href="/admin/contact-categories">contact categories</a>.
    </p>
    <nav class="tabs">
      {#each TABS as t (t.value)}
        <a class="tab" class:on={data.filter === t.value} href={t.value === "all" ? "/admin/contact" : `/admin/contact?status=${t.value}`}>
          {t.label}
          <span class="count">{data.counts[t.value] ?? 0}</span>
        </a>
      {/each}
    </nav>
  </header>

  {#if data.rows.length === 0}
    <p class="empty">No submissions in this filter.</p>
  {:else}
    <ul class="list">
      {#each data.rows as r (r.id)}
        <li>
          <a class="row" href="/admin/contact/{r.id}">
            <div class="row-head">
              <span class="kind kind-{r.status}">{r.status.replace("_", " ")}</span>
              <span class="cat">{r.category_label}</span>
              <span class="when">{fmtRelative(r.created_at)}</span>
            </div>
            <div class="from"><strong>{r.name}</strong> &lt;{r.email}&gt;</div>
            <p class="snip">{snippet(r.message)}</p>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main { max-width: 900px; margin: 0 auto; padding: 2rem var(--page-pad-x); }
  h1 { font-family: var(--font-display); font-size: 2rem; margin: 0 0 0.5rem; }
  .lede { color: var(--ink-soft); font-size: 14px; max-width: 60ch; margin: 0 0 1rem; }
  .lede a { color: var(--accent); }

  .tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0 0 1.5rem; }
  .tab {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    background: var(--bg-raised);
    color: var(--ink-soft);
    text-decoration: none;
    font-family: var(--font-mono);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .tab.on { border-color: var(--ink); color: var(--ink); background: var(--ink); color: var(--bg); }
  .tab.on .count { color: var(--bg); }
  .count { color: var(--muted); font-size: 11px; }

  .empty { color: var(--muted); font-style: italic; }
  .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
  .row {
    display: block;
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
    text-decoration: none;
    color: var(--ink);
  }
  .row:hover { border-color: var(--accent); }
  .row-head {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    flex-wrap: wrap;
    margin-bottom: 0.4rem;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .kind {
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid var(--rule);
  }
  .kind-new { color: var(--accent); border-color: var(--accent); }
  .kind-in_progress { color: var(--warn); border-color: var(--warn); }
  .kind-resolved { color: var(--muted); }
  .kind-spam { color: var(--muted); opacity: 0.6; }
  .cat { color: var(--ink-soft); }
  .when { margin-left: auto; }
  .from { font-size: 14px; margin-bottom: 0.4rem; }
  .snip {
    font-size: 13.5px;
    color: var(--ink-soft);
    margin: 0;
    line-height: 1.5;
    white-space: pre-wrap;
  }
</style>
