<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let busyId = $state<string | null>(null);
  let openNote = $state<string | null>(null);

  function timeAgo(iso: string): string {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
</script>

<svelte:head><title>Reports - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · reports</span>
  <h1 class="h1-display">Reports.</h1>
  <div class="tabs">
    <a href="?status=open" class:on={data.status === "open"}>Open ({data.counts.open})</a>
    <a href="?status=resolved" class:on={data.status === "resolved"}>Resolved ({data.counts.resolved})</a>
    <a href="?status=dismissed" class:on={data.status === "dismissed"}>Dismissed ({data.counts.dismissed})</a>
  </div>
  {#if form?.resolved}<div class="form-ok">Resolved {form.resolved}.</div>{/if}
  {#if form?.dismissed}<div class="form-ok">Dismissed {form.dismissed}.</div>{/if}
</header>

{#if data.reports.length === 0}
  <p class="empty">Nothing here.</p>
{:else}
  <ul class="list">
    {#each data.reports as r (r.id)}
      <li class="row">
        <div class="row-head">
          <div>
            {#if r.target}
              <a href={`/artists/${r.target.slug}`} target="_blank" rel="noopener" class="target">
                {r.target.full_name}
              </a>
            {:else}
              <span class="target">(target removed)</span>
            {/if}
            <span class="meta">
              from {r.reporter_email ?? "anon"} · {timeAgo(r.created_at)}
            </span>
          </div>
          {#if r.status === "open"}
            <div class="actions">
              <button type="button" class="bt-link" onclick={() => (openNote = openNote === r.id ? null : r.id)}>
                Add note
              </button>
              <form method="POST" action="?/resolve" use:enhance={() => { busyId = r.id; return async ({ update }) => { await update(); busyId = null; }; }}>
                <input type="hidden" name="id" value={r.id} />
                {#if openNote === r.id}<input type="hidden" name="note" value={(document.getElementById(`note-${r.id}`) as HTMLTextAreaElement)?.value ?? ""} />{/if}
                <button type="submit" class="bt-link" disabled={busyId === r.id}>Resolve</button>
              </form>
              <form method="POST" action="?/dismiss" use:enhance={() => { busyId = r.id; return async ({ update }) => { await update(); busyId = null; }; }}>
                <input type="hidden" name="id" value={r.id} />
                {#if openNote === r.id}<input type="hidden" name="note" value={(document.getElementById(`note-${r.id}`) as HTMLTextAreaElement)?.value ?? ""} />{/if}
                <button type="submit" class="bt-link warn" disabled={busyId === r.id}>Dismiss</button>
              </form>
            </div>
          {/if}
        </div>
        <p class="reason">{r.reason}</p>
        {#if openNote === r.id}
          <textarea id={`note-${r.id}`} placeholder="Internal note (optional)" rows="2"></textarea>
        {/if}
        {#if r.admin_notes}
          <p class="note"><strong>Note:</strong> {r.admin_notes}</p>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 800px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .tabs { display: flex; gap: 1.25rem; margin: 0.5rem 0; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; }
  .tabs a { color: var(--muted); text-decoration: none; padding-bottom: 4px; border-bottom: 2px solid transparent; }
  .tabs a:hover { color: var(--ink); text-decoration: none; }
  .tabs a.on { color: var(--ink); border-color: var(--accent); }
  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; }
  .empty { color: var(--muted); font-family: var(--font-accent); font-style: italic; padding: 3rem 0; text-align: center; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
  .row { padding: 14px 18px; background: var(--bg-raised); border: 1px solid var(--rule); border-radius: var(--radius); }
  .row-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .target { font-family: var(--font-display); font-weight: 600; color: var(--ink); margin-right: 8px; }
  .target:hover { color: var(--accent); }
  .meta { color: var(--muted); font-size: 12px; }
  .actions { display: flex; gap: 4px; }
  .bt-link {
    background: none;
    border: 0;
    padding: 4px 8px;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
  }
  .bt-link.warn { color: var(--warn); }
  .bt-link:hover { text-decoration: underline; }
  .reason {
    margin: 8px 0 0;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
    line-height: 1.55;
    white-space: pre-line;
  }
  .note {
    margin: 8px 0 0;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
  }
  textarea {
    margin-top: 8px;
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg);
    resize: vertical;
  }
  textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
</style>
