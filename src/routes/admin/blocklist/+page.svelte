<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let busy = $state(false);
  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
</script>

<svelte:head><title>Blocklist - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · blocklist</span>
  <h1 class="h1-display">Email blocklist.</h1>
  <p class="lede">
    {data.entries.length} blocked. The contact form silently succeeds for
    these senders.
  </p>
</header>

<form method="POST" action="?/add" class="add-form" use:enhance={() => { busy = true; return async ({ update }) => { await update({ reset: true }); busy = false; }; }}>
  <label class="field">
    <span>Email</span>
    <input type="email" name="email" required placeholder="abuse@example.com" />
  </label>
  <label class="field">
    <span>Note (optional)</span>
    <input type="text" name="note" placeholder="why are they blocked?" />
  </label>
  <button type="submit" class="bt bt-pri" disabled={busy}>
    {busy ? "Blocking..." : "Add to blocklist"}
  </button>
</form>

{#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
{#if form?.added}<div class="form-ok" role="status">Blocked {form.added}.</div>{/if}

{#if data.entries.length === 0}
  <p class="empty">Nothing blocked.</p>
{:else}
  <ul class="rows">
    {#each data.entries as e (e.id)}
      <li class="row">
        <div>
          <span class="email">{e.email}</span>
          {#if e.note}<span class="note">- {e.note}</span>{/if}
          <span class="when">added {fmt(e.created_at)}</span>
        </div>
        <form method="POST" action="?/remove" use:enhance>
          <input type="hidden" name="id" value={e.id} />
          <button type="submit" class="bt-link">Remove</button>
        </form>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 800px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 18px; color: var(--muted); margin: 0 0 1rem; }
  .add-form {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 8px;
    align-items: end;
    margin-bottom: 1rem;
    padding: 1rem;
    background: var(--paper);
    border-radius: var(--radius-lg);
  }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field span { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .field input { padding: 8px 12px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-body); font-size: 14px; background: var(--bg-raised); }
  .field input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  .bt { font-family: var(--font-body); font-size: 14px; padding: 9px 16px; border-radius: var(--radius); border: 1px solid transparent; cursor: pointer; }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt:disabled { opacity: 0.5; cursor: progress; }
  .form-error { background: color-mix(in oklch, var(--error), var(--bg) 80%); border: 1px solid var(--error); color: var(--error); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .form-ok { background: color-mix(in oklch, var(--accent), var(--bg) 85%); border: 1px solid var(--accent); color: var(--accent); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 1rem; }
  .empty { color: var(--muted); font-family: var(--font-accent); font-style: italic; padding: 2rem 0; text-align: center; }
  .rows { list-style: none; margin: 0; padding: 0; border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--rule-soft); background: var(--bg-raised); gap: 1rem; }
  .row:last-child { border-bottom: 0; }
  .email { font-family: var(--font-mono); font-size: 13px; color: var(--ink); margin-right: 10px; }
  .note { color: var(--ink-soft); font-size: 13px; margin-right: 10px; }
  .when { color: var(--muted); font-size: 12px; font-family: var(--font-mono); }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-size: 13px; color: var(--error); }
  .bt-link:hover { text-decoration: underline; }

  @media (max-width: 720px) {
    .add-form { grid-template-columns: 1fr; }
  }
</style>
