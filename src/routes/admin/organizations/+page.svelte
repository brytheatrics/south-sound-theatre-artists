<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  let { data, form } = $props();
  let busy = $state<string | null>(null);
  let savingId = $state<string | null>(null);

  let pendingDeleteForm = $state<HTMLFormElement | null>(null);
  let pendingDeleteName = $state("");
  function askDelete(e: MouseEvent, name: string) {
    pendingDeleteForm = (e.currentTarget as HTMLElement).closest("form");
    pendingDeleteName = name;
  }
  function cancelDelete() { pendingDeleteForm = null; pendingDeleteName = ""; }
  function confirmDelete() { pendingDeleteForm?.requestSubmit(); cancelDelete(); }

  // Logo background swatches. Hex values are FIXED - they don't follow
  // the dark-mode toggle, since the whole point of the choice is to
  // contrast with the logo's foreground.
  const LOGO_BG_OPTIONS: Array<{ value: string; label: string; hex: string }> = [
    { value: "paper", label: "Paper", hex: "#f1ede0" },
    { value: "paper-2", label: "Cream", hex: "#ebe5d3" },
    { value: "bg-raised", label: "White", hex: "#ffffff" },
    { value: "ink", label: "Ink", hex: "#0e0d0c" },
    { value: "accent", label: "Moss", hex: "#3b6f4a" },
  ];

  let logoBgs = $state<Record<string, string>>({});
  function getLogoBg(s: { id: string; logo_bg: string }): string {
    return logoBgs[s.id] ?? s.logo_bg ?? "paper";
  }

  let logoUrls = $state<Record<string, string>>({});
  let uploadingId = $state<string | null>(null);
  let uploadProgress = $state(0);
  let uploadError = $state<string | null>(null);

  function getLogoValue(s: { id: string; logo_url: string | null }): string {
    return logoUrls[s.id] ?? s.logo_url ?? "";
  }

  async function uploadLogo(id: string, file: File) {
    uploadingId = id;
    uploadProgress = 0;
    uploadError = null;
    try {
      const sigResp = await fetch("/api/cloudinary/sign-logo", { method: "POST" });
      if (!sigResp.ok) throw new Error("Could not start the upload.");
      const sig = await sigResp.json();

      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.api_key);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);
      fd.append("transformation", sig.transformation);

      const result = await xhrUpload(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
        fd,
        (pct) => (uploadProgress = pct),
      );
      if (!result.secure_url) throw new Error("Upload finished but no URL came back.");
      logoUrls = { ...logoUrls, [id]: result.secure_url };
    } catch (err) {
      uploadError = err instanceof Error ? err.message : "Upload failed.";
    } finally {
      uploadingId = null;
      uploadProgress = 0;
    }
  }

  function xhrUpload(
    url: string,
    body: FormData,
    onProgress: (pct: number) => void,
  ): Promise<{ secure_url: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(res);
          else reject(new Error(res?.error?.message || `Upload failed (${xhr.status}).`));
        } catch {
          reject(new Error("Upload failed: response could not be read."));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed: network error."));
      xhr.send(body);
    });
  }

  function onLogoFileChange(id: string, e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) uploadLogo(id, file);
    (e.target as HTMLInputElement).value = "";
  }

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

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function statusClass(status: string | null): string {
    return status ? `st-${status}` : "st-pending";
  }

  function statusLabel(status: string | null): string {
    switch (status) {
      case "ok": return "Updated";
      case "unchanged": return "No changes";
      case "empty": return "Nothing found";
      case "error": return "Pull failed";
      case "manual": return "Manual entry";
      default: return "Not yet pulled";
    }
  }
</script>

