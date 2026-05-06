<script lang="ts">
  // Shared form for /admin/callboard/new and /admin/callboard/[id]/edit.
  // Both pages own their own server-side load + action; this component
  // is pure presentation.

  type Mode = "new" | "edit";

  type PostInitial = {
    post_type?: string;
    title?: string;
    organization_name?: string;
    area_id?: string | null;
    location?: string | null;
    description?: string | null;
    roles?: string[] | null;
    compensation_type?: string | null;
    compensation?: string | null;
    contact_info?: string | null;
    deadline_text?: string | null;
    expires_at?: string | null;
    ticket_url?: string | null;
    status?: string;
    published?: boolean;
  };

  type Props = {
    mode: Mode;
    actionUrl: string;
    initial: PostInitial;
    areas: Array<{ id: string; name: string }>;
    postTypes: Array<{ slug: string; label: string }>;
    formErrors?: Record<string, string>;
  };

  let { mode, actionUrl, initial, areas, postTypes, formErrors = {} }: Props = $props();

  // Mirror the picked radio values in $state so we can drive class:on
  // directly. CSS-only :has(input:checked) styling has a Chrome
  // invalidation issue where the matching label doesn't repaint when
  // the radio's :checked flips - explicit JS state sidesteps it.
  /* svelte-ignore state_referenced_locally */
  let pickedAreaId = $state<string>(initial.area_id ?? "");
  /* svelte-ignore state_referenced_locally */
  let pickedPostType = $state<string>(initial.post_type ?? "");

  // Convert ISO timestamp -> "YYYY-MM-DDTHH:MM" for <input type="datetime-local">.
  function toLocalInput(iso: string | null | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }
</script>

