<script lang="ts">
  import { enhance } from "$app/forms";
  let { data, form } = $props();
  let busy = $state<string | null>(null);

  function fmtDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
</script>

<svelte:head><title>Blog - SSTA admin</title></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · blog</span>
  <h1 class="h1-display">Blog posts</h1>
  <p class="lede">Native posts written in your voice. Lives at /blog publicly.</p>
  <p>
    <a class="bt bt-pri" href="/admin/blog/new">+ New post</a>
  </p>
</header>

{#if form?.deleted}<div class="form-ok">Moved to trash.</div>{/if}
{#if form?.restored}<div class="form-ok">Restored.</div>{/if}

{#if data.posts.length === 0}
  <p class="empty">No posts yet. Click "New post" to write one.</p>
{:else}
  <table class="posts">
    <thead>
      <tr>
        <th>Title</th>
        <th>Status</th>
        <th>Published</th>
        <th>Updated</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.posts as p (p.id)}
        <tr>
          <td data-label="Title">
            <a class="title-link" href={`/admin/blog/${p.id}/edit`}>{p.title || "(untitled)"}</a>
            <span class="slug-meta">/{p.slug}</span>
          </td>
          <td data-label="Status">
            {#if p.published && p.published_at && new Date(p.published_at).getTime() > Date.now()}
              <span class="pill scheduled">⏰ Scheduled</span>
            {:else if p.published}
              <span class="pill on">Published</span>
            {:else}
              <span class="pill">Draft</span>
            {/if}
          </td>
          <td data-label="Published" class="mono">{fmtDate(p.published_at)}</td>
          <td data-label="Updated" class="mono">{fmtDate(p.updated_at)}</td>
          <td data-label="Actions">
            <a class="bt-link" href={`/admin/blog/${p.id}/edit`}>Edit</a>
            ·
            {#if p.published}
              <a class="bt-link" href={`/blog/${p.slug}`} target="_blank" rel="noopener">View ↗</a>
              ·
            {/if}
            <form method="POST" action="?/softDelete" use:enhance={() => { busy = p.id; return async ({ update }) => { await update(); busy = null; }; }} style="display:inline">
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" class="bt-link warn" disabled={busy === p.id}>Trash</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

{#if data.trash.length > 0}
  <h2 class="block-h trash-h">Trash</h2>
  <table class="posts">
    <tbody>
      {#each data.trash as p (p.id)}
        <tr>
          <td data-label="Title">{p.title}</td>
          <td data-label="Actions">
            <form method="POST" action="?/restore" use:enhance={() => { busy = p.id; return async ({ update }) => { await update(); busy = null; }; }} style="display:inline">
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" class="bt-link" disabled={busy === p.id}>Restore</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 800px; margin-bottom: 2rem; }
  .eyebrow { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); display: inline-flex; gap: 8px; }
  .num { color: var(--accent); }
  .h1-display { margin: 0.5rem 0 0.25rem; font-family: var(--font-display); font-size: 32px; }
  .lede { margin: 0; font-family: var(--font-body); font-size: 15px; color: var(--ink-soft); }
  .bt { padding: 7px 14px; border-radius: var(--radius); border: 1px solid transparent; font-family: var(--font-body); font-size: 13px; cursor: pointer; text-decoration: none; }
  .bt-pri { background: var(--ink); color: var(--bg); display: inline-block; }
  .form-ok { background: #dceadd; color: var(--accent); border: 1px solid var(--accent); padding: 8px 12px; border-radius: var(--radius); margin-bottom: 1rem; font-family: var(--font-body); font-size: 13px; }
  .empty { padding: 12px 14px; border: 1px dashed var(--rule); border-radius: var(--radius); color: var(--muted); font-family: var(--font-body); }
  table.posts { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 14px; }
  table.posts th, table.posts td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--rule); vertical-align: middle; }
  table.posts th { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 500; }
  .title-link { color: var(--ink); font-weight: 600; text-decoration: none; }
  .title-link:hover { color: var(--accent); }
  .slug-meta { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
  .mono { font-family: var(--font-mono); font-size: 12px; }
  .pill { padding: 2px 8px; border: 1px solid var(--rule); border-radius: 999px; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; }
  .pill.on { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  .pill.scheduled { background: transparent; color: var(--accent); border-color: var(--accent); }
  .bt-link { background: transparent; border: 0; color: var(--ink); font-family: var(--font-body); font-size: 13px; cursor: pointer; text-decoration: underline; }
  .bt-link.warn { color: var(--warn); }
  .block-h { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .trash-h { margin-top: 2rem; }
  @media (max-width: 720px) {
    table.posts thead { display: none; }
    table.posts tr { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; border-bottom: 1px solid var(--rule); }
    table.posts td { border-bottom: 0; padding: 2px 0; }
    table.posts td::before { content: attr(data-label) ": "; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; color: var(--muted); margin-right: 6px; }
  }
</style>
