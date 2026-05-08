<script lang="ts">
  // Cast / production capture for the public /calendar/submit form.
  // Differs from the admin/org ProductionCreditsEditor:
  //   - No live API. Credits are serialised to a hidden JSON input and
  //     processed by the submit form action when the show is created.
  //   - Type-ahead artist autocomplete via /api/calendar/submit/match-artist
  //     so the submitter can link cast members who already have profiles.
  //   - Optional paste-a-cast-list mode for fast entry.

  type Category = "cast" | "production";

  type Credit = {
    profile_id: string | null;
    display_name: string;
    position: string;
    category: Category;
  };

  type Match = { id: string; slug: string; full_name: string };

  let credits = $state<Credit[]>([]);

  // Quick-add row state.
  let qaName = $state("");
  let qaPosition = $state("");
  let qaCategory = $state<Category>("cast");
  let qaMatches = $state<Match[]>([]);
  let qaPickedId = $state<string | null>(null);
  let qaSearchTimer: ReturnType<typeof setTimeout> | null = null;

  // Paste mode.
  let pasteOpen = $state(false);
  let pasteText = $state("");
  let pasteCategory = $state<Category>("cast");

  // Hidden JSON for the form action to parse server-side.
  const serialized = $derived(JSON.stringify(credits));

  function searchArtists(q: string) {
    if (qaSearchTimer) clearTimeout(qaSearchTimer);
    if (q.trim().length < 2) {
      qaMatches = [];
      qaPickedId = null;
      return;
    }
    qaSearchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/calendar/submit/match-artist?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { matches: Match[] };
        qaMatches = data.matches;
      } catch {
        qaMatches = [];
      }
    }, 200);
  }

  function pickMatch(m: Match) {
    qaName = m.full_name;
    qaPickedId = m.id;
    qaMatches = [];
  }

  function addQuickAdd() {
    const name = qaName.trim();
    if (!name) return;
    credits = [
      ...credits,
      {
        profile_id: qaPickedId,
        display_name: name,
        position: qaPosition.trim() || (qaCategory === "cast" ? "Ensemble" : "TBD"),
        category: qaCategory,
      },
    ];
    qaName = "";
    qaPosition = "";
    qaPickedId = null;
    qaMatches = [];
  }

  function removeAt(i: number) {
    credits = credits.filter((_, idx) => idx !== i);
  }

  // Mirrors src/lib/server/productionCredits.ts.parseCastList for the
  // optimistic preview. Server re-parses on submit so this only
  // affects the count we show on the "Add N rows" button.
  const ROLE_HINT = /\b(director|music director|musical director|choreographer|stage manager|assistant stage manager|asm|sound designer|lighting designer|set designer|scenic designer|costume designer|props|properties|dramaturg|dramaturgy|fight choreographer|fight director|intimacy director|cast|carpenter|technician|photography|technical director|scenic artist|visuals|interns?|orchestra|conductor|playwright|writer|producer|production manager|house manager|wardrobe|hair|makeup|board op|board operator|projection|video|chief|assistant|associate|crew|run crew|deck|deck chief|spot operator|swing|dance captain|fight captain|vocal director)\b/i;

  const ROLE_HINT_GLOBAL = new RegExp(ROLE_HINT.source, "gi");
  function roleDensity(s: string): number {
    const tokens = s.split(/[\s/&]+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) return 0;
    const matches = s.match(ROLE_HINT_GLOBAL);
    return (matches ? matches.length : 0) / tokens.length;
  }
  function orient(a: string, b: string): { name: string; position: string } {
    const da = roleDensity(a);
    const db = roleDensity(b);
    if (da > db) return { name: b, position: a };
    if (db > da) return { name: a, position: b };
    return { name: a, position: b };
  }
  function splitNames(name: string): string[] {
    const parts = name
      .split(/\s*(?:,|&|\sand\s)\s*/i)
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : [name];
  }
  function parseLine(line: string): Array<{ name: string; position: string }> {
    let parsed: { name: string; position: string } | null = null;
    const asMatch = line.match(/^(.+?)\s+as\s+(.+)$/i);
    if (asMatch) parsed = { name: asMatch[1].trim(), position: asMatch[2].trim() };
    if (!parsed) {
      let dashMatch = line.match(/^(.+?)\s+[-—–]\s+(.+)$/);
      if (!dashMatch) dashMatch = line.match(/^(.+?)\s*[-—–]\s*(.+)$/);
      if (dashMatch) parsed = orient(dashMatch[1].trim(), dashMatch[2].trim());
    }
    if (!parsed) {
      const colonMatch = line.match(/^(.+?):\s*(.+)$/);
      if (colonMatch) parsed = orient(colonMatch[1].trim(), colonMatch[2].trim());
    }
    if (!parsed) {
      const commaMatch = line.match(/^([^,]+),\s+(.+)$/);
      if (commaMatch) parsed = { name: commaMatch[1].trim(), position: commaMatch[2].trim() };
    }
    if (!parsed) return [{ name: line.trim(), position: "" }];
    return splitNames(parsed.name).map((n) => ({ name: n, position: parsed!.position }));
  }

  function applyPaste() {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const next: Credit[] = [];
    for (const line of lines) {
      for (const { name, position } of parseLine(line)) {
        if (!name) continue;
        next.push({
          profile_id: null,
          display_name: name,
          position: position || (pasteCategory === "cast" ? "Ensemble" : "TBD"),
          category: pasteCategory,
        });
      }
    }
    credits = [...credits, ...next];
    pasteText = "";
    pasteOpen = false;
  }

  function categoryLabel(c: Category) {
    return c === "cast" ? "Cast" : "Production";
  }
