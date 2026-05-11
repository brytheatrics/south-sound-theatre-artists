<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PageData } from "./$types";

  let { data, form }: { data: PageData; form: any } = $props();

  let noteBody = $state("");
  let busy = $state(false);

  function fmt(iso: string): string {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const STATUSES = [
    { value: "new", label: "New" },
    { value: "in_progress", label: "In progress" },
    { value: "resolved", label: "Resolved" },
    { value: "spam", label: "Spam" },
  ];
</script>

<svelte:head>
  <title>Contact submission - Admin</title>
</svelte:head>

<main>
  <p class="back"><a href="/admin/contact">← All submissions</a></p>

  <header>
    <span class="kind kind-{data.sub.status}">{data.sub.status.replace("_", " ")}</span>
    <span class="cat">{data.category_label}</span>
    <span class="when">{fmt(data.sub.created_at)}</span>
  </header>

  <h1>{data.sub.name}</h1>
  <p class="meta">
    <a href={`mailto:${data.sub.email}`}>{data.sub.email}</a>
  </p>

  <article class="message">
    <p>{data.sub.message}</p>
  </article>

  <section class="routing">
    <h3>Routed to</h3>
    <p>
      Primary: <code>{data.routing.primary ?? "(none)"}</code><br />
      CC: {data.routing.cc.length > 0 ? data.routing.cc.map((c: string) => `<code>${c}</code>`).join(", ") : "(none)"}
    </p>
  </section>

  <section class="status-form">
    <h3>Status</h3>
    {#if form?.statusSet}<p class="form-ok">Status set to {form.statusSet.replace("_", " ")}.</p>{/if}
    <form method="POST" action="?/setStatus" use:enhance={() => { busy = true; return async ({ update }) => { await update(); busy = false; }; }}>
      <div class="status-buttons">
        {#each STATUSES as s (s.value)}
          <button class="bt" type="submit" name="status" value={s.value} disabled={busy} class:on={data.sub.status === s.value}>
            {s.label}
          </button>
        {/each}
      </div>
    </form>
  </section>

  <section class="notes-section">
    <h3>Notes</h3>
    {#if Array.isArray(data.sub.notes) && data.sub.notes.length > 0}
      <ul class="notes">
        {#each data.sub.notes as n, i (i)}
          <li>
            <div class="note-head">
              <strong>{n.author}</strong>
              <span class="when">{fmt(n.created_at)}</span>
            </div>
            <p>{n.body}</p>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">No notes yet.</p>
    {/if}

    {#if form?.noteAdded}<p class="form-ok">Note added.</p>{/if}
    {#if form?.error}<p class="form-err">{form.error}</p>{/if}
    <form method="POST" action="?/addNote" use:enhance={() => { busy = true; return async ({ update }) => { await update({ reset: false }); busy = false; if (!form?.error) noteBody = ""; }; }}>
      <label>
        <span>Add a note (visible only to admins; append-only)</span>
        <textarea name="body" rows="3" bind:value={noteBody} required></textarea>
      </label>
      <button class="bt bt-pri" type="submit" disabled={busy || !noteBody.trim()}>
        Add note
      </button>
    </form>
  </section>
</main>

<style>
  main { max-width: 720px; margin: 0 auto; padding: 2rem var(--page-pad-x); }
  .back a { color: var(--accent); text-decoration: none; font-size: 13px; }
  .back a:hover { text-decoration: underline; }
  header {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    flex-wrap: wrap;
    margin: 0.5rem 0 0.75rem;
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
  h1 { font-family: var(--font-display); font-size: 1.75rem; margin: 0 0 0.25rem; }
  .meta { color: var(--ink-soft); font-size: 14px; margin: 0 0 1.5rem; }
  .meta a { color: var(--accent); }
  .message {
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
    margin-bottom: 1.75rem;
  }
  .message p { margin: 0; white-space: pre-wrap; line-height: 1.55; font-size: 14.5px; }

  section { margin-bottom: 1.75rem; }
  h3 {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 0.75rem;
  }
  .routing p { margin: 0; font-size: 14px; color: var(--ink-soft); }
  .routing code { font-family: var(--font-mono); font-size: 12.5px; }

  .status-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .bt {
    font: inherit;
    padding: 0.5rem 1rem;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid var(--rule);
    background: var(--bg-raised);
    color: var(--ink);
  }
  .bt:hover { border-color: var(--accent); }
  .bt.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .bt-pri { background: var(--ink); color: var(--bg); border-color: var(--ink); margin-top: 0.5rem; }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); }
  .bt[disabled] { opacity: 0.6; cursor: progress; }

  .notes { list-style: none; padding: 0; margin: 0 0 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .notes li {
    background: var(--bg-raised);
    border: 1px solid var(--rule-soft);
    border-radius: var(--radius);
    padding: 0.6rem 0.9rem;
  }
  .note-head {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.25rem;
  }
  .notes p { margin: 0; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; }
  .empty { color: var(--muted); font-style: italic; }
  label { display: flex; flex-direction: column; gap: 0.4rem; }
  label span { font-size: 13px; color: var(--ink-soft); }
  textarea { font: inherit; padding: 0.55rem 0.7rem; border: 1px solid var(--rule); border-radius: var(--radius); background: var(--bg-raised); color: var(--ink); }
  .form-ok { color: var(--accent); font-size: 13px; }
  .form-err { color: var(--warn); font-size: 13px; }
</style>
