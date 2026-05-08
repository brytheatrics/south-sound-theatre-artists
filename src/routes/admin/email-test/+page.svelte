<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();

  // Track which slug was just sent / errored so the per-row feedback
  // doesn't flash on every other row's send.
  let pendingSlug = $state<string | null>(null);

  // Per-admin "tested" state stored in localStorage. Click the checkbox
  // to mark a template as tested; uncheck if you have notes / need to
  // retest. Survives page reloads on the same browser. Not synced
  // across machines (this is a temporary tool; localStorage is fine).
  const STORAGE_KEY = "ssta_email_test_tested";
  let tested = $state<Record<string, boolean>>({});

  $effect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) tested = JSON.parse(raw);
    } catch {
      // bad JSON or quota error — ignore, start fresh
    }
  });

  function toggleTested(slug: string, checked: boolean) {
    tested = { ...tested, [slug]: checked };
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tested));
    } catch {
      // ignore
    }
  }

  const testedCount = $derived(
    data.templates.filter((t) => tested[t.slug]).length,
  );
</script>

<svelte:head>
  <title>Email test - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="warn-banner" role="alert">
  <strong>Temporary tool.</strong> Delete this page (and
  <code>src/lib/server/test-email.ts</code>) before launch. Every
  button below sends a real email to <code>{data.recipient}</code> via
  the production pipeline, with real tokens minted against the Test
  Profile / Test Org / etc. so click-throughs land on working pages.
</div>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · email test</span>
  <h1 class="h1-display">Email test panel.</h1>
  <p class="lede">
    One button per template. All sends go to <strong>{data.recipient}</strong>.
    Tokens are minted real (against Test Profile / Test Org rows that
    auto-create on first send), so links in the received email
    actually work — clicking opens the real edit / verify / confirm
    flow against the test target.
  </p>
  <p class="meta">
    Progress: <strong>{testedCount}</strong> of {data.templates.length} marked tested.
    Click the checkbox in the first column to mark a template as
    tested; uncheck if you have notes or want to retest later.
    (State is saved on this browser only.)
  </p>
</header>

{#if form?.error}
  <div class="form-error" role="alert">{form.error}</div>
{/if}
{#if form?.sent}
  <div class="form-ok" role="status">
    Sent <code>{form.sent}</code> to <code>{data.recipient}</code>. Check the inbox.
  </div>
{/if}

<table class="rows">
  <thead>
    <tr>
      <th class="check-col">✓</th>
      <th>Slug</th>
      <th>Audience</th>
      <th>Subject</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    {#each data.templates as t (t.slug)}
      <tr class:tested={tested[t.slug]}>
        <td class="check-col">
          <input
            type="checkbox"
            aria-label={`Mark ${t.slug} as tested`}
            checked={!!tested[t.slug]}
            onchange={(e) => toggleTested(t.slug, (e.target as HTMLInputElement).checked)}
          />
        </td>
        <td class="mono">{t.slug}</td>
        <td>
          <span class="audience-pill au-{t.audience}">{t.audience}</span>
        </td>
        <td class="subject-cell">{t.subject}</td>
        <td class="actions-cell">
          <form
            method="POST"
            action="?/send"
            use:enhance={() => {
              pendingSlug = t.slug;
              return async ({ update }) => {
                await update();
                pendingSlug = null;
              };
            }}
          >
            <input type="hidden" name="slug" value={t.slug} />
            <button type="submit" class="bt bt-pri" disabled={pendingSlug === t.slug}>
              {pendingSlug === t.slug ? "Sending…" : "Send test"}
            </button>
          </form>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .warn-banner {
    margin-bottom: 1.5rem;
    padding: 0.85rem 1.1rem;
    background: #fff5d8;
    border: 1px solid #d4be7c;
    border-radius: var(--radius);
    color: #6a5a3a;
    font-size: 0.9rem;
  }
  .warn-banner code {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: rgba(0, 0, 0, 0.04);
    padding: 0 0.3em;
    border-radius: 3px;
  }

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

  .form-error, .form-ok {
    padding: 0.65rem 1rem;
    border-radius: var(--radius);
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .form-error { background: #f9e0d4; color: var(--error); border: 1px solid var(--error); }
  .form-ok { background: #dceadd; color: var(--accent); border: 1px solid var(--accent); }
  code { font-family: var(--font-mono); font-size: 0.9em; }

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
  .mono { font-family: var(--font-mono); font-size: 0.85em; }
  .subject-cell { color: var(--ink-soft); }
  .actions-cell { text-align: right; white-space: nowrap; }
  .audience-pill {
    display: inline-block;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-family: var(--font-mono);
    text-transform: uppercase;
  }
  .au-admin { background: #e1ebf2; color: #406480; }
  .au-community { background: #f1ede0; color: var(--muted); }

  .check-col {
    width: 32px;
    text-align: center;
  }
  .check-col input[type="checkbox"] {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
  }
  .rows tr.tested td:not(.check-col) {
    opacity: 0.55;
  }
  .meta {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--muted);
    margin: 0.5rem 0 0;
    line-height: 1.5;
  }
  .meta strong { color: var(--accent); }

  .bt {
    display: inline-block;
    padding: 0.35rem 0.85rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    text-decoration: none;
    font-size: 0.85rem;
    cursor: pointer;
    font-family: var(--font-body);
  }
  .bt:hover { border-color: var(--accent); color: var(--accent); }
  .bt-pri { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); color: white; }
  .bt[disabled] { opacity: 0.5; cursor: wait; }
</style>
