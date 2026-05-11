<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function fmtRelative(iso: string | null): string {
    if (!iso) return "—";
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return `${Math.floor(ms / 86_400_000)}d ago`;
  }

  function clickedBadge(r: PageData["rows"][number]): { text: string; tone: "ok" | "muted" } {
    if (r.clicked) return { text: fmtRelative(r.last_click), tone: "ok" };
    return { text: "Not opened", tone: "muted" };
  }
  function completeBadge(r: PageData["rows"][number]): { text: string; tone: "ok" | "warn" | "muted" } {
    if (r.complete) return { text: "Complete", tone: "ok" };
    if (r.auto_hidden_incomplete) return { text: "Auto-hidden", tone: "warn" };
    return { text: "Incomplete", tone: "warn" };
  }
</script>

<svelte:head>
  <title>Invitations - Admin</title>
</svelte:head>

<main>
  <header>
    <h1>Invitations</h1>
    <p class="lede">
      Post-launch engagement view. Sorted: clicked-but-incomplete first (need
      attention), then unopened (chase), then complete (done).
    </p>
    <ul class="summary">
      <li><strong>{data.summary.total}</strong> invited</li>
      <li><strong>{data.summary.clicked}</strong> clicked their link</li>
      <li><strong>{data.summary.complete}</strong> profile complete</li>
      {#if data.summary.auto_hidden > 0}
        <li class="warn"><strong>{data.summary.auto_hidden}</strong> auto-hidden (30-day grace expired)</li>
      {/if}
    </ul>
  </header>

  <table>
    <thead>
      <tr>
        <th>Artist</th>
        <th>Email</th>
        <th>Invited</th>
        <th>Clicked their link</th>
        <th>Profile</th>
      </tr>
    </thead>
    <tbody>
      {#each data.rows as r (r.id)}
        {@const click = clickedBadge(r)}
        {@const comp = completeBadge(r)}
        <tr>
          <td>
            <a href="/artists/{r.slug}" target="_blank" rel="noopener">{r.full_name}</a>
            <code class="slug">/artists/{r.slug}</code>
          </td>
          <td><a href="mailto:{r.email}">{r.email}</a></td>
          <td class="time">{fmtRelative(r.invited_at)}</td>
          <td><span class="badge badge-{click.tone}">{click.text}</span></td>
          <td><span class="badge badge-{comp.tone}">{comp.text}</span></td>
        </tr>
      {/each}
    </tbody>
  </table>
</main>

<style>
  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem var(--page-pad-x);
  }
  h1 {
    font-family: var(--font-display);
    font-size: 2rem;
    margin: 0 0 0.5rem;
  }
  .lede {
    color: var(--ink-soft);
    margin: 0 0 1rem;
    max-width: 60ch;
    font-size: 14px;
  }
  .summary {
    list-style: none;
    padding: 0;
    margin: 0 0 2rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    font-family: var(--font-mono);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
  }
  .summary strong {
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 14px;
  }
  .summary li.warn strong { color: var(--warn); }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th, td {
    text-align: left;
    padding: 0.65rem 0.75rem;
    border-bottom: 1px solid var(--rule-soft);
    vertical-align: top;
  }
  th {
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
  }
  td a { color: var(--accent); text-decoration: none; }
  td a:hover { text-decoration: underline; }
  .slug {
    display: block;
    font-size: 11px;
    color: var(--muted);
    margin-top: 0.15rem;
  }
  .time { font-family: var(--font-mono); font-size: 12px; color: var(--ink-soft); white-space: nowrap; }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: 1px solid var(--rule);
  }
  .badge-ok { color: var(--accent); border-color: var(--accent); }
  .badge-warn { color: var(--warn); border-color: var(--warn); }
  .badge-muted { color: var(--muted); }
</style>
