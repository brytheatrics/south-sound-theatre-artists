<script lang="ts">
  import { enhance } from "$app/forms";

  let { data, form } = $props();

  let openId = $state<string | null>(null);
  let rejectingId = $state<string | null>(null);
  let busyId = $state<string | null>(null);

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function fmtValue(v: unknown): string {
    if (v == null) return "(cleared)";
    if (Array.isArray(v)) {
      // Array of objects (e.g. resumes [{label, url}]) renders as
      // "Acting (file.pdf)"; plain string arrays just join with comma.
      if (v.length > 0 && typeof v[0] === "object") {
        return v
          .map((r: { label?: string; url?: string }) => {
            const file = r.url ? r.url.split("/").pop() : "";
            return r.label ? `${r.label}${file ? ` (${file})` : ""}` : (file ?? "");
          })
          .join(", ");
      }
      return v.join(", ");
    }
    // resume_data: summarise rather than dump the JSON.
    if (typeof v === "object") {
      const o = v as { credits?: unknown[]; training?: unknown[]; skills?: unknown[] };
      const parts: string[] = [];
      if (o.credits?.length) parts.push(`${o.credits.length} credit${o.credits.length === 1 ? "" : "s"}`);
      if (o.training?.length) parts.push(`${o.training.length} training`);
      if (o.skills?.length) parts.push(`${o.skills.length} skill group${o.skills.length === 1 ? "" : "s"}`);
      return parts.length > 0 ? parts.join(", ") : "(empty)";
    }
    return String(v);
  }
</script>

