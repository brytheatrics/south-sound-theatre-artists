<script lang="ts">
  import { page } from "$app/state";
  let { data } = $props();
  // svelte-ignore state_referenced_locally
  const org = data.org;
  // svelte-ignore state_referenced_locally
  const productions = data.productions;

  function fmtDate(iso: string | null): string {
    if (!iso) return "TBD";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
</script>

<svelte:head>
  <title>Manage credits - {org.name} - SSTA</title>
</svelte:head>

<article class="page">
  <header class="head">
    <span class="eyebrow"><span class="num">·</span>Org credits</span>
    <h1 class="t">{org.name}</h1>
    <p class="lede">
      Pick a production below to add or update its cast and creative
      credits. Tagging an artist who's in the SSTA directory will show
      the production on their profile and add a credit row to their
      resume builder automatically.
    </p>
  </header>

  {#if productions.length === 0}
    <p class="empty">No productions yet for this organization.</p>
  {:else}
    <ul class="prods">
      {#each productions as p (p.id)}
        <li class="prod">
          <div class="prod-meta">
            <strong>{p.title}</strong>
            <span class="dates">{fmtDate(p.run_start)} - {fmtDate(p.run_end)}</span>
            {#if p.status !== "approved"}
              <span class="status-pill">{p.status}</span>
            {/if}
          </div>
          <div class="prod-actions">
            <a class="bt-ghost" href={`/calendar/${p.id}`} target="_blank" rel="noopener">View ↗</a>
            <a class="bt" href={`/org-edit/${page.params.token}/credits/${p.id}`}>Manage credits →</a>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</article>

<style>
  .page {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .head { display: flex; flex-direction: column; gap: 6px; }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    display: inline-flex;
    gap: 8px;
  }
  .num { color: var(--accent); }
  .t {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(28px, 5vw, 40px);
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.02em;
  }
  .lede {
    margin: 0;
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--ink-soft);
    line-height: 1.55;
  }
  .empty {
    margin: 0;
    padding: 12px 14px;
    border: 1px dashed var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    color: var(--muted);
  }
  .prods {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .prod {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    flex-wrap: wrap;
  }
  .prod-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .dates {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
  }
  .status-pill {
    align-self: flex-start;
    margin-top: 2px;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    padding: 2px 6px;
    border: 1px solid var(--warn);
    color: var(--warn);
    border-radius: var(--radius);
  }
  .prod-actions {
    display: flex;
    gap: 6px;
  }
  .bt {
    padding: 7px 14px;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    background: var(--ink);
    color: var(--bg);
    font-family: var(--font-body);
    font-size: 13px;
    text-decoration: none;
  }
  .bt-ghost {
    padding: 7px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 13px;
    text-decoration: none;
  }
  .bt-ghost:hover { border-color: var(--ink); }
</style>
