<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";

  let { data, form } = $props();
  let busy = $state<string | null>(null);
  let pendingRemove = $state<{ id: string; email: string } | null>(null);

  function fmtDate(iso: string | null): string {
    if (!iso) return "never";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<svelte:head>
  <title>Admins - SSTA admin</title>
</svelte:head>

<header class="head">
  <span class="eyebrow"><span class="num">·</span>Settings</span>
  <h1 class="h1-display">Admins</h1>
  <p class="lede">
    {#if data.isOwner}
      Owners can invite co-admins. Invitees set their own password from
      a one-time link, then sign in with email + password.
    {:else}
      You can sign in and use admin tools, but only the owner can add or
      remove other admins.
    {/if}
  </p>
</header>

{#if form?.error}
  <div class="form-error" role="alert">{form.error}</div>
{/if}
{#if form?.removed}
  <div class="form-ok" role="status">Removed admin.</div>
{/if}
{#if form?.invite}
  <div class="form-ok" role="status">
    <p><strong>Invite link for {form.invite.email}:</strong></p>
    <code class="link">{form.invite.url}</code>
    <p class="link-meta">
      Send this to the invitee. The link expires in 7 days. They click it,
      set a password, then sign in at /admin/login with their email +
      that password.
    </p>
  </div>
{/if}

{#if data.isOwner}
  <section class="invite">
    <h2 class="block-h">Invite a new admin</h2>
    <form
      method="POST"
      action="?/invite"
      use:enhance={() => { busy = "invite"; return async ({ update }) => { await update(); busy = null; }; }}
    >
      <label class="f">
        <span>Email</span>
        <input type="email" name="email" required placeholder="cohort@example.com" />
      </label>
      <label class="f">
        <span>Display name (optional)</span>
        <input type="text" name="name" placeholder="Co Hort" />
      </label>
      <button type="submit" class="bt bt-pri" disabled={busy === "invite"}>
        Generate invite link
      </button>
    </form>
  </section>
{/if}

<section>
  <h2 class="block-h">Active admins</h2>
  {#if data.admins.length === 0}
    <p class="empty">No admin rows yet. Owner gets bootstrapped on the next env-credentialed login.</p>
  {:else}
    <table class="admins">
      <thead>
        <tr>
          <th>Email</th>
          <th>Name</th>
          <th>Role</th>
          <th>Last login</th>
          <th>Status</th>
          {#if data.isOwner}<th>Actions</th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each data.admins as a (a.id)}
          <tr>
            <td data-label="Email" class="mono">{a.email}</td>
            <td data-label="Name">{a.name ?? "—"}</td>
            <td data-label="Role" class="role">{a.role}</td>
            <td data-label="Last login" class="mono">{fmtDate(a.last_login_at)}</td>
            <td data-label="Status">
              {#if !a.password_set_at}
                <span class="pending">Invited - hasn't set password</span>
              {:else}
                Active
              {/if}
            </td>
            {#if data.isOwner}
              <td data-label="Actions">
                {#if a.role === "owner"}
                  <span class="muted">Owner</span>
                {:else}
                  <button
                    type="button"
                    class="bt-link warn"
                    onclick={() => (pendingRemove = { id: a.id, email: a.email })}
                  >
                    Remove
                  </button>
                {/if}
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

{#if pendingRemove}
  <form
    method="POST"
    action="?/remove"
    use:enhance={() => { busy = "remove"; return async ({ update }) => { await update(); busy = null; }; }}
    id="remove-form"
    style="display:none"
  >
    <input type="hidden" name="id" value={pendingRemove.id} />
  </form>
{/if}

<ConfirmModal
  open={pendingRemove !== null}
  title={`Remove ${pendingRemove?.email}?`}
  body="The admin loses access immediately. Their sessions and trusted devices are wiped."
  confirmLabel="Remove"
  variant="warn"
  onConfirm={() => {
    document.getElementById("remove-form")?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    pendingRemove = null;
  }}
  onClose={() => (pendingRemove = null)}
/>

<style>
  .head { display: flex; flex-direction: column; gap: 6px; margin-bottom: 1.5rem; }
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
  .h1-display {
    margin: 0;
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.02em;
  }
  .lede {
    margin: 0;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
    line-height: 1.55;
  }
  .form-error, .form-ok {
    margin: 0 0 1rem;
    padding: 10px 14px;
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
  }
  .form-error { background: #fbe6e3; color: var(--warn); border: 1px solid var(--warn); }
  .form-ok { background: #dceadd; color: var(--accent); border: 1px solid var(--accent); }
  .form-ok .link {
    display: inline-block;
    margin: 6px 0;
    padding: 6px 8px;
    background: var(--bg);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink);
    user-select: all;
    word-break: break-all;
  }
  .form-ok .link-meta {
    margin: 6px 0 0;
    font-family: var(--font-body);
    font-size: 13px;
  }
  .invite {
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
    background: var(--bg-raised);
    margin-bottom: 1.5rem;
  }
  .block-h {
    margin: 0 0 0.75rem;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    font-weight: 500;
  }
  .invite form { display: flex; flex-direction: column; gap: 8px; }
  .f { display: flex; flex-direction: column; gap: 4px; }
  .f span {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .f input {
    padding: 8px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg);
    color: var(--ink);
  }
  .bt {
    align-self: flex-start;
    padding: 9px 18px;
    border-radius: var(--radius);
    border: 1px solid transparent;
    font-family: var(--font-body);
    font-size: 14px;
    cursor: pointer;
  }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:disabled { opacity: 0.5; cursor: progress; }
  .empty {
    margin: 0;
    padding: 12px 14px;
    border: 1px dashed var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
  }
  table.admins {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-body);
    font-size: 14px;
  }
  table.admins th, table.admins td {
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid var(--rule);
    vertical-align: middle;
  }
  table.admins th {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    font-weight: 500;
  }
  .mono { font-family: var(--font-mono); font-size: 12px; }
  .role { text-transform: uppercase; font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft); }
  .pending { color: var(--warn); font-size: 12px; }
  .muted { color: var(--muted); font-size: 12px; }
  .bt-link {
    background: transparent;
    border: 0;
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 13px;
    cursor: pointer;
    text-decoration: underline;
  }
  .bt-link.warn { color: var(--warn); }
  @media (max-width: 720px) {
    table.admins thead { display: none; }
    table.admins tr {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 0;
      border-bottom: 1px solid var(--rule);
    }
    table.admins td {
      border-bottom: 0;
      padding: 2px 0;
    }
    table.admins td::before {
      content: attr(data-label) ": ";
      font-family: var(--font-mono);
      font-size: 10px;
      text-transform: uppercase;
      color: var(--muted);
      margin-right: 6px;
    }
  }
</style>
