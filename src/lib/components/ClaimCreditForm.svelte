<script lang="ts">
  // Lets an artist self-claim a production credit from /edit/[token].
  // Search productions by title, pick one, fill in role + category,
  // submit. The new credit is auto-linked to the artist's profile and
  // a corresponding resume_entries row lands in their inbox.

  type Props = { token: string };
  let { token }: Props = $props();

  type Match = {
    id: string;
    title: string;
    run_start: string;
    run_end: string | null;
    org_name: string | null;
  };

  let q = $state("");
  let matches = $state<Match[]>([]);
  let pickedId = $state<string | null>(null);
  let position = $state("");
  let category = $state<"cast" | "creative" | "crew">("cast");
  let busy = $state(false);
  let msg = $state<string | null>(null);
  let isError = $state(false);

  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 200);
  }

  async function runSearch() {
    if (!q.trim()) {
      matches = [];
      return;
    }
    try {
      const res = await fetch(`/api/edit/${token}/claim-credit?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { matches: Match[] };
      matches = data.matches;
    } catch {
      // swallow
    }
  }

  async function submit() {
    if (!pickedId || !position.trim()) return;
    busy = true;
    msg = null;
    isError = false;
    try {
      const res = await fetch(`/api/edit/${token}/claim-credit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          production_id: pickedId,
          position,
          category,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        try {
          const j = JSON.parse(text) as { message?: string };
          throw new Error(j.message ?? text);
        } catch {
          throw new Error(text || "Could not claim credit.");
        }
      }
      msg = "Credit claimed. It's in your resume inbox - assign it to a resume above.";
      isError = false;
      pickedId = null;
      position = "";
      q = "";
      matches = [];
    } catch (err) {
      msg = err instanceof Error ? err.message : String(err);
      isError = true;
    } finally {
      busy = false;
    }
  }
</script>

<div class="claim">
  <p class="hint">
    Were you in a show that's on the calendar but isn't tagged on your
    profile? Find it here, claim your role, and the credit will land in
    your resume inbox.
  </p>
  <label class="f">
    <span>Search calendar</span>
    <input
      type="text"
      bind:value={q}
      oninput={scheduleSearch}
      placeholder="Hamlet, Mamma Mia, ..."
    />
  </label>

  {#if matches.length > 0 && !pickedId}
    <ul class="match-list">
      {#each matches as m (m.id)}
        <li>
          <button type="button" class="m-bt" onclick={() => (pickedId = m.id, q = m.title)}>
            <strong>{m.title}</strong>
            {#if m.org_name}<span class="m-org">{m.org_name}</span>{/if}
            <span class="m-year">{new Date(m.run_start).getFullYear()}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if pickedId}
    <div class="picked">
      <p class="picked-line">
        <strong>{q}</strong>
        <button type="button" class="ghost-mini" onclick={() => (pickedId = null)}>Change</button>
      </p>
      <div class="row">
        <label class="f">
          <span>Section</span>
          <select bind:value={category}>
            <option value="cast">Cast</option>
            <option value="creative">Creative team</option>
            <option value="crew">Crew</option>
          </select>
        </label>
        <label class="f wide">
          <span>Your role / position</span>
          <input type="text" bind:value={position} placeholder={category === "cast" ? "Hamlet" : "Director"} />
        </label>
      </div>
      <button type="button" class="bt" onclick={submit} disabled={busy || !position.trim()}>
        Claim this credit
      </button>
    </div>
  {/if}

  {#if msg}
    <p class="msg" class:err={isError}>{msg}</p>
  {/if}
</div>

<style>
  .claim {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px dashed var(--rule);
    border-radius: var(--radius);
  }
  .hint {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
    line-height: 1.5;
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .f.wide { flex: 2; }
  .f span {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .f input,
  .f select {
    padding: 7px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--bg);
    color: var(--ink);
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .row .f { flex: 1 1 200px; min-width: 0; }
  .match-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .m-bt {
    width: 100%;
    text-align: left;
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    padding: 8px 10px;
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    cursor: pointer;
    color: var(--ink);
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .m-bt:hover {
    border-color: var(--accent);
  }
  .m-org {
    color: var(--ink-soft);
  }
  .m-year {
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 12px;
    margin-left: auto;
  }
  .picked {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .picked-line {
    margin: 0;
    display: flex;
    gap: 8px;
    align-items: center;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
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
  .ghost-mini:hover { border-color: var(--ink); color: var(--ink); }
  .bt {
    align-self: flex-start;
    padding: 7px 14px;
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    background: var(--ink);
    color: var(--bg);
    font-family: var(--font-body);
    font-size: 13px;
    cursor: pointer;
  }
  .bt:disabled { opacity: 0.5; cursor: not-allowed; }
  .msg {
    margin: 0;
    padding: 8px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
  }
  .msg.err {
    border-color: var(--warn);
    color: var(--warn);
    background: rgba(180, 70, 50, 0.08);
  }
</style>