<svelte:head>
  <title>Flagged edits - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · flagged edits</span>
  <h1 class="h1-display">Edit review.</h1>
  <p class="lede">
    Major changes from untrusted profiles wait here for approval. Trust
    the artist on /admin/profiles to skip this queue going forward.
  </p>
  {#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
  {#if form?.approvedId}<div class="form-ok" role="status">Approved.</div>{/if}
  {#if form?.rejectedId}<div class="form-ok" role="status">Rejected.</div>{/if}
</header>

<nav class="tabs" aria-label="Filter">
  <a class="tab" class:on={data.tab === "open"} href="/admin/flagged-edits">
    Open ({data.openCount})
  </a>
  <a class="tab" class:on={data.tab === "history"} href="/admin/flagged-edits?tab=history">
    History
  </a>
</nav>

{#if data.flagged.length === 0}
  <p class="empty">
    {data.tab === "open" ? "Nothing to review." : "No history yet."}
  </p>
{:else}
  <ul class="list">
    {#each data.flagged as f (f.id)}
      {@const profile = (f.profile as unknown as { slug: string; full_name: string; email: string; headshot_url: string | null; bio: string | null; disciplines: string[]; trusted: boolean } | null)}
      {@const proposed = (f.proposed_changes ?? {}) as Record<string, unknown>}
      <li class="row" class:open={openId === f.id}>
        <button class="row-head" type="button" onclick={() => (openId = openId === f.id ? null : f.id)}>
          <div class="row-left">
            <span class="row-name">{profile?.full_name ?? "(deleted profile)"}</span>
            <span class="row-meta">
              {profile?.email ?? "—"}
              <span class="dot">·</span>
              {Object.keys(proposed).join(", ") || "(no fields)"}
            </span>
          </div>
          <span class="row-ago">
            {fmtDate(f.created_at)}
            {#if f.status !== "pending"}
              <span class="status">{f.status}</span>
            {/if}
          </span>
        </button>

        {#if openId === f.id}
          <div class="detail">
            {#if profile}
              <p class="link-row">
                <a href={`/artists/${profile.slug}`} target="_blank" rel="noopener">View profile ↗</a>
                {#if !profile.trusted}<span class="pill warn">Not trusted</span>{/if}
              </p>
            {/if}
            <table class="diff">
              <thead>
                <tr><th>Field</th><th>Current</th><th>Proposed</th></tr>
              </thead>
              <tbody>
                {#each Object.entries(proposed) as [field, value]}
                  <tr>
                    <td class="field">{field}</td>
                    <td class="cur">{fmtValue(profile?.[field as keyof typeof profile])}</td>
                    <td class="new">{fmtValue(value)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>

            {#if f.status === "pending"}
              <div class="actions">
                <form method="POST" action="?/approve"
                  use:enhance={() => { busyId = f.id; return async ({ update }) => { await update(); busyId = null; openId = null; }; }}>
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit" class="bt bt-pri" disabled={busyId === f.id}>
                    {busyId === f.id ? "Approving..." : "Approve"}
                  </button>
                </form>
                <button
                  type="button"
                  class="bt bt-ghost"
                  onclick={() => (rejectingId = rejectingId === f.id ? null : f.id)}
                >
                  {rejectingId === f.id ? "Cancel reject" : "Reject"}
                </button>
              </div>

              {#if rejectingId === f.id}
                <form method="POST" action="?/reject" class="reject-form"
                  use:enhance={() => { busyId = f.id; return async ({ update }) => { await update(); busyId = null; rejectingId = null; openId = null; }; }}>
                  <input type="hidden" name="id" value={f.id} />
                  <label>
                    <span>Reason (optional, included if you set a notify-on-reject)</span>
                    <textarea name="reason" rows="3"></textarea>
                  </label>
                  <button type="submit" class="bt bt-warn" disabled={busyId === f.id}>
                    Confirm reject
                  </button>
                </form>
              {/if}
            {:else if f.status === "rejected" && f.rejection_reason}
              <p class="reason">Reason: {f.rejection_reason}</p>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .hd {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 800px;
    margin-bottom: 1.5rem;
  }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 16px;
    color: var(--muted);
    margin: 0 0 0.5rem;
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

  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--rule);
  }
  .tab {
    padding: 8px 14px;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    text-decoration: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .tab:hover {
    color: var(--ink);
    text-decoration: none;
  }
  .tab.on {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }

  .empty {
    color: var(--muted);
    font-family: var(--font-accent);
    font-style: italic;
    padding: 3rem 0;
    text-align: center;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--bg-raised);
  }
  .row + .row { border-top: 1px solid var(--rule-soft); }
  .row-head {
    width: 100%;
    background: transparent;
    border: 0;
    text-align: left;
    padding: 14px 16px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .row-head:hover, .row.open .row-head { background: var(--paper); }
  .row-left { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .row-name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 15px;
    color: var(--ink);
  }
  .row-meta {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
  }
  .dot { color: var(--muted); padding: 0 4px; }
  .row-ago {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    white-space: nowrap;
  }
  .status {
    margin-left: 8px;
    padding: 2px 8px;
    border-radius: 100px;
    background: var(--paper);
    color: var(--ink-soft);
  }

  .detail {
    padding: 0 16px 16px;
    background: var(--bg);
    border-top: 1px solid var(--rule-soft);
  }
  .link-row {
    margin: 12px 0;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: var(--font-body);
    font-size: 14px;
  }
  .link-row a { color: var(--accent); }
  .pill.warn {
    background: color-mix(in oklch, var(--warn), var(--bg) 80%);
    color: var(--warn);
    border: 1px solid var(--warn);
    border-radius: 100px;
    padding: 2px 9px;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .diff {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-body);
    font-size: 13px;
    margin: 0.75rem 0 1rem;
  }
  .diff th {
    text-align: left;
    padding: 8px 10px;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    font-weight: 500;
    border-bottom: 1px solid var(--rule);
  }
  .diff td {
    padding: 10px;
    border-bottom: 1px solid var(--rule-soft);
    vertical-align: top;
    color: var(--ink-soft);
  }
  .diff .field {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    width: 1%;
    white-space: nowrap;
  }
  .diff .new {
    color: var(--ink);
    font-weight: 500;
  }
  .diff .cur {
    color: var(--muted);
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 0.5rem;
  }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 9px 18px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    line-height: 1.2;
  }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt-ghost {
    background: transparent;
    color: var(--ink);
    border-color: var(--rule);
  }
  .bt-ghost:hover { border-color: var(--ink); }
  .bt-warn { background: var(--warn); color: var(--bg); }
  .bt-warn:hover:not(:disabled) { background: var(--error); }
  .bt:disabled { opacity: 0.5; cursor: progress; }

  .reject-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 1rem;
  }
  .reject-form label { display: flex; flex-direction: column; gap: 6px; }
  .reject-form span {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .reject-form textarea {
    padding: 9px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg-raised);
    color: var(--ink);
  }
  .reject-form textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .reason {
    margin: 0.5rem 0 0;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
    background: var(--paper);
    padding: 10px 14px;
    border-radius: var(--radius);
  }
</style>
