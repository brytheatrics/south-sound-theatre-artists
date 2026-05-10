<script lang="ts">
  // Multi-resume editor (mig 078). Shown on /edit/[token] (artist
  // self-edit via magic link) and /admin/profiles/[id]/edit (admin
  // override). The two contexts pass different `apiBase` props; the
  // component is auth-agnostic.
  //
  // State is owned by the component and reflected from the API after
  // every mutation. The server returns the full snapshot { resumes,
  // entries } on every call so we never have to reconcile by id.

  import ConfirmModal from "$lib/components/ConfirmModal.svelte";

  type ResumeEntryKind = "credit" | "training" | "skill";
  type ResumeEntrySource = "hand" | "production" | "admin";

  type ResumeRow = {
    id: string;
    profile_id: string;
    name: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
  };

  type ResumeEntryRow = {
    id: string;
    profile_id: string;
    kind: ResumeEntryKind;
    data: Record<string, string | undefined>;
    source: ResumeEntrySource;
    production_credit_id: string | null;
    resume_ids: string[];
    sort_order: number;
    created_at: string;
    updated_at: string;
  };

  type Snapshot = { resumes: ResumeRow[]; entries: ResumeEntryRow[] };

  type Props = {
    initial: Snapshot;
    apiBase: string; // e.g. "/api/edit/{token}" or "/api/admin/profiles/{id}"
  };

  let { initial, apiBase }: Props = $props();

  // svelte-ignore state_referenced_locally
  let resumes = $state<ResumeRow[]>(initial.resumes);
  // svelte-ignore state_referenced_locally
  let entries = $state<ResumeEntryRow[]>(initial.entries);
  let busy = $state(false);
  let errMsg = $state<string | null>(null);

  // View filter: "all", "inbox", or a specific resume id.
  let view = $state<string>("all");

  // Inline new-resume input.
  let newResumeName = $state("");
  let addingResume = $state(false);

  // Renaming state: id of the resume currently being renamed inline.
  let renamingResume = $state<string | null>(null);
  let renameDraft = $state("");

  // Pending confirm modals.
  let pendingDeleteResume = $state<ResumeRow | null>(null);
  let pendingDeleteEntry = $state<ResumeEntryRow | null>(null);
  let pendingDetachEntry = $state<ResumeEntryRow | null>(null);

  const entriesForView = $derived.by(() => {
    return entries.filter((e) => {
      if (view === "all") return true;
      if (view === "inbox") return e.resume_ids.length === 0;
      return e.resume_ids.includes(view);
    });
  });

  const inboxCount = $derived(entries.filter((e) => e.resume_ids.length === 0).length);

  const credits = $derived(
    entriesForView.filter((e) => e.kind === "credit").sort((a, b) => a.sort_order - b.sort_order),
  );
  const training = $derived(
    entriesForView.filter((e) => e.kind === "training").sort((a, b) => a.sort_order - b.sort_order),
  );
  const skills = $derived(
    entriesForView.filter((e) => e.kind === "skill").sort((a, b) => a.sort_order - b.sort_order),
  );

  async function api(method: string, path: string, body?: unknown): Promise<void> {
    busy = true;
    errMsg = null;
    try {
      const res = await fetch(`${apiBase}${path}`, {
        method,
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        try {
          const j = JSON.parse(text) as { message?: string };
          throw new Error(j.message ?? text);
        } catch {
          throw new Error(text || `Request failed (${res.status})`);
        }
      }
      const snap = (await res.json()) as Snapshot;
      resumes = snap.resumes;
      entries = snap.entries;
    } catch (err) {
      errMsg = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  async function createResume() {
    const name = newResumeName.trim();
    if (!name) return;
    await api("POST", "/resumes", { name });
    newResumeName = "";
    addingResume = false;
  }

  async function commitRename(id: string) {
    const name = renameDraft.trim();
    if (!name) {
      renamingResume = null;
      return;
    }
    await api("PATCH", `/resumes/${id}`, { name });
    renamingResume = null;
  }

  async function deleteResume(id: string) {
    await api("DELETE", `/resumes/${id}`);
    if (view === id) view = "all";
  }

  async function addEntry(kind: ResumeEntryKind) {
    // New entries default to assignment on the currently-viewed resume
    // (so the artist sees what they just added) unless viewing all/inbox.
    const assignTo = view === "all" || view === "inbox" ? [] : [view];
    const data =
      kind === "credit"
        ? { show: "", role: "", company: "", director: "", year: "", notes: "" }
        : kind === "training"
        ? { title: "", institution: "", year: "", notes: "" }
        : { category: "", items: "" };
    await api("POST", "/entries", { kind, data, resume_ids: assignTo });
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingPatches: Map<string, Record<string, string>> = $state(new Map());

  function scheduleSave(entryId: string, field: string, value: string) {
    const cur = pendingPatches.get(entryId) ?? {};
    pendingPatches.set(entryId, { ...cur, [field]: value });
    pendingPatches = new Map(pendingPatches); // trigger reactivity
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSaves, 500);
  }

  async function flushSaves() {
    saveTimer = null;
    const batches = Array.from(pendingPatches.entries());
    pendingPatches = new Map();
    for (const [id, patch] of batches) {
      const entry = entries.find((e) => e.id === id);
      if (!entry) continue;
      const merged = { ...entry.data, ...patch };
      await api("PATCH", `/entries/${id}`, { data: merged });
    }
  }

  async function toggleAssignment(entryId: string, resumeId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const next = entry.resume_ids.includes(resumeId)
      ? entry.resume_ids.filter((r) => r !== resumeId)
      : [...entry.resume_ids, resumeId];
    await api("PATCH", `/entries/${entryId}`, { resume_ids: next });
  }

  async function reorderEntry(entryId: string, dir: -1 | 1) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const sameKind = entries
      .filter((e) => e.kind === entry.kind)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = sameKind.findIndex((e) => e.id === entryId);
    const swap = sameKind[idx + dir];
    if (!swap) return;
    // Swap the sort_order values. Two PATCHes; second one returns the
    // fresh snapshot so the UI ends up consistent.
    await api("PATCH", `/entries/${entryId}`, { sort_order: swap.sort_order });
    await api("PATCH", `/entries/${swap.id}`, { sort_order: entry.sort_order });
  }

  async function deleteEntry(id: string) {
    await api("DELETE", `/entries/${id}`);
  }

  async function detachEntry(id: string) {
    await api("PATCH", `/entries/${id}`, { detach: true });
  }

  function getField(e: ResumeEntryRow, key: string): string {
    const pending = pendingPatches.get(e.id)?.[key];
    if (pending !== undefined) return pending;
    return (e.data?.[key] ?? "") as string;
  }
</script>

<div class="mrb">
  <!-- ===== Resumes header ===== -->
  <section class="resumes-bar">
    <div class="resumes-head">
      <span class="eyebrow">Your resumes</span>
      {#if !addingResume}
        <button type="button" class="add-mini" onclick={() => (addingResume = true)}>
          + Add resume
        </button>
      {/if}
    </div>

    <div class="resume-tabs">
      <button
        type="button"
        class="tab"
        class:active={view === "all"}
        onclick={() => (view = "all")}
      >
        All entries <span class="count">({entries.length})</span>
      </button>
      <button
        type="button"
        class="tab inbox"
        class:active={view === "inbox"}
        class:empty={inboxCount === 0}
        onclick={() => (view = "inbox")}
        title="Production credits land here when an org or admin tags you. Click to assign each one to your resumes."
      >
        Inbox <span class="count">({inboxCount})</span>
      </button>
      {#each resumes as r (r.id)}
        <div class="tab-wrap" class:active={view === r.id}>
          {#if renamingResume === r.id}
            <input
              type="text"
              class="rename-input"
              bind:value={renameDraft}
              onblur={() => commitRename(r.id)}
              onkeydown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                if (e.key === "Escape") (renamingResume = null);
              }}
            />
          {:else}
            <button
              type="button"
              class="tab"
              class:active={view === r.id}
              onclick={() => (view = r.id)}
            >
              {r.name}
              <span class="count">
                ({entries.filter((e) => e.resume_ids.includes(r.id)).length})
              </span>
            </button>
            <button
              type="button"
              class="tab-edit"
              title="Rename"
              aria-label={`Rename ${r.name}`}
              onclick={() => {
                renameDraft = r.name;
                renamingResume = r.id;
              }}
            >
              ✎
            </button>
            {#if resumes.length > 1}
              <button
                type="button"
                class="tab-edit warn"
                title="Delete"
                aria-label={`Delete ${r.name}`}
                onclick={() => (pendingDeleteResume = r)}
              >
                ×
              </button>
            {/if}
          {/if}
        </div>
      {/each}
    </div>

    {#if addingResume}
      <div class="new-resume">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          placeholder="e.g. Director Resume"
          bind:value={newResumeName}
          autofocus
          onkeydown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              createResume();
            }
            if (e.key === "Escape") {
              addingResume = false;
              newResumeName = "";
            }
          }}
        />
        <button type="button" class="bt" onclick={createResume} disabled={!newResumeName.trim() || busy}>
          Create
        </button>
        <button
          type="button"
          class="bt ghost"
          onclick={() => {
            addingResume = false;
            newResumeName = "";
          }}
        >
          Cancel
        </button>
      </div>
    {/if}
  </section>

  {#if errMsg}
    <p class="err">{errMsg}</p>
  {/if}

  {#if view === "inbox" && inboxCount === 0}
    <p class="empty">Nothing in your inbox right now. New production credits land here for you to assign.</p>
  {/if}

  <!-- ===== Credits ===== -->
  <details class="section collapsible-section">
    <summary class="sec-head">
      <h3 class="sec-title">Theatre credits <span class="sec-count">({credits.length})</span></h3>
      <button
        type="button"
        class="add"
        onclick={(e) => { e.preventDefault(); e.stopPropagation(); addEntry("credit"); }}
        disabled={busy}
      >
        + Add credit
      </button>
    </summary>
    {#if credits.length === 0}
      <p class="empty">
        {#if view === "all"}No credits yet.
        {:else if view === "inbox"}No credits in your inbox.
        {:else}No credits on this resume yet.
        {/if}
      </p>
    {:else}
      <ul class="rows">
        {#each credits as c (c.id)}
          <li class="row" class:linked={c.source === "production"}>
            <div class="row-header">
              <div class="row-tags">
                {#if c.source === "production"}
                  <span class="tag linked">🔗 Linked credit</span>
                {/if}
                {#if c.resume_ids.length === 0}
                  <span class="tag inbox">📥 Inbox</span>
                {/if}
              </div>
              <div class="row-actions">
                <button type="button" class="ctl" onclick={() => reorderEntry(c.id, -1)} title="Move up">↑</button>
                <button type="button" class="ctl" onclick={() => reorderEntry(c.id, 1)} title="Move down">↓</button>
                {#if c.source === "production"}
                  <button type="button" class="ctl" title="Detach (lets you edit)" onclick={() => (pendingDetachEntry = c)}>⛓</button>
                {/if}
                <button type="button" class="ctl warn" title="Remove" onclick={() => (pendingDeleteEntry = c)}>×</button>
              </div>
            </div>
            <div class="row-fields">
              <label class="f">
                <span>Show</span>
                <input
                  type="text"
                  value={getField(c, "show")}
                  disabled={c.source === "production"}
                  oninput={(e) => scheduleSave(c.id, "show", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="King Lear"
                />
              </label>
              <label class="f">
                <span>Role / position</span>
                <input
                  type="text"
                  value={getField(c, "role")}
                  disabled={c.source === "production"}
                  oninput={(e) => scheduleSave(c.id, "role", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="Cordelia / Director / Lighting Designer"
                />
              </label>
              <label class="f">
                <span>Company</span>
                <input
                  type="text"
                  value={getField(c, "company")}
                  disabled={c.source === "production"}
                  oninput={(e) => scheduleSave(c.id, "company", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="Tacoma Little Theatre"
                />
              </label>
              <label class="f">
                <span>Director (if applicable)</span>
                <input
                  type="text"
                  value={getField(c, "director")}
                  disabled={c.source === "production"}
                  oninput={(e) => scheduleSave(c.id, "director", (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
              <label class="f short">
                <span>Year</span>
                <input
                  type="text"
                  value={getField(c, "year")}
                  disabled={c.source === "production"}
                  oninput={(e) => scheduleSave(c.id, "year", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="2024"
                />
              </label>
              <label class="f wide">
                <span>Notes (optional)</span>
                <input
                  type="text"
                  value={getField(c, "notes")}
                  disabled={c.source === "production"}
                  oninput={(e) => scheduleSave(c.id, "notes", (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
            </div>
            {#if resumes.length > 0}
              <div class="assign-bar">
                <span class="assign-label">
                  {c.resume_ids.length === 0 ? "Click a resume to add this credit:" : "On resumes:"}
                </span>
                {#each resumes as r (r.id)}
                  <button
                    type="button"
                    class="chip"
                    class:on={c.resume_ids.includes(r.id)}
                    onclick={() => toggleAssignment(c.id, r.id)}
                    disabled={busy}
                  >
                    {c.resume_ids.includes(r.id) ? "✓ " : "+ "}{r.name}
                  </button>
                {/each}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </details>

  <!-- ===== Training ===== -->
  <details class="section collapsible-section" open>
    <summary class="sec-head">
      <h3 class="sec-title">Training <span class="sec-count">({training.length})</span></h3>
      <button
        type="button"
        class="add"
        onclick={(e) => { e.preventDefault(); e.stopPropagation(); addEntry("training"); }}
        disabled={busy}
      >
        + Add training
      </button>
    </summary>
    {#if training.length === 0}
      <p class="empty">No training in this view.</p>
    {:else}
      <ul class="rows">
        {#each training as t (t.id)}
          <li class="row">
            <div class="row-header">
              <div class="row-tags">
                {#if t.resume_ids.length === 0}<span class="tag inbox">📥 Inbox</span>{/if}
              </div>
              <div class="row-actions">
                <button type="button" class="ctl" onclick={() => reorderEntry(t.id, -1)} title="Move up">↑</button>
                <button type="button" class="ctl" onclick={() => reorderEntry(t.id, 1)} title="Move down">↓</button>
                <button type="button" class="ctl warn" title="Remove" onclick={() => (pendingDeleteEntry = t)}>×</button>
              </div>
            </div>
            <div class="row-fields">
              <label class="f">
                <span>Title / program</span>
                <input
                  type="text"
                  value={getField(t, "title")}
                  oninput={(e) => scheduleSave(t.id, "title", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="BFA in Acting"
                />
              </label>
              <label class="f">
                <span>Institution</span>
                <input
                  type="text"
                  value={getField(t, "institution")}
                  oninput={(e) => scheduleSave(t.id, "institution", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="Cornish College of the Arts"
                />
              </label>
              <label class="f short">
                <span>Year</span>
                <input
                  type="text"
                  value={getField(t, "year")}
                  oninput={(e) => scheduleSave(t.id, "year", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="2018"
                />
              </label>
              <label class="f wide">
                <span>Notes (optional)</span>
                <input
                  type="text"
                  value={getField(t, "notes")}
                  oninput={(e) => scheduleSave(t.id, "notes", (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
            </div>
            {#if resumes.length > 0}
              <div class="assign-bar">
                <span class="assign-label">
                  {t.resume_ids.length === 0 ? "Click a resume to add this entry:" : "On resumes:"}
                </span>
                {#each resumes as r (r.id)}
                  <button
                    type="button"
                    class="chip"
                    class:on={t.resume_ids.includes(r.id)}
                    onclick={() => toggleAssignment(t.id, r.id)}
                    disabled={busy}
                  >
                    {t.resume_ids.includes(r.id) ? "✓ " : "+ "}{r.name}
                  </button>
                {/each}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </details>

  <!-- ===== Skills ===== -->
  <details class="section collapsible-section" open>
    <summary class="sec-head">
      <h3 class="sec-title">Skills <span class="sec-count">({skills.length})</span></h3>
      <button
        type="button"
        class="add"
        onclick={(e) => { e.preventDefault(); e.stopPropagation(); addEntry("skill"); }}
        disabled={busy}
      >
        + Add group
      </button>
    </summary>
    {#if skills.length === 0}
      <p class="empty">No skills in this view. Group by category - dialects, instruments, certifications, etc.</p>
    {:else}
      <ul class="rows">
        {#each skills as s (s.id)}
          <li class="row">
            <div class="row-header">
              <div class="row-tags">
                {#if s.resume_ids.length === 0}<span class="tag inbox">📥 Inbox</span>{/if}
              </div>
              <div class="row-actions">
                <button type="button" class="ctl" onclick={() => reorderEntry(s.id, -1)} title="Move up">↑</button>
                <button type="button" class="ctl" onclick={() => reorderEntry(s.id, 1)} title="Move down">↓</button>
                <button type="button" class="ctl warn" title="Remove" onclick={() => (pendingDeleteEntry = s)}>×</button>
              </div>
            </div>
            <div class="row-fields">
              <label class="f">
                <span>Category</span>
                <input
                  type="text"
                  value={getField(s, "category")}
                  oninput={(e) => scheduleSave(s.id, "category", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="Dialects"
                />
              </label>
              <label class="f wide">
                <span>Items (comma-separated)</span>
                <input
                  type="text"
                  value={getField(s, "items")}
                  oninput={(e) => scheduleSave(s.id, "items", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="RP, Cockney, Standard American"
                />
              </label>
            </div>
            {#if resumes.length > 0}
              <div class="assign-bar">
                <span class="assign-label">
                  {s.resume_ids.length === 0 ? "Click a resume to add this skill:" : "On resumes:"}
                </span>
                {#each resumes as r (r.id)}
                  <button
                    type="button"
                    class="chip"
                    class:on={s.resume_ids.includes(r.id)}
                    onclick={() => toggleAssignment(s.id, r.id)}
                    disabled={busy}
                  >
                    {s.resume_ids.includes(r.id) ? "✓ " : "+ "}{r.name}
                  </button>
                {/each}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </details>
</div>

<ConfirmModal
  open={pendingDeleteResume !== null}
  title={`Delete "${pendingDeleteResume?.name}"?`}
  body="The resume itself goes away. Entries currently on it move to your inbox - they're not deleted."
  confirmLabel="Delete resume"
  variant="warn"
  onConfirm={async () => {
    const id = pendingDeleteResume!.id;
    pendingDeleteResume = null;
    await deleteResume(id);
  }}
  onClose={() => (pendingDeleteResume = null)}
/>

<ConfirmModal
  open={pendingDeleteEntry !== null}
  title="Remove this entry?"
  body="The row is removed from your resume(s). For credits linked to a production, the underlying production tag stays - this just hides the row from your resume."
  confirmLabel="Remove"
  variant="warn"
  onConfirm={async () => {
    const id = pendingDeleteEntry!.id;
    pendingDeleteEntry = null;
    await deleteEntry(id);
  }}
  onClose={() => (pendingDeleteEntry = null)}
/>

<ConfirmModal
  open={pendingDetachEntry !== null}
  title="Detach this credit from the production?"
  body="The row stays on your resume but you'll be able to free-edit the fields. The production tag stops auto-updating."
  confirmLabel="Detach"
  onConfirm={async () => {
    const id = pendingDetachEntry!.id;
    pendingDetachEntry = null;
    await detachEntry(id);
  }}
  onClose={() => (pendingDetachEntry = null)}
/>

<style>
  .mrb {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .resumes-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .resumes-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    font-weight: 500;
  }
  .add-mini {
    background: transparent;
    border: 1px solid var(--rule);
    color: var(--ink);
    padding: 4px 10px;
    font-family: var(--font-body);
    font-size: 12px;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .add-mini:hover {
    border-color: var(--ink);
  }
  .resume-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tab-wrap {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .tab-wrap.active {
    border-color: var(--accent);
  }
  .tab {
    background: transparent;
    border: 1px solid var(--rule);
    color: var(--ink);
    padding: 6px 12px;
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius);
    cursor: pointer;
    line-height: 1.2;
  }
  .tab-wrap .tab {
    border: 0;
    border-radius: 0;
  }
  .tab.active,
  .tab-wrap.active .tab {
    background: var(--ink);
    color: var(--bg);
  }
  .tab.inbox {
    border-style: dashed;
  }
  /* Empty inbox: visible but understated so the artist sees the
     feature exists ("oh, that's where new credits land") without
     it screaming for attention. */
  .tab.inbox.empty {
    color: var(--muted);
    border-color: var(--rule-soft);
  }
  .tab.inbox.empty:hover {
    color: var(--ink);
    border-color: var(--rule);
  }
  .tab .count {
    font-family: var(--font-mono);
    font-size: 11px;
    opacity: 0.7;
  }
  .tab-edit {
    background: transparent;
    border: 0;
    border-left: 1px solid var(--rule);
    color: var(--ink-soft);
    padding: 0 8px;
    cursor: pointer;
    font-size: 12px;
  }
  .tab-edit:hover {
    color: var(--ink);
  }
  .tab-edit.warn {
    color: var(--warn);
  }
  .rename-input {
    padding: 6px 10px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--bg);
    color: var(--ink);
  }
  .new-resume {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .new-resume input {
    flex: 1 1 200px;
    min-width: 0;
    padding: 6px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--bg);
    color: var(--ink);
  }
  .new-resume input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .bt {
    padding: 6px 14px;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    background: var(--ink);
    color: var(--bg);
    font-family: var(--font-body);
    font-size: 13px;
    cursor: pointer;
  }
  .bt.ghost {
    background: transparent;
    color: var(--ink);
  }
  .bt:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .err {
    margin: 0;
    padding: 10px 14px;
    border: 1px solid var(--warn);
    border-radius: var(--radius);
    background: rgba(180, 70, 50, 0.08);
    color: var(--warn);
    font-family: var(--font-body);
    font-size: 13px;
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sec-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .sec-title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    font-weight: 500;
  }
  /* Each kind-section (Theatre credits / Training / Skills) is its
     own collapsible. Default-open. The summary doubles as the section
     heading; clicking anywhere except the + Add button toggles it. */
  .collapsible-section > summary {
    list-style: none;
    cursor: pointer;
  }
  .collapsible-section > summary::-webkit-details-marker { display: none; }
  .collapsible-section > summary .sec-title::after {
    content: "▼";
    margin-left: 0.5em;
    color: var(--accent);
    font-size: 0.85em;
    display: inline-block;
    transition: transform 120ms;
  }
  .collapsible-section[open] > summary .sec-title::after { transform: rotate(180deg); }
  .sec-count {
    color: var(--muted);
    font-weight: 400;
    margin-left: 0.3em;
  }
  .add {
    background: transparent;
    border: 1px solid var(--rule);
    color: var(--ink);
    padding: 6px 12px;
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .add:hover:not(:disabled) {
    border-color: var(--ink);
  }
  .empty {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    padding: 12px 14px;
    border: 1px dashed var(--rule);
    border-radius: var(--radius);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .row.linked {
    border-color: var(--accent);
    background: rgba(0, 0, 0, 0.02);
  }
  .row-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .row-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tag {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 3px 8px;
    border-radius: var(--radius);
    border: 1px solid var(--rule);
    color: var(--muted);
  }
  .tag.linked {
    color: var(--accent);
    border-color: var(--accent);
  }
  .tag.inbox {
    color: var(--ink-soft);
    border-style: dashed;
  }
  .row-actions {
    display: flex;
    gap: 4px;
  }
  .ctl {
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid var(--rule);
    background: transparent;
    border-radius: var(--radius);
    cursor: pointer;
    color: var(--ink-soft);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .ctl:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .ctl.warn {
    color: var(--warn);
    font-size: 16px;
  }
  .row-fields {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px 12px;
    min-width: 0;
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .f.short {
    grid-column: span 1;
  }
  .f.wide {
    grid-column: span 2;
  }
  .f span {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .f input {
    padding: 7px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--bg);
    color: var(--ink);
    min-width: 0;
  }
  .f input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .f input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .assign-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding-top: 6px;
    border-top: 1px dashed var(--rule);
  }
  .assign-label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .chip {
    background: transparent;
    border: 1px solid var(--rule);
    color: var(--ink-soft);
    padding: 3px 10px;
    font-family: var(--font-body);
    font-size: 12px;
    border-radius: 999px;
    cursor: pointer;
  }
  .chip.on {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  .chip:hover:not(:disabled) {
    border-color: var(--ink);
  }
  @media (max-width: 600px) {
    .row-fields {
      grid-template-columns: 1fr;
    }
    .f.short,
    .f.wide {
      grid-column: span 1;
    }
  }
</style>