<form method="POST" action={actionUrl} class="form">
  {#if formErrors._form}
    <p class="form-error" role="alert">{formErrors._form}</p>
  {/if}

  <div class="row-2">
    <label class="field">
      <span>Title <span class="req">*</span></span>
      <input name="title" type="text" required value={initial.title ?? ""} />
      {#if formErrors.title}<p class="field-error">{formErrors.title}</p>{/if}
    </label>
    <label class="field">
      <span>Organization <span class="req">*</span></span>
      <input name="organization_name" type="text" required value={initial.organization_name ?? ""} />
      {#if formErrors.organization_name}<p class="field-error">{formErrors.organization_name}</p>{/if}
    </label>
  </div>

  <div class="field">
    <span class="label">Area <span class="req">*</span></span>
    <div class="chip-row">
      {#each areas as a (a.id)}
        <label class="chip" class:on={pickedAreaId === a.id}>
          <input
            type="radio"
            name="area_id"
            value={a.id}
            checked={pickedAreaId === a.id}
            onchange={() => (pickedAreaId = a.id)}
            required
          />
          <span>{a.name}</span>
        </label>
      {/each}
    </div>
    {#if formErrors.area_id}<p class="field-error">{formErrors.area_id}</p>{/if}
  </div>

  <label class="field">
    <span>Venue / address</span>
    <input
      name="location"
      type="text"
      value={initial.location ?? ""}
      placeholder="Tacoma Little Theatre, 210 N I St..."
    />
    <span class="hint">
      Optional. The area picker above is what the digest filters use; this
      shows up on the post for visitors as the venue / specific address.
    </span>
  </label>

  <div class="field">
    <span class="label">Post type <span class="req">*</span></span>
    <div class="chip-row">
      {#each postTypes as t (t.slug)}
        <label class="chip" class:on={pickedPostType === t.slug}>
          <input
            type="radio"
            name="post_type"
            value={t.slug}
            checked={pickedPostType === t.slug}
            onchange={() => (pickedPostType = t.slug)}
            required
          />
          <span>{t.label}</span>
        </label>
      {/each}
    </div>
    {#if formErrors.post_type}<p class="field-error">{formErrors.post_type}</p>{/if}
  </div>

  <label class="field">
    <span>Description <span class="req">*</span></span>
    <textarea name="description" rows="6" required>{initial.description ?? ""}</textarea>
    {#if formErrors.description}<p class="field-error">{formErrors.description}</p>{/if}
  </label>

  <label class="field">
    <span>Roles / positions</span>
    <textarea
      name="roles"
      rows="3"
      placeholder="One per line, or comma-separated"
    >{(initial.roles ?? []).join("\n")}</textarea>
    <span class="hint">
      Up to 20. Used by the discipline filter on the digest.
    </span>
  </label>

  <div class="row-2">
    <label class="field">
      <span>Compensation type</span>
      <select name="compensation_type" value={initial.compensation_type ?? ""}>
        <option value="">— pick —</option>
        <option value="paid">Paid</option>
        <option value="stipend">Stipend</option>
        <option value="volunteer">Volunteer</option>
        <option value="none">Unspecified</option>
      </select>
      {#if formErrors.compensation_type}<p class="field-error">{formErrors.compensation_type}</p>{/if}
    </label>
    <label class="field">
      <span>Compensation detail</span>
      <input
        name="compensation"
        type="text"
        value={initial.compensation ?? ""}
        placeholder="$500 stipend, free housing, etc."
      />
    </label>
  </div>

  <label class="field">
    <span>Contact info</span>
    <textarea name="contact_info" rows="3">{initial.contact_info ?? ""}</textarea>
    <span class="hint">
      Free text. Email, phone, link to a sign-up form - whatever the
      poster wants visitors to do.
    </span>
  </label>

  <div class="row-2">
    <label class="field">
      <span>Deadline (display text)</span>
      <input
        name="deadline_text"
        type="text"
        value={initial.deadline_text ?? ""}
        placeholder="Sign up by May 5"
      />
      <span class="hint">Free text shown on the card.</span>
    </label>
    <label class="field">
      <span>Auto-unpublish at</span>
      <input
        name="expires_at"
        type="datetime-local"
        value={toLocalInput(initial.expires_at)}
      />
      {#if formErrors.expires_at}<p class="field-error">{formErrors.expires_at}</p>{/if}
      <span class="hint">When this passes, the post drops off the public callboard.</span>
    </label>
  </div>

  <label class="field">
    <span>Ticket / sign-up URL</span>
    <input
      name="ticket_url"
      type="url"
      value={initial.ticket_url ?? ""}
      placeholder="https://..."
    />
    {#if formErrors.ticket_url}<p class="field-error">{formErrors.ticket_url}</p>{/if}
  </label>

  {#if mode === "edit"}
    <div class="row-2">
      <label class="field">
        <span>Status</span>
        <select name="status" value={initial.status ?? "approved"}>
          <option value="pending_email">Pending email verify</option>
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {#if formErrors.status}<p class="field-error">{formErrors.status}</p>{/if}
      </label>
      <label class="field check-field">
        <input type="checkbox" name="published" checked={initial.published === true} />
        <span class="check-label">Published (visible on /callboard)</span>
      </label>
    </div>
  {:else}
    <label class="field check-field">
      <input type="checkbox" name="published" checked={initial.published !== false} />
      <span class="check-label">Publish immediately</span>
    </label>
  {/if}

  <div class="actions">
    <button type="submit" class="bt bt-pri">
      {mode === "new" ? "Create post" : "Save changes"}
    </button>
  </div>
</form>

<style>
  .form { display: flex; flex-direction: column; gap: 1rem; max-width: 720px; }
  .form-error {
    background: color-mix(in oklch, var(--warn), var(--bg) 80%);
    border: 1px solid var(--warn);
    color: var(--warn);
    padding: 0.65rem 0.9rem;
    border-radius: var(--radius);
    margin: 0;
    font-size: 14px;
  }
  .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 640px) {
    .row-2 { grid-template-columns: 1fr; }
  }

  .field { display: flex; flex-direction: column; gap: 6px; }
  .field > span,
  .field .label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .req { color: var(--accent); }
  .hint {
    font-family: var(--font-body) !important;
    font-size: 12px !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
    color: var(--muted);
    line-height: 1.45;
  }
  .field-error { font-size: 12px; color: var(--warn); margin: 0; }

  input[type="text"], input[type="url"], input[type="datetime-local"], select, textarea {
    padding: 9px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg-raised);
    color: var(--ink);
  }
  textarea { resize: vertical; line-height: 1.5; }
  select { cursor: pointer; }
  input:focus, select:focus, textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }

  .chip-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chip {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 0.35rem 0.85rem;
    font-size: 13px;
    color: var(--ink-soft);
    background: transparent;
    cursor: pointer;
    user-select: none;
    transition: border-color 0.12s, background 0.12s, color 0.12s;
  }
  .chip:hover { border-color: var(--ink); color: var(--ink); }
  /* "Selected" treatment driven by Svelte $state via class:on. Pure-CSS
     :has(input:checked) was unreliable in Chrome - the matching label
     reports as matching the selector but the cascade doesn't repaint
     it on radio toggle. The .chip-row anchor + !important also bumps
     specificity past the global .chip rule in app.css. */
  .chip-row .chip.on {
    background: var(--ink) !important;
    color: var(--bg);
    border-color: var(--ink);
  }
  .chip input[type="radio"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 1px;
    height: 1px;
  }

  .check-field { flex-direction: row; align-items: center; gap: 8px; }
  .check-field input[type="checkbox"] { accent-color: var(--accent); }
  .check-label {
    font-family: var(--font-body) !important;
    font-size: 14px !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
    color: var(--ink) !important;
  }

  .actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 11px 22px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
  }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover { background: var(--accent); }
</style>
