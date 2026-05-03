<script lang="ts">
  // Schedule pattern editor: lets admin enter "Fri+Sat 7:30pm, Sun 2pm
  // from May 22 to June 14, plus Pay-What-You-Will Saturday May 23"
  // and click Generate to expand it into individual performance rows.
  // Mirrors the cron's scripts/_lib/calendar-sync.mjs expandPerformances
  // logic so auto-pop'd and manually-pattern-generated entries produce
  // identical row shapes.

  type Rule = { weekdays: string[]; time: string };
  type Special = { date: string; time: string; note: string };
  type Perf = { wallClock: string; note: string };

  type Props = {
    runStart: string;
    runEnd: string;
    onApply: (performances: Perf[]) => void;
    existingCount: number;
  };

  let { runStart, runEnd, onApply, existingCount }: Props = $props();

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const WEEKDAY_NUM: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  // Default: the most common community-theatre pattern - Fri+Sat 7:30pm,
  // Sun 2pm. Admin adjusts as needed.
  let rules = $state<Rule[]>([
    { weekdays: ["Fri", "Sat"], time: "19:30" },
    { weekdays: ["Sun"], time: "14:00" },
  ]);
  let specials = $state<Special[]>([]);
  let preview = $state<Perf[]>([]);
  let confirmReplace = $state(false);

  function toggleWeekday(ruleIndex: number, wd: string) {
    const rule = rules[ruleIndex];
    const set = new Set(rule.weekdays);
    if (set.has(wd)) set.delete(wd);
    else set.add(wd);
    rules[ruleIndex] = { ...rule, weekdays: Array.from(set) };
  }
  function addRule() {
    rules = [...rules, { weekdays: [], time: "19:30" }];
  }
  function removeRule(i: number) {
    rules = rules.filter((_, j) => j !== i);
  }
  function addSpecial() {
    specials = [...specials, { date: runStart || "", time: "19:30", note: "" }];
  }
  function removeSpecial(i: number) {
    specials = specials.filter((_, j) => j !== i);
  }

  // ---- Expansion (mirrors cron lib) ------------------------------
  function eachDate(startISO: string, endISO: string) {
    const out: Array<{ iso: string; dayOfWeek: number }> = [];
    const start = new Date(`${startISO}T12:00:00Z`);
    const end = new Date(`${endISO}T12:00:00Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return out;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      out.push({ iso: d.toISOString().slice(0, 10), dayOfWeek: d.getUTCDay() });
    }
    return out;
  }

  function expand(): Perf[] {
    if (!runStart || !runEnd) return [];
    const out: Perf[] = [];
    const seen = new Set<string>();
    for (const day of eachDate(runStart, runEnd)) {
      for (const rule of rules) {
        if (!/^\d{2}:\d{2}$/.test(rule.time)) continue;
        const nums = rule.weekdays
          .map((w) => WEEKDAY_NUM[w])
          .filter((n) => n !== undefined);
        if (nums.includes(day.dayOfWeek)) {
          const wallClock = `${day.iso}T${rule.time}`;
          if (!seen.has(wallClock)) {
            seen.add(wallClock);
            out.push({ wallClock, note: "" });
          }
        }
      }
    }
    for (const sp of specials) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sp.date)) continue;
      if (!/^\d{2}:\d{2}$/.test(sp.time)) continue;
      const wallClock = `${sp.date}T${sp.time}`;
      const existing = out.find((p) => p.wallClock === wallClock);
      if (existing) {
        existing.note = sp.note?.trim() ?? "";
      } else {
        out.push({ wallClock, note: sp.note?.trim() ?? "" });
      }
    }
    out.sort((a, b) => a.wallClock.localeCompare(b.wallClock));
    return out;
  }

  // Live preview count (cheap to recompute)
  $effect(() => {
    preview = expand();
  });

  function handleApply() {
    onApply(preview);
    // Reset confirmation state so subsequent Generate clicks ask again
    confirmReplace = false;
  }
</script>

<details class="pattern-block">
  <summary>
    <span>Generate from a schedule pattern</span>
    <span class="muted">{preview.length} performance{preview.length === 1 ? "" : "s"} would be generated</span>
  </summary>

  {#if !runStart || !runEnd}
    <p class="hint warn">Set the run start + run end above first - the pattern uses those dates as the window.</p>
  {/if}

  <div class="block">
    <h4 class="block-h">Recurring schedule</h4>
    <p class="hint">
      Each rule is a set of weekdays + a time. The default below is the
      most common community-theatre pattern (Fri/Sat 7:30pm, Sun 2pm) -
      adjust to match.
    </p>

    {#each rules as rule, i (i)}
      <div class="rule-row">
        <div class="weekday-chips">
          {#each WEEKDAYS as wd}
            <button
              type="button"
              class="wd-chip"
              class:on={rule.weekdays.includes(wd)}
              onclick={() => toggleWeekday(i, wd)}
              aria-pressed={rule.weekdays.includes(wd)}
            >
              {wd}
            </button>
          {/each}
        </div>
        <span class="at">at</span>
        <input
          type="time"
          bind:value={rules[i].time}
          class="time-input"
          aria-label="Time"
        />
        <button type="button" class="bt-x" onclick={() => removeRule(i)} title="Remove rule">×</button>
      </div>
    {/each}

    <button type="button" class="bt bt-ghost bt-sm" onclick={addRule}>+ Add rule</button>
  </div>

  <div class="block">
    <h4 class="block-h">Special performances <span class="opt">(optional)</span></h4>
    <p class="hint">
      One-off dates that need a note - "Pay What You Will", "ASL Interpreted",
      "Talkback after", etc. If the date+time matches an existing rule, the
      note attaches to that performance; otherwise a new performance is added.
    </p>

    {#each specials as sp, i (i)}
      <div class="special-row">
        <input type="date" bind:value={specials[i].date} class="date-input" aria-label="Date" />
        <input type="time" bind:value={specials[i].time} class="time-input" aria-label="Time" />
        <input
          type="text"
          bind:value={specials[i].note}
          placeholder="Note"
          class="note-input"
          aria-label="Note"
        />
        <button type="button" class="bt-x" onclick={() => removeSpecial(i)} title="Remove">×</button>
      </div>
    {/each}

    <button type="button" class="bt bt-ghost bt-sm" onclick={addSpecial}>+ Add special</button>
  </div>

  <div class="apply-zone">
    {#if existingCount === 0 || confirmReplace}
      <button
        type="button"
        class="bt bt-pri"
        onclick={handleApply}
        disabled={preview.length === 0}
      >
        {confirmReplace
          ? `Replace ${existingCount} existing with ${preview.length}`
          : `Generate ${preview.length} performance${preview.length === 1 ? "" : "s"}`}
      </button>
      {#if confirmReplace}
        <button type="button" class="bt bt-ghost bt-sm" onclick={() => (confirmReplace = false)}>Cancel</button>
      {/if}
    {:else}
      <button
        type="button"
        class="bt bt-ghost"
        onclick={() => (confirmReplace = true)}
        disabled={preview.length === 0}
      >
        Generate {preview.length} performance{preview.length === 1 ? "" : "s"}…
      </button>
      <span class="hint warn">
        Will replace the {existingCount} performance{existingCount === 1 ? "" : "s"} below.
      </span>
    {/if}
  </div>
</details>

<style>
  .pattern-block {
    margin: 0.5rem 0 1rem;
    border: 1px dashed var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
  }
  .pattern-block summary {
    cursor: pointer;
    padding: 0.6rem 0.85rem;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-soft);
    list-style: none;
  }
  .pattern-block summary::-webkit-details-marker { display: none; }
  .pattern-block summary::before {
    content: "▸ ";
    color: var(--accent);
    margin-right: 0.4rem;
  }
  .pattern-block[open] summary::before { content: "▾ "; }
  .pattern-block summary .muted {
    text-transform: none;
    color: var(--muted);
    font-size: 0.75rem;
  }
  .pattern-block > .block,
  .pattern-block > .apply-zone {
    padding: 0.6rem 0.85rem;
    border-top: 1px solid var(--rule-soft);
  }

  .block-h {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin: 0 0 0.4rem;
  }
  .block-h .opt { color: var(--muted); font-weight: 400; }

  .hint {
    font-size: 0.78rem;
    color: var(--muted);
    margin: 0 0 0.6rem;
  }
  .hint.warn { color: #8a6e1c; }

  .rule-row,
  .special-row {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  .special-row {
    grid-template-columns: 7.5rem 6.5rem 1fr auto;
  }
  .at {
    font-size: 0.8rem;
    color: var(--muted);
  }

  .weekday-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .wd-chip {
    padding: 0.2rem 0.5rem;
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted);
    cursor: pointer;
  }
  .wd-chip.on {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
  .wd-chip:hover:not(.on) { border-color: var(--accent); color: var(--accent); }

  .time-input,
  .date-input,
  .note-input {
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 0.85rem;
  }

  .bt-x {
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--muted);
    cursor: pointer;
    font-size: 0.95rem;
    line-height: 1;
  }
  .bt-x:hover { border-color: var(--error); color: var(--error); }

  .apply-zone {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  .bt {
    padding: 0.4rem 0.85rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    font-size: 0.85rem;
    cursor: pointer;
    font-family: var(--font-body);
  }
  .bt:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .bt-pri { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); color: white; }
  .bt-sm { padding: 0.25rem 0.6rem; font-size: 0.8rem; }
  .bt:disabled { opacity: 0.5; cursor: not-allowed; }

  @media (max-width: 720px) {
    .rule-row, .special-row {
      grid-template-columns: 1fr;
    }
  }
</style>
