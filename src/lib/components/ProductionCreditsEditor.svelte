<script lang="ts">
  // Production credits editor (mig 079). Used on
  // /admin/calendar/[id]/credits and reused by the org self-serve
  // flow (different apiBase). Lets the admin/org rep:
  //   - Add cast / production rows individually.
  //   - Paste a cast list and parse into rows in one go.
  //   - Link/unlink each row to an artist profile via fuzzy search.
  //   - Reorder + delete rows.
  //
  // All mutations call the API and re-render from the returned snapshot.

  import ConfirmModal from "$lib/components/ConfirmModal.svelte";

  type Category = "cast" | "production";
  type Source = "org" | "artist" | "admin";

  type Credit = {
    id: string;
    production_id: string;
    profile_id: string | null;
    display_name: string;
    position: string;
    category: Category;
    source: Source;
    sort_order: number;
    created_by_email: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };

  type Snapshot = { cast: Credit[]; production: Credit[] };

  type Props = {
    initial: Snapshot;
    apiBase: string; // e.g. "/api/admin/productions/{id}"
  };

  let { initial, apiBase }: Props = $props();

  // svelte-ignore state_referenced_locally
  let credits = $state<Snapshot>(initial);
  let busy = $state(false);
  let errMsg = $state<string | null>(null);

  let pasteText = $state("");
  let pasteCategory = $state<Category>("cast");
  let pasteOpen = $state(false);

  let newCategory = $state<Category>("cast");
  let newName = $state("");
  let newPosition = $state("");
  // Type-ahead for the quick-add name input.
  let qaMatches = $state<Array<{ id: string; full_name: string }>>([]);
  let qaPickedId = $state<string | null>(null);
  let qaSearchTimer: ReturnType<typeof setTimeout> | null = null;

  let pendingDelete = $state<Credit | null>(null);

  // Match-suggestion cache, keyed by credit.id. Empty array = "no
  // candidates"; missing key = "not yet looked up".
  let matchesByCredit = $state<Map<string, Array<{ id: string; slug: string; full_name: string; score: number }>>>(new Map());
  let matchLoading = $state<Set<string>>(new Set());

  async function api(method: string, path: string, body?: unknown): Promise<Snapshot | { matches: Array<{ id: string; slug: string; full_name: string; score: number }> } | null> {
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
      const data = await res.json();
      // Snapshots have cast/production; match results have matches[].
      if (data && typeof data === "object" && "cast" in data) {
        credits = data as Snapshot;
      }
      return data;
    } catch (err) {
      errMsg = err instanceof Error ? err.message : String(err);
      return null;
    } finally {
      busy = false;
    }
  }

  async function addOne() {
    const name = newName.trim();
    const position = newPosition.trim();
    if (!name) return;
    await api("POST", "/credits", {
      display_name: name,
      position: position || (newCategory === "cast" ? "Ensemble" : "TBD"),
      category: newCategory,
      profile_id: qaPickedId,
    });
    newName = "";
    newPosition = "";
    qaPickedId = null;
    qaMatches = [];
  }

  function searchArtists(q: string) {
    qaPickedId = null;
    if (qaSearchTimer) clearTimeout(qaSearchTimer);
    if (q.trim().length < 2) {
      qaMatches = [];
      return;
    }
    qaSearchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBase}/credits/match`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: q }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { matches: Array<{ id: string; full_name: string }> };
        qaMatches = data.matches;
      } catch {
        qaMatches = [];
      }
    }, 200);
  }

  function pickQa(m: { id: string; full_name: string }) {
    newName = m.full_name;
    qaPickedId = m.id;
    qaMatches = [];
  }

  async function pasteApply() {
    const t = pasteText.trim();
    if (!t) return;
    await api("POST", "/credits", { paste: t, category: pasteCategory });
    pasteText = "";
    pasteOpen = false;
  }

  async function updatePosition(creditId: string, position: string) {
    await api("PATCH", `/credits/${creditId}`, { position });
  }

  async function setProfileLink(creditId: string, profile_id: string | null) {
    await api("PATCH", `/credits/${creditId}`, { profile_id });
  }

  async function moveCategory(creditId: string, category: Category) {
    await api("PATCH", `/credits/${creditId}`, { category });
  }

  async function deleteCredit(creditId: string) {
    await api("DELETE", `/credits/${creditId}`);
  }

  async function lookupMatches(credit: Credit) {
    if (matchLoading.has(credit.id) || matchesByCredit.has(credit.id)) return;
    matchLoading.add(credit.id);
    matchLoading = new Set(matchLoading);
    const data = (await api("POST", `/credits/match`, { name: credit.display_name })) as { matches: Array<{ id: string; slug: string; full_name: string; score: number }> } | null;
    matchLoading.delete(credit.id);
    matchLoading = new Set(matchLoading);
    matchesByCredit.set(credit.id, data?.matches ?? []);
    matchesByCredit = new Map(matchesByCredit);
  }

  function categoryLabel(c: Category) {
    return c === "cast" ? "Cast" : "Production";
  }
</script>

<div class="pce">
  {#if errMsg}<p class="err">{errMsg}</p>{/if}

  <section class="quick-add">
    <span class="eyebrow">Quick add</span>
    <div class="qa-row">
      <select bind:value={newCategory}>
        <option value="cast">Cast</option>
        <option value="production">Production</option>
      </select>
      <div class="qa-name">
        <input
          type="text"
          placeholder="Name"
          bind:value={newName}
          oninput={(e) => searchArtists((e.currentTarget as HTMLInputElement).value)}
          onkeydown={(e) => e.key === "Enter" && (e.preventDefault(), addOne())}
          autocomplete="off"
        />
        {#if qaPickedId}
          <span class="link-tag-inline">🔗 Linked</span>
        {/if}
        {#if qaMatches.length > 0 && !qaPickedId}
          <ul class="ac">
            {#each qaMatches as m (m.id)}
              <li>
                <button type="button" onclick={() => pickQa(m)}>
                  Link to <strong>{m.full_name}</strong>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <input
        type="text"
        placeholder={newCategory === "cast" ? "Role (e.g. Hamlet)" : "Position (e.g. Director)"}
        bind:value={newPosition}
        onkeydown={(e) => e.key === "Enter" && (e.preventDefault(), addOne())}
      />
      <button type="button" class="bt" onclick={addOne} disabled={!newName.trim() || busy}>Add</button>
    </div>
    <button type="button" class="ghost" onclick={() => (pasteOpen = !pasteOpen)}>
      {pasteOpen ? "Cancel paste" : "+ Paste a cast list"}
    </button>
    {#if pasteOpen}
      <div class="paste-area">
        <p class="hint">
          One person per line. Recognised formats: "Name as Role", "Name - Role",
          "Name: Role", "Role: Name", "Name, Role". Lines without a separator
          land with placeholder positions you can edit below.
        </p>
        <select bind:value={pasteCategory}>
          <option value="cast">Cast section</option>
          <option value="production">Production team</option>
        </select>
        <textarea rows="8" bind:value={pasteText} placeholder={`Sarah Jones as Cordelia\nJamie Lee - Lear\n...`}></textarea>
        <button type="button" class="bt" onclick={pasteApply} disabled={!pasteText.trim() || busy}>
          Add {pasteText.split("\n").filter((l) => l.trim()).length} rows
        </button>
      </div>
    {/if}
  </section>

  {#each ["cast", "production"] as cat (cat)}
    {@const list = credits[cat as Category]}
    <section class="cat">
      <h3 class="cat-h">{categoryLabel(cat as Category)} <span class="count">({list.length})</span></h3>
      {#if list.length === 0}
        <p class="empty">None yet.</p>
      {:else}
        <ul class="rows">
          {#each list as c (c.id)}
            <li class="row">
              <div class="primary">
                <input
                  class="name-in"
                  type="text"
                  value={c.display_name}
                  onblur={(e) => {
                    const v = (e.currentTarget as HTMLInputElement).value.trim();
                    if (v && v !== c.display_name) {
                      api("PATCH", `/credits/${c.id}`, { display_name: v });
                    }
                  }}
                />
                <input
                  class="pos-in"
                  type="text"
                  value={c.position}
                  placeholder={cat === "cast" ? "Role" : "Position"}
                  onblur={(e) => {
                    const v = (e.currentTarget as HTMLInputElement).value.trim();
                    if (v !== c.position) updatePosition(c.id, v);
                  }}
                />
              </div>
              <div class="actions">
                {#if c.profile_id}
                  <span class="link-tag">🔗 Linked</span>
                  <button type="button" class="ghost-mini" onclick={() => setProfileLink(c.id, null)}>Unlink</button>
                {:else}
                  <button
                    type="button"
                    class="ghost-mini"
                    onclick={() => lookupMatches(c)}
                    disabled={matchLoading.has(c.id)}
                  >
                    {matchLoading.has(c.id) ? "Searching..." : "Find profile"}
                  </button>
                {/if}
                <button type="button" class="warn-mini" onclick={() => (pendingDelete = c)} aria-label="Remove">×</button>
              </div>
              {#if matchesByCredit.has(c.id) && !c.profile_id}
                {@const m = matchesByCredit.get(c.id) ?? []}
                {#if m.length === 0}
                  <p class="match-none">No matching artist found in the directory.</p>
                {:else}
                  <ul class="match-list">
                    {#each m as cand (cand.id)}
                      <li>
                        <button type="button" class="match-bt" onclick={() => setProfileLink(c.id, cand.id)}>
                          Link to <strong>{cand.full_name}</strong>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/each}
</div>

<ConfirmModal
  open={pendingDelete !== null}
  title="Remove this credit?"
  body="The credit comes off the production. If this person is in the directory, the linked entry on their resume converts to a regular hand-edited row (so they keep the credit they earned)."
  confirmLabel="Remove"
  variant="warn"
  onConfirm={async () => {
    const id = pendingDelete!.id;
    pendingDelete = null;
    await deleteCredit(id);
  }}
  onClose={() => (pendingDelete = null)}
/>

<style>
  .pce {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
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
  .quick-add {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .qa-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .qa-name {
    position: relative;
    flex: 1 1 200px;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .qa-name input {
    flex: 1;
  }
  .link-tag-inline {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
    white-space: nowrap;
  }
  .ac {
    list-style: none;
    margin: 0;
    padding: 4px;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    z-index: 10;
    margin-top: 4px;
  }
  .ac button {
    width: 100%;
    text-align: left;
    background: transparent;
    border: 0;
    padding: 6px 10px;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
    cursor: pointer;
    border-radius: var(--radius);
  }
  .ac button:hover {
    background: var(--bg-raised);
  }
  .qa-row select,
  .qa-row input {
    padding: 7px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--bg);
    color: var(--ink);
  }
  .qa-row input {
    flex: 1 1 200px;
    min-width: 0;
  }
  .bt {
    padding: 7px 14px;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    background: var(--ink);
    color: var(--bg);
    font-family: var(--font-body);
    font-size: 13px;
    cursor: pointer;
  }
  .bt:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .ghost {
    background: transparent;
    color: var(--ink);
    border: 1px solid var(--rule);
    padding: 6px 12px;
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius);
    cursor: pointer;
    align-self: flex-start;
  }
  .ghost-mini {
    background: transparent;
    color: var(--ink-soft);
    border: 1px solid var(--rule);
    padding: 3px 8px;
    font-family: var(--font-body);
    font-size: 12px;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .ghost-mini:hover {
    color: var(--ink);
    border-color: var(--ink);
  }
  .ghost-mini:disabled {
    opacity: 0.6;
  }
  .warn-mini {
    background: transparent;
    color: var(--warn);
    border: 1px solid var(--rule);
    width: 26px;
    height: 26px;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  }
  .warn-mini:hover {
    border-color: var(--warn);
  }
  .paste-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .paste-area textarea {
    padding: 8px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--bg);
    color: var(--ink);
    resize: vertical;
    min-height: 140px;
  }
  .paste-area select {
    align-self: flex-start;
    padding: 6px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--bg);
    color: var(--ink);
  }
  .hint {
    margin: 0;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
    line-height: 1.5;
  }
  .cat {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cat-h {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    font-weight: 500;
  }
  .count {
    color: var(--ink-soft);
  }
  .empty {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    padding: 10px 12px;
    border: 1px dashed var(--rule);
    border-radius: var(--radius);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .primary {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .name-in,
  .pos-in {
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
  .actions {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .link-tag {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 3px 8px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    color: var(--accent);
  }
  .match-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .match-bt {
    background: transparent;
    border: 1px solid var(--rule);
    padding: 4px 10px;
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 12px;
    cursor: pointer;
    color: var(--ink);
  }
  .match-bt:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .match-none {
    margin: 0;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
  }
</style>