</script>

<div class="cs">
  <p class="hint">
    Optional. Tag the cast and production team. As you type a name we'll
    suggest a match if they're already in the directory - linking lets
    the credit show up on their profile automatically.
  </p>

  <div class="quick-add">
    <div class="qa-grid">
      <div class="f autocomplete-wrap">
        <span>Name</span>
        <input
          type="text"
          bind:value={qaName}
          oninput={(e) => searchArtists((e.currentTarget as HTMLInputElement).value)}
          placeholder="Sarah Jones"
          autocomplete="off"
        />
        {#if qaMatches.length > 0 && qaPickedId === null}
          <ul class="ac">
            {#each qaMatches as m (m.id)}
              <li>
                <button type="button" onclick={() => pickMatch(m)}>
                  Link to <strong>{m.full_name}</strong>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        {#if qaPickedId}
          <span class="link-tag">🔗 Will link to this artist</span>
        {/if}
      </div>
      <label class="f">
        <span>Section</span>
        <select bind:value={qaCategory}>
          <option value="cast">Cast</option>
          <option value="production">Production</option>
        </select>
      </label>
      <label class="f">
        <span>{qaCategory === "cast" ? "Role" : "Position"}</span>
        <input
          type="text"
          bind:value={qaPosition}
          placeholder={qaCategory === "cast" ? "Cordelia" : "Director"}
          onkeydown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addQuickAdd();
            }
          }}
        />
      </label>
      <div class="f">
        <span>&nbsp;</span>
        <button type="button" class="bt" onclick={addQuickAdd} disabled={!qaName.trim()}>
          + Add
        </button>
      </div>
    </div>
    <button type="button" class="ghost" onclick={() => (pasteOpen = !pasteOpen)}>
      {pasteOpen ? "Cancel paste" : "+ Paste a cast list"}
    </button>
    {#if pasteOpen}
      <div class="paste">
        <p class="paste-hint">
          One person per line. Recognised: "Name as Role", "Name - Role",
          "Name: Role", "Role: Name", "Name, Role". Lines without a
          separator land with placeholder positions you can edit.
        </p>
        <select bind:value={pasteCategory}>
          <option value="cast">Cast section</option>
          <option value="production">Production team</option>
        </select>
        <textarea rows="8" bind:value={pasteText} placeholder={"Sarah Jones as Cordelia\nJamie Lee - Lear\nDirector: Lexi Barnett"}></textarea>
        <button type="button" class="bt" onclick={applyPaste} disabled={!pasteText.trim()}>
          Add {pasteText.split("\n").filter((l) => l.trim()).length} {pasteText.split("\n").filter((l) => l.trim()).length === 1 ? "row" : "rows"}
        </button>
      </div>
    {/if}
  </div>

  {#if credits.length > 0}
    <ul class="rows">
      {#each credits as c, i (i)}
        <li class="row">
          <div class="row-meta">
            <strong>{c.display_name}</strong>
            {#if c.profile_id}<span class="link-tag-mini">🔗</span>{/if}
            <span class="row-cat">· {categoryLabel(c.category)}</span>
            {#if c.position}<span class="row-pos">· {c.position}</span>{/if}
          </div>
          <button type="button" class="warn-mini" aria-label="Remove" onclick={() => removeAt(i)}>×</button>
        </li>
      {/each}
    </ul>
  {/if}

  <input type="hidden" name="credits_json" value={serialized} />
</div>

<style>
  .cs {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .hint {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
    line-height: 1.5;
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
  .qa-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 2fr auto;
    gap: 8px;
    align-items: end;
  }
  @media (max-width: 720px) {
    .qa-grid {
      grid-template-columns: 1fr;
    }
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
  }
  .f span {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .f input,
  .f select {
    padding: 8px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--bg);
    color: var(--ink);
  }
  .ac {
    list-style: none;
    margin: 4px 0 0;
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
  .link-tag {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
    margin-top: 4px;
  }
  .bt {
    padding: 8px 14px;
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
    align-self: flex-start;
    background: transparent;
    border: 1px solid var(--rule);
    color: var(--ink);
    padding: 6px 12px;
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .paste {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .paste-hint {
    margin: 0;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
    line-height: 1.5;
  }
  .paste textarea {
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
  .paste select {
    align-self: flex-start;
    padding: 6px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--bg);
    color: var(--ink);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    gap: 8px;
  }
  .row-meta {
    display: flex;
    gap: 6px;
    align-items: baseline;
    flex-wrap: wrap;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
    min-width: 0;
  }
  .row-cat,
  .row-pos {
    color: var(--ink-soft);
    font-size: 13px;
  }
  .link-tag-mini {
    font-size: 11px;
    color: var(--accent);
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
    flex-shrink: 0;
  }
  .warn-mini:hover {
    border-color: var(--warn);
  }
</style>