{#snippet publicEdit(s: { id: string; slug: string; description: string | null; homepage_url: string | null; logo_url: string | null; logo_bg: string })}
  <details class="public-edit">
    <summary>Edit public details — description, homepage, logo</summary>
    <form
      method="POST"
      action="?/updatePublic"
      class="public-edit-form"
      use:enhance={() => {
        savingId = s.id;
        return async ({ update }) => {
          await update({ reset: false });
          savingId = null;
        };
      }}
    >
      <input type="hidden" name="id" value={s.id} />
      <label class="pe-field">
        <span class="pe-label">Description</span>
        <textarea
          name="description"
          rows="2"
          maxlength="500"
          placeholder="1-2 sentence description, shown on the public Theatres page"
          value={s.description ?? ""}
        ></textarea>
      </label>
      <label class="pe-field">
        <span class="pe-label">Homepage URL</span>
        <input
          name="homepage_url"
          type="url"
          placeholder="https://..."
          value={s.homepage_url ?? ""}
        />
      </label>
      <label class="pe-field">
        <span class="pe-label">Logo</span>
        <div class="pe-logo-row">
          <input
            name="logo_url"
            type="url"
            placeholder="Paste a URL or upload a file →"
            value={getLogoValue(s)}
            oninput={(e) => (logoUrls = { ...logoUrls, [s.id]: (e.target as HTMLInputElement).value })}
          />
          <label class="pe-upload-btn" class:disabled={uploadingId === s.id}>
            {uploadingId === s.id ? `Uploading… ${uploadProgress}%` : "Upload"}
            <input
              type="file"
              accept="image/*"
              onchange={(e) => onLogoFileChange(s.id, e)}
              disabled={uploadingId === s.id}
            />
          </label>
          {#if getLogoValue(s)}
            <div
              class="pe-logo-preview-tile"
              style:background={LOGO_BG_OPTIONS.find((o) => o.value === getLogoBg(s))?.hex ?? "#f1ede0"}
            >
              <img class="pe-logo-preview" src={getLogoValue(s)} alt="" />
            </div>
          {/if}
        </div>
        {#if uploadingId === s.id}
          <div class="pe-progress">
            <div class="pe-progress-fill" style:width="{uploadProgress}%"></div>
          </div>
        {/if}
        <span class="pe-logo-hint">
          PNG files with transparent backgrounds look best. Files get auto-resized.
          {#if uploadError}<span class="pe-error">{uploadError}</span>{/if}
        </span>
      </label>

      <fieldset class="pe-bg-field">
        <legend class="pe-label">Logo background</legend>
        <p class="pe-bg-hint">
          Pick a tile colour that makes the logo readable. White logos
          need a dark tile (Ink or Moss); black or coloured logos usually
          look best on Paper, Cream, or White.
        </p>
        <div class="pe-swatches">
          {#each LOGO_BG_OPTIONS as opt (opt.value)}
            <label
              class="pe-swatch"
              class:on={getLogoBg(s) === opt.value}
              style:background={opt.hex}
              title={opt.label}
            >
              <input
                type="radio"
                name="logo_bg"
                value={opt.value}
                checked={getLogoBg(s) === opt.value}
                onchange={() => (logoBgs = { ...logoBgs, [s.id]: opt.value })}
              />
              <span class="pe-swatch-label">{opt.label}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <div class="pe-actions">
        <button type="submit" class="bt bt-pri" disabled={savingId === s.id}>
          {savingId === s.id ? "Saving..." : "Save public details"}
        </button>
      </div>
    </form>
  </details>
{/snippet}

<svelte:head>
  <title>Organizations - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · organizations</span>
  <h1 class="h1-display">Organizations.</h1>
  <p class="lede">
    Every theatre we list. The site automatically pulls upcoming shows
    from {data.autoSources.length} of them on the 1st of each month.
    The other {data.manualSources.length} you add by hand because their
    site doesn't list shows in a way we can read automatically. Verified
    orgs ({data.verifiedOrgs.length}) can post to the callboard and
    submit performances directly without per-post admin review.
  </p>
  <div class="hd-actions">
    <a class="bt bt-pri" href="/admin/organizations/new">+ Add organization</a>
  </div>
</header>

{#if data.justCreated}
  <div class="form-ok" role="status">
    Added <strong>{data.justCreated}</strong> as a manual entry. Click
    "Edit public details" on its row below to upload a logo + tweak
    homepage / description. Once Blake verifies the source page is
    scrape-friendly, flip the adapter to "ai-generic" via the Try
    auto-pull button.
  </div>
{/if}

{#if form?.error}
  <div class="form-error" role="alert">{form.error}</div>
{/if}
{#if form?.refreshed}
  <div class="form-ok" role="status">
    Pulled fresh from <strong>{form.refreshed}</strong>:
    {form.result?.showCount} {form.result?.showCount === 1 ? "show" : "shows"},
    {form.result?.performanceCount} {form.result?.performanceCount === 1 ? "performance" : "performances"}.
  </div>
{/if}
{#if form?.savedPublic}
  <div class="form-ok" role="status">
    Saved public details for <strong>{form.savedPublic}</strong>.
  </div>
{/if}
{#if form?.activeSet}
  <div class="form-ok" role="status">
    <strong>{form.activeSet.slug}</strong> is now {form.activeSet.active ? "active" : "disabled"}.
  </div>
{/if}
{#if form?.adapterSet}
  <div class="form-ok" role="status">
    <strong>{form.adapterSet.slug}</strong> is now
    {form.adapterSet.adapter === "manual"
      ? "set to manual entry."
      : "set to automatic pull."}
  </div>
{/if}
{#if form?.verified}
  <div class="form-ok" role="status">
    Verified {form.verified} organization{form.verified !== 1 ? "s" : ""}.
  </div>
{/if}
{#if form?.revoked}
  <div class="form-ok" role="status">
    Revoked verification for {form.revoked}.
  </div>
{/if}
{#if form?.deleted}
  <div class="form-ok" role="status">
    Deleted {form.deleted}.
  </div>
{/if}

<!-- PENDING VERIFICATION: applications via /callboard/apply-verified
     that haven't been verified yet. Shown at the top so they're hard
     to miss. -->
{#if data.pendingVerification.length > 0}
  <h2 class="section-h">
    Pending verification <span class="section-count">{data.pendingVerification.length}</span>
  </h2>
  <p class="section-help">
    Theatres that applied for verified status. Once verified, their
    callboard posts and calendar submissions skip the per-post review queue.
  </p>
  <table class="rows">
    <thead>
      <tr>
        <th>Organization</th>
        <th>Applied</th>
        <th class="actions-col">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.pendingVerification as org (org.id)}
        <tr>
          <td data-label="Organization">
            <div class="org-name">{org.name}</div>
            <div class="org-email">{org.contact_email}</div>
            {#if org.homepage_url}
              <div class="org-web"><a href={org.homepage_url} target="_blank" rel="noopener" class="ext-link">{org.homepage_url}</a></div>
            {/if}
            {#if org.description}
              <div class="org-desc">{org.description.slice(0, 120)}{org.description.length > 120 ? "…" : ""}</div>
            {/if}
          </td>
          <td data-label="Applied" class="mono-cell">{fmtDate(org.created_at)}</td>
          <td data-label="Actions" class="actions-col">
            <form method="POST" action="?/approveVerification" use:enhance={() => { busy = org.id; return async ({ update }) => { await update(); busy = null; }; }} style="display:inline">
              <input type="hidden" name="id" value={org.id} />
              <button type="submit" class="bt-link" disabled={busy === org.id}>Verify</button>
            </form>
            <form method="POST" action="?/softDelete" use:enhance={() => { busy = org.id; return async ({ update }) => { await update(); busy = null; }; }} style="display:inline">
              <input type="hidden" name="id" value={org.id} />
              <button type="button" class="bt-link warn" disabled={busy === org.id} onclick={(e) => askDelete(e, org.name)}>Delete</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<!-- VERIFIED ORGS: orgs with verified=true. Compact summary - operations
     happen at the row level (revoke / delete) and the auto-pull config
     for the same org is in the section below. -->
{#if data.verifiedOrgs.length > 0}
  <h2 class="section-h">
    Verified <span class="section-count">{data.verifiedOrgs.length}</span>
  </h2>
  <p class="section-help">
    These orgs can post to the callboard and submit performances using
    their verified email address; their submissions skip per-post review.
  </p>
  <table class="rows">
    <thead>
      <tr>
        <th>Organization</th>
        <th>Verified email</th>
        <th class="actions-col">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.verifiedOrgs as org (org.id)}
        <tr>
          <td data-label="Organization">
            <div class="org-name">
              {org.name}
              <span class="verified-badge" title="Verified">&#10003;</span>
            </div>
          </td>
          <td data-label="Verified email" class="mono-cell">{org.contact_email ?? "—"}</td>
          <td data-label="Actions" class="actions-col">
            <form method="POST" action="?/revokeVerification" use:enhance={() => { busy = org.id; return async ({ update }) => { await update(); busy = null; }; }} style="display:inline">
              <input type="hidden" name="id" value={org.id} />
              <button type="submit" class="bt-link warn" disabled={busy === org.id}>Revoke</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<h2 class="section-h">
  Pulled automatically <span class="section-count">{data.autoSources.length}</span>
</h2>
<p class="section-help">
  Theatres whose shows we read automatically. Once a month the site
  visits each one's website, finds upcoming shows, and adds them to
  the calendar. Edit a theatre's public details, trigger a one-off
  pull, or disable a theatre that's giving us junk.
</p>

<div class="src-list">
  {#each data.autoSources as s (s.id)}
    <article class="src-row src-row-wrap" class:inactive={!s.active}>
      <div class="src-name">
        <h3>{s.name}</h3>
        <code class="src-slug">{s.slug}</code>
        {#if s.area_name}<span class="src-area">{s.area_name}</span>{/if}
        <span class="verify-pill" class:verified={s.verified}>
          {s.verified ? "Verified" : "Unverified"}
        </span>
      </div>

      <div class="src-status">
        <span class="status-pill {statusClass(s.last_status)}">{statusLabel(s.last_status)}</span>
        <span class="status-meta">
          {s.last_show_count ?? 0} {s.last_show_count === 1 ? "show" : "shows"}
          · last checked {fmtRel(s.last_checked_at)}
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
        <a class="bt bt-ghost" href={`/admin/calendar/new?org=${s.slug}`} title="Add a one-off show the auto-pull missed - skips the cron and saves directly to the calendar.">+ Add show</a>
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
            {busy === s.id ? "Pulling..." : "Pull now"}
          </button>
        </form>
        <form method="POST" action="?/setActive" use:enhance>
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="active" value={(!s.active).toString()} />
          <button
            type="submit"
            class="bt bt-ghost"
            title={s.active
              ? "Disable - we stop pulling new shows from this theatre."
              : "Re-enable - start pulling new shows on the next monthly sync."}
          >
            {s.active ? "Disable" : "Enable"}
          </button>
        </form>
        <form method="POST" action="?/setAdapter" use:enhance>
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="adapter" value="manual" />
          <button type="submit" class="bt bt-ghost" title="Switch to adding shows by hand.">
            Add by hand
          </button>
        </form>
      </div>
      {@render publicEdit(s)}
    </article>
  {/each}
</div>

<h2 class="section-h section-manual">
  Added by hand <span class="section-count">{data.manualSources.length}</span>
</h2>
<p class="section-help">
  These theatres post their schedule somewhere we can't read automatically.
  Click the link in each card to see what's running, then use
  <a href="/admin/calendar/new">+ Add show</a> to enter it.
</p>

<div class="src-list">
  {#each data.manualSources as s (s.id)}
    <article class="src-row src-manual">
      <div class="src-name">
        <h3>{s.name}</h3>
        <code class="src-slug">{s.slug}</code>
        {#if s.area_name}<span class="src-area">{s.area_name}</span>{/if}
        <span class="verify-pill" class:verified={s.verified}>
          {s.verified ? "Verified" : "Unverified"}
        </span>
      </div>

      <div class="src-status">
        <span class="status-pill st-manual">Added by hand</span>
      </div>

      <div class="src-url">
        {#if s.source_url}
          <a href={s.source_url} target="_blank" rel="noopener">{s.source_url}</a>
        {/if}
        {#if s.notes}
          <div class="src-notes">{s.notes}</div>
        {/if}
      </div>

      <div class="src-actions">
        <a class="bt bt-ghost" href={`/admin/calendar/new?org=${s.slug}`}>+ Add show</a>
        <form method="POST" action="?/setActive" use:enhance>
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="active" value={(!s.active).toString()} />
          <button type="submit" class="bt bt-ghost" title={s.active ? "Hide from /theatres." : "Show again."}>
            {s.active ? "Disable" : "Enable"}
          </button>
        </form>
        <form method="POST" action="?/setAdapter" use:enhance>
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="adapter" value="ai-generic" />
          <button type="submit" class="bt bt-ghost" title="Try pulling automatically again on the next monthly sync.">
            Try auto-pull
          </button>
        </form>
      </div>
      {@render publicEdit(s)}
    </article>
  {/each}
</div>

<ConfirmModal
  open={pendingDeleteForm !== null}
  title="Delete organization?"
  body={`${pendingDeleteName} will be removed. This cannot be easily undone.`}
  confirmLabel="Delete"
  variant="warn"
  onConfirm={confirmDelete}
  onClose={cancelDelete}
/>

<style>
  .hd { margin-bottom: 1.5rem; }
  .hd-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
  .hd-actions .bt-pri {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 9px 16px;
    border-radius: var(--radius);
    background: var(--ink);
    color: var(--bg);
    border: 1px solid var(--ink);
    text-decoration: none;
  }
  .hd-actions .bt-pri:hover { background: var(--accent); border-color: var(--accent); }
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
  .h1-display {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 600;
    margin: 0 0 0.5rem;
  }
  .lede { color: var(--ink-soft); max-width: 60ch; margin: 0; }
  code {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background: var(--paper-2);
    padding: 0 0.3em;
    border-radius: 3px;
  }
  .form-error, .form-ok {
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .form-error { background: #f9e0d4; color: var(--error); border: 1px solid var(--error); }
  .form-ok { background: #dceadd; color: var(--accent); border: 1px solid var(--accent); }

  .section-h {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    margin: 1.5rem 0 0.5rem;
    color: var(--ink);
  }
  .section-h:first-of-type { margin-top: 0.5rem; }
  .section-manual { color: var(--muted); }
  .section-count {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0 0.5rem;
    background: var(--paper-2);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted);
    vertical-align: middle;
  }
  .section-help {
    color: var(--ink-soft);
    font-size: 0.88rem;
    margin: 0 0 1rem;
    max-width: 60ch;
  }

  /* Verified-org tables (pending + verified sections) */
  .rows { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 13px; margin-bottom: 1.5rem; }
  th { text-align: left; padding: 10px 12px; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); border-bottom: 1px solid var(--rule); font-weight: 500; }
  td { padding: 12px; border-bottom: 1px solid var(--rule-soft); vertical-align: top; }
  .org-name { font-weight: 500; color: var(--ink); display: flex; align-items: center; gap: 6px; }
  .org-email { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .org-web { font-size: 12px; margin-top: 2px; }
  .ext-link { color: var(--accent); }
  .org-desc { font-size: 12px; color: var(--ink-soft); margin-top: 4px; line-height: 1.4; }
  .verified-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 14px; height: 14px; border-radius: 50%;
    background: var(--accent); color: #fff; font-size: 9px; font-weight: 700;
  }
  .mono-cell { font-family: var(--font-mono); font-size: 11px; color: var(--muted); white-space: nowrap; }
  .actions-col { text-align: right; width: 1%; white-space: nowrap; }
  .bt-link { background: none; border: 0; padding: 6px 10px; cursor: pointer; font-family: var(--font-body); font-size: 13px; color: var(--ink-soft); text-decoration: none; display: inline-block; }
  .bt-link.warn { color: var(--error); }
  .bt-link:hover { text-decoration: underline; color: var(--ink); }
  .bt-link:disabled { opacity: 0.4; cursor: not-allowed; }

  .src-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
  .src-row.src-manual { background: var(--paper); border-style: dashed; }
  .src-area { margin-left: 0.5rem; font-size: 0.7rem; color: var(--muted); background: var(--paper-2); padding: 0.05rem 0.4rem; border-radius: 999px; }
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
  .src-row.inactive { opacity: 0.55; }
  .src-name h3 {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.2rem;
    color: var(--ink);
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .src-slug { font-size: 0.75rem; color: var(--muted); }

  /* Verified / Unverified pill - lives next to the area chip in the
     row header so admins can audit verification status at a glance.
     Default (unverified) reads as a neutral chip; .verified swaps to
     the moss-on-cream treatment used elsewhere on the page. */
  .verify-pill {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.05rem 0.55rem;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: var(--paper-2);
    color: var(--muted);
    border: 1px solid var(--rule);
    line-height: 1.6;
    vertical-align: middle;
  }
  .verify-pill.verified {
    background: color-mix(in oklch, var(--accent), var(--bg) 85%);
    color: var(--accent);
    border-color: var(--accent);
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
  .status-pill.st-ok { background: #dceadd; color: var(--accent); }
  .status-pill.st-unchanged { background: var(--paper-2); color: var(--muted); }
  .status-pill.st-empty, .status-pill.st-error { background: #f9e0d4; color: var(--error); }
  .status-pill.st-manual { background: var(--paper-2); color: var(--muted); border: 1px dashed var(--rule); }
  .status-meta { display: block; font-size: 0.8rem; color: var(--muted); margin-top: 0.25rem; }
  .status-error { margin-top: 0.4rem; font-size: 0.78rem; color: var(--error); word-break: break-word; }

  .src-url a { color: var(--accent); word-break: break-all; font-size: 0.85rem; }
  .src-notes { margin-top: 0.3rem; font-size: 0.78rem; color: var(--muted); line-height: 1.4; }

  .src-actions {
    align-self: center;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 130px;
  }
  .src-actions form { display: flex; }
  .src-actions .bt-ghost, .src-actions form .bt-ghost { width: 100%; text-align: center; }

  .public-edit {
    grid-column: 1 / -1;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--rule-soft);
    font-size: 0.85rem;
  }
  .public-edit summary {
    cursor: pointer;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.25rem 0;
    list-style: revert;
  }
  .public-edit[open] summary { color: var(--ink); margin-bottom: 0.5rem; }
  .public-edit-form { display: flex; flex-direction: column; gap: 0.6rem; padding-top: 0.25rem; }
  .pe-field { display: flex; flex-direction: column; gap: 0.25rem; }
  .pe-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .pe-field input, .pe-field textarea {
    font-family: var(--font-body);
    font-size: 0.9rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--ink);
    width: 100%;
  }
  .pe-field input:focus, .pe-field textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .pe-logo-row { display: flex; gap: 0.6rem; align-items: center; }
  .pe-logo-row input { flex: 1; }
  .pe-logo-preview-tile {
    width: 44px;
    height: 44px;
    border: 1px solid var(--rule-soft);
    border-radius: var(--radius);
    padding: 3px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pe-logo-preview { max-width: 100%; max-height: 100%; object-fit: contain; }
  .pe-bg-field { margin: 0; padding: 0; border: 0; }
  .pe-bg-hint { margin: 0.2rem 0 0.5rem; font-size: 0.75rem; color: var(--muted); line-height: 1.4; }
  .pe-swatches { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .pe-swatch {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 38px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
  }
  .pe-swatch:hover { border-color: var(--ink); }
  .pe-swatch.on { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent), transparent 70%); }
  .pe-swatch input[type="radio"] { position: absolute; opacity: 0; pointer-events: none; }
  .pe-swatch-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #5e5b56;
    background: rgba(255, 255, 255, 0.85);
    padding: 1px 4px;
    border-radius: 2px;
  }
  .pe-upload-btn {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.45rem 0.85rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
    min-width: 90px;
  }
  .pe-upload-btn:hover { border-color: var(--accent); color: var(--accent); }
  .pe-upload-btn.disabled { cursor: progress; opacity: 0.7; }
  .pe-upload-btn input[type="file"] { display: none; }
  .pe-progress { margin-top: 0.4rem; width: 100%; height: 3px; background: var(--paper); border-radius: 2px; overflow: hidden; }
  .pe-progress-fill { height: 100%; background: var(--accent); transition: width 0.15s; }
  .pe-logo-hint { margin-top: 0.3rem; font-size: 0.75rem; color: var(--muted); line-height: 1.4; }
  .pe-error { display: block; color: var(--error); margin-top: 0.2rem; }
  .pe-actions { display: flex; justify-content: flex-end; }

  .bt-pri {
    padding: 0.45rem 1rem;
    background: var(--ink);
    color: var(--bg);
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
  }
  .bt-pri:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); }
  .bt-pri:disabled { opacity: 0.6; cursor: progress; }
  .bt-ghost {
    padding: 0.4rem 0.85rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    font-size: 0.85rem;
    cursor: pointer;
  }
  .bt-ghost:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .bt-ghost:disabled { opacity: 0.6; cursor: not-allowed; }

  @media (max-width: 720px) {
    .src-row { grid-template-columns: 1fr; gap: 0.5rem; }
    .rows, .rows thead, .rows tbody, .rows tr, .rows td, .rows th { display: block; }
    .rows thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .rows tr { border: 1px solid var(--rule); border-radius: var(--radius); margin-bottom: 12px; padding: 12px 14px; background: var(--bg-raised); }
    .rows td { padding: 6px 0; border-bottom: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .rows td::before { content: attr(data-label); font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); flex: 0 0 auto; }
    .rows td:first-child { flex-direction: column; align-items: flex-start; gap: 2px; padding-bottom: 10px; margin-bottom: 6px; border-bottom: 1px solid var(--rule-soft); }
    .rows td:first-child::before { display: none; }
    .actions-col { text-align: left !important; width: auto !important; white-space: normal !important; }
  }
</style>
