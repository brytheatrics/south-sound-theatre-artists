<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let busy = $state<string | null>(null);
  let pickValue = $state("");

  // Filter out already-featured from the picker
  const featuredIds = $derived(new Set(data.featured.map((f) => f.profile_id)));
  const available = $derived(data.candidates.filter((c) => !featuredIds.has(c.id)));
</script>

<svelte:head><title>Featured profiles - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · featured</span>
  <h1 class="h1-display">Featured profiles.</h1>
  <p class="lede">
    The homepage spotlight rotates through this list. Empty list = random
    pool from all published profiles.
  </p>
</header>

<form method="POST" action="?/add" class="add-form" use:enhance={() => { busy = "add"; return async ({ update }) => { await update({ reset: true }); pickValue = ""; busy = null; }; }}>
  <label class="field">
    <span>Add a profile</span>
    <select name="profile_id" bind:value={pickValue} required>
      <option value="">Pick one</option>
      {#each available as c (c.id)}
        <option value={c.id}>{c.full_name} - {c.disciplines.slice(0, 2).join(", ")}</option>
      {/each}
    </select>
  </label>
  <button type="submit" class="bt bt-pri" disabled={busy === "add" || !pickValue}>
    {busy === "add" ? "Adding..." : "Add to featured"}
  </button>
</form>

{#if form?.error}<div class="form-error" role="alert">{form.error}</div>{/if}
{#if form?.added}<div class="form-ok" role="status">Added {form.added}.</div>{/if}

{#if data.featured.length === 0}
  <p class="empty">No featured profiles yet. Homepage uses date-seeded random.</p>
{:else}
  <ul class="rows">
    {#each data.featured as f (f.id)}
      {@const profile = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles}
      <li class="row">
        <span class="name">
          {profile?.full_name ?? "(removed)"}
          {#if profile?.disciplines}<span class="meta">{profile.disciplines.slice(0, 2).join(" · ")}</span>{/if}
        </span>
        <div class="actions">
          <form method="POST" action="?/toggle" use:enhance={() => { busy = f.id; return async ({ update }) => { await update(); busy = null; }; }}>
            <input type="hidden" name="id" value={f.id} />
            <input type="hidden" name="active" value={(!f.active).toString()} />
            <button type="submit" class="pill" class:on={f.active} disabled={busy === f.id}>
              {f.active ? "Active" : "Paused"}
            </button>
          </form>
          <form method="POST" action="?/remove" use:enhance={() => { busy = f.id; return async ({ update }) => { await update(); busy = null; }; }}>
            <input type="hidden" name="id" value={f.id} />
            <button type="submit" class="bt-link warn" disabled={busy === f.id}>Remove</button>
          </form>
        </div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 800px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 16px; color: var(--muted); margin: 0 0 1rem; }
  .add-form { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; padding: 1rem; background: var(--paper); border-radius: var(--radius-lg); margin-bottom: 1rem; }
  .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .field span { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .field select { padding: 8px 12px; border: 1px solid var(--rule); border-radius: var(--radius); font-family: var(--font-body); font-size: 14px; background: var(--bg-raised); width: 100%; max-width: 100%; }
  .field select:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
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
  .name { font-family: var(--font-display); font-weight: 600; font-size: 15px; color: var(--ink); }
  .meta { color: var(--muted); font-size: 13px; margin-left: 10px; font-weight: normal; font-family: var(--font-body); }
  .actions { display: flex; gap: 8px; align-items: center; }
  .pill { background: var(--paper); border: 1px solid var(--rule); padding: 4px 10px; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); cursor: pointer; border-radius: 100px; }
  .pill:hover { border-color: var(--ink); color: var(--ink); }
  .pill.on { background: var(--accent); color: #fff; border-color: var(--accent); }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--ink-soft); }
  .bt-link.warn { color: var(--error); }
  .bt-link:hover { text-decoration: underline; }

  @media (max-width: 720px) {
    .add-form { grid-template-columns: 1fr; }
  }
</style>
