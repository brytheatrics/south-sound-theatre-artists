<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let busy = $state<string | null>(null);

  function fmtRel(iso: string | null): string {
    if (!iso) return "never";
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60_000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function statusClass(status: string | null): string {
    return status ? `st-${status}` : "st-pending";
  }
</script>

<svelte:head>
  <title>Calendar sources - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · calendar sources</span>
  <h1 class="h1-display">Calendar sources.</h1>
  <p class="lede">
    {data.sources.length} source{data.sources.length === 1 ? "" : "s"} are
    auto-pulled into <code>/calendar</code>. Each is read once per
    <code>cadence_days</code> (default 30), with HTML-hash caching so
    unchanged pages don't burn API tokens.
  </p>
</header>

{#if form?.error}
  <div class="form-error" role="alert">{form.error}</div>
{/if}
{#if form?.refreshed}
  <div class="form-ok" role="status">
    Refreshed <strong>{form.refreshed}</strong>:
    {form.result?.status} - {form.result?.showCount} shows, {form.result?.performanceCount} performances ($
    {form.result?.cost?.toFixed(4)})
  </div>
{/if}

<div class="src-list">
  {#each data.sources as s (s.id)}
    <article class="src-row" class:inactive={!s.active}>
      <div class="src-name">
        <h2>{s.org_name}</h2>
        <code class="src-slug">{s.org_slug}</code>
      </div>

      <div class="src-status">
        <span class="status-pill {statusClass(s.last_status)}">{s.last_status ?? "pending"}</span>
        <span class="status-meta">
          {s.last_show_count ?? 0} shows · checked {fmtRel(s.last_checked_at)}
        </span>
        {#if s.last_error}
          <div class="status-error">{s.last_error}</div>
        {/if}
      </div>

      <div class="src-url">
        <a href={s.source_url} target="_blank" rel="noopener">{s.source_url}</a>
        {#if s.notes}
          <div class="src-notes">{s.notes}</div>
        {/if}
      </div>

      <div class="src-actions">
        <form
          method="POST"
          action="?/refresh"
          use:enhance={() => {
            busy = s.id;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={s.id} />
          <button type="submit" class="bt bt-ghost" disabled={busy === s.id}>
            {busy === s.id ? "Refreshing..." : "Refresh now"}
          </button>
        </form>
      </div>
    </article>
  {/each}
</div>

<style>
  .hd {
    margin-bottom: 1.5rem;
  }
  .eyebrow {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    margin-bottom: 0.5rem;
  }
  .eyebrow .num {
    color: var(--accent);
    margin-right: 0.4em;
  }
  .h1-display {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 600;
    margin: 0 0 0.5rem;
  }
  .lede {
    color: var(--ink-soft);
    max-width: 60ch;
    margin: 0;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background: var(--paper-2);
    padding: 0 0.3em;
    border-radius: 3px;
  }

  .form-error,
  .form-ok {
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .form-error {
    background: #f9e0d4;
    color: var(--error);
    border: 1px solid var(--error);
  }
  .form-ok {
    background: #dceadd;
    color: var(--accent);
    border: 1px solid var(--accent);
  }

  .src-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .src-row {
    display: grid;
    grid-template-columns: 1.5fr 1.5fr 2fr auto;
    gap: 1rem;
    align-items: start;
    padding: 0.85rem 1rem;
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }
  .src-row.inactive {
    opacity: 0.55;
  }
  .src-name h2 {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.2rem;
    color: var(--ink);
  }
  .src-slug {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .status-pill {
    display: inline-block;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--paper-2);
    color: var(--ink-soft);
  }
  .status-pill.st-ok {
    background: #dceadd;
    color: var(--accent);
  }
  .status-pill.st-unchanged {
    background: var(--paper-2);
    color: var(--muted);
  }
  .status-pill.st-empty,
  .status-pill.st-error {
    background: #f9e0d4;
    color: var(--error);
  }
  .status-meta {
    display: block;
    font-size: 0.8rem;
    color: var(--muted);
    margin-top: 0.25rem;
  }
  .status-error {
    margin-top: 0.4rem;
    font-size: 0.78rem;
    color: var(--error);
    word-break: break-word;
  }

  .src-url a {
    color: var(--accent);
    word-break: break-all;
    font-size: 0.85rem;
  }
  .src-notes {
    margin-top: 0.3rem;
    font-size: 0.78rem;
    color: var(--muted);
    line-height: 1.4;
  }

  .src-actions {
    align-self: center;
  }
  .bt-ghost {
    padding: 0.4rem 0.85rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    font-size: 0.85rem;
    cursor: pointer;
  }
  .bt-ghost:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .bt-ghost:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 720px) {
    .src-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }
</style>
