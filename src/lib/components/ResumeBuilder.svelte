<script lang="ts">
  // Structured resume editor - three sections (credits, training, skills).
  // Bound `value` is the ResumeData object; the form serialises it to a
  // hidden 'resume_data' input as JSON. Server uses parseResumeData to
  // validate + normalise on save.

  type Credit = {
    show: string;
    role: string;
    company: string;
    director?: string;
    year?: string;
    notes?: string;
  };
  type Training = {
    title: string;
    institution: string;
    year?: string;
    notes?: string;
  };
  type Skill = { category: string; items: string };
  type ResumeData = {
    credits: Credit[];
    training: Training[];
    skills: Skill[];
  };

  type Props = { value?: ResumeData };

  function empty(): ResumeData {
    return { credits: [], training: [], skills: [] };
  }

  let { value = $bindable<ResumeData>(empty()) }: Props = $props();

  // Defensive: callers may pass {} or null.
  $effect(() => {
    if (!value || typeof value !== "object") {
      value = empty();
      return;
    }
    if (!Array.isArray(value.credits)) value = { ...value, credits: [] };
    if (!Array.isArray(value.training)) value = { ...value, training: [] };
    if (!Array.isArray(value.skills)) value = { ...value, skills: [] };
  });

  function addCredit() {
    value = {
      ...value,
      credits: [
        ...value.credits,
        { show: "", role: "", company: "", director: "", year: "", notes: "" },
      ],
    };
  }
  function removeCredit(i: number) {
    value = { ...value, credits: value.credits.filter((_, idx) => idx !== i) };
  }
  function moveCredit(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.credits.length) return;
    const next = [...value.credits];
    [next[i], next[j]] = [next[j], next[i]];
    value = { ...value, credits: next };
  }
  function setCredit(i: number, key: keyof Credit, v: string) {
    value = {
      ...value,
      credits: value.credits.map((c, idx) =>
        idx === i ? { ...c, [key]: v } : c,
      ),
    };
  }

  function addTraining() {
    value = {
      ...value,
      training: [
        ...value.training,
        { title: "", institution: "", year: "", notes: "" },
      ],
    };
  }
  function removeTraining(i: number) {
    value = { ...value, training: value.training.filter((_, idx) => idx !== i) };
  }
  function moveTraining(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.training.length) return;
    const next = [...value.training];
    [next[i], next[j]] = [next[j], next[i]];
    value = { ...value, training: next };
  }
  function setTraining(i: number, key: keyof Training, v: string) {
    value = {
      ...value,
      training: value.training.map((t, idx) =>
        idx === i ? { ...t, [key]: v } : t,
      ),
    };
  }

  function addSkill() {
    value = {
      ...value,
      skills: [...value.skills, { category: "", items: "" }],
    };
  }
  function removeSkill(i: number) {
    value = { ...value, skills: value.skills.filter((_, idx) => idx !== i) };
  }
  function moveSkill(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.skills.length) return;
    const next = [...value.skills];
    [next[i], next[j]] = [next[j], next[i]];
    value = { ...value, skills: next };
  }
  function setSkill(i: number, key: keyof Skill, v: string) {
    value = {
      ...value,
      skills: value.skills.map((s, idx) =>
        idx === i ? { ...s, [key]: v } : s,
      ),
    };
  }
</script>

<div class="rb">
  <!-- ===== Credits ===== -->
  <section class="section">
    <header class="sec-head">
      <h3 class="sec-title">Theatre credits</h3>
      <button type="button" class="add" onclick={addCredit}>
        + Add credit
      </button>
    </header>
    {#if value.credits.length === 0}
      <p class="empty">No credits yet.</p>
    {:else}
      <ul class="rows">
        {#each value.credits as c, i (i)}
          <li class="row">
            <div class="row-controls" aria-hidden="true">
              <span class="num">{String(i + 1).padStart(2, "0")}</span>
              <button
                type="button"
                class="ctl"
                onclick={() => moveCredit(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                class="ctl"
                onclick={() => moveCredit(i, 1)}
                disabled={i === value.credits.length - 1}
                aria-label="Move down"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                class="ctl warn"
                onclick={() => removeCredit(i)}
                aria-label="Remove"
                title="Remove"
              >
                ×
              </button>
            </div>
            <div class="row-fields">
              <label class="f">
                <span>Show</span>
                <input
                  type="text"
                  value={c.show}
                  oninput={(e) =>
                    setCredit(i, "show", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="King Lear"
                />
              </label>
              <label class="f">
                <span>Role / position</span>
                <input
                  type="text"
                  value={c.role}
                  oninput={(e) =>
                    setCredit(i, "role", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="Cordelia / Director / Lighting Designer"
                />
              </label>
              <label class="f">
                <span>Company</span>
                <input
                  type="text"
                  value={c.company}
                  oninput={(e) =>
                    setCredit(i, "company", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="Tacoma Little Theatre"
                />
              </label>
              <label class="f">
                <span>Director (if applicable)</span>
                <input
                  type="text"
                  value={c.director ?? ""}
                  oninput={(e) =>
                    setCredit(i, "director", (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
              <label class="f short">
                <span>Year</span>
                <input
                  type="text"
                  value={c.year ?? ""}
                  oninput={(e) =>
                    setCredit(i, "year", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="2024"
                />
              </label>
              <label class="f wide">
                <span>Notes (optional)</span>
                <input
                  type="text"
                  value={c.notes ?? ""}
                  oninput={(e) =>
                    setCredit(i, "notes", (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- ===== Training ===== -->
  <section class="section">
    <header class="sec-head">
      <h3 class="sec-title">Training</h3>
      <button type="button" class="add" onclick={addTraining}>
        + Add training
      </button>
    </header>
    {#if value.training.length === 0}
      <p class="empty">No training yet.</p>
    {:else}
      <ul class="rows">
        {#each value.training as t, i (i)}
          <li class="row">
            <div class="row-controls" aria-hidden="true">
              <span class="num">{String(i + 1).padStart(2, "0")}</span>
              <button
                type="button"
                class="ctl"
                onclick={() => moveTraining(i, -1)}
                disabled={i === 0}
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                class="ctl"
                onclick={() => moveTraining(i, 1)}
                disabled={i === value.training.length - 1}
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                class="ctl warn"
                onclick={() => removeTraining(i)}
                title="Remove"
              >
                ×
              </button>
            </div>
            <div class="row-fields">
              <label class="f">
                <span>Title / program</span>
                <input
                  type="text"
                  value={t.title}
                  oninput={(e) =>
                    setTraining(i, "title", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="BFA in Acting"
                />
              </label>
              <label class="f">
                <span>Institution</span>
                <input
                  type="text"
                  value={t.institution}
                  oninput={(e) =>
                    setTraining(i, "institution", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="Cornish College of the Arts"
                />
              </label>
              <label class="f short">
                <span>Year</span>
                <input
                  type="text"
                  value={t.year ?? ""}
                  oninput={(e) =>
                    setTraining(i, "year", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="2018"
                />
              </label>
              <label class="f wide">
                <span>Notes (optional)</span>
                <input
                  type="text"
                  value={t.notes ?? ""}
                  oninput={(e) =>
                    setTraining(i, "notes", (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- ===== Skills ===== -->
  <section class="section">
    <header class="sec-head">
      <h3 class="sec-title">Skills</h3>
      <button type="button" class="add" onclick={addSkill}>+ Add group</button>
    </header>
    {#if value.skills.length === 0}
      <p class="empty">
        No skills yet. Group by category - dialects, instruments, certifications, etc.
      </p>
    {:else}
      <ul class="rows">
        {#each value.skills as s, i (i)}
          <li class="row">
            <div class="row-controls" aria-hidden="true">
              <span class="num">{String(i + 1).padStart(2, "0")}</span>
              <button
                type="button"
                class="ctl"
                onclick={() => moveSkill(i, -1)}
                disabled={i === 0}
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                class="ctl"
                onclick={() => moveSkill(i, 1)}
                disabled={i === value.skills.length - 1}
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                class="ctl warn"
                onclick={() => removeSkill(i)}
                title="Remove"
              >
                ×
              </button>
            </div>
            <div class="row-fields">
              <label class="f">
                <span>Category</span>
                <input
                  type="text"
                  value={s.category}
                  oninput={(e) =>
                    setSkill(i, "category", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="Dialects"
                />
              </label>
              <label class="f wide">
                <span>Items (comma-separated)</span>
                <input
                  type="text"
                  value={s.items}
                  oninput={(e) =>
                    setSkill(i, "items", (e.currentTarget as HTMLInputElement).value)}
                  placeholder="RP, Cockney, Standard American"
                />
              </label>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- Hidden input the form serialises. -->
  <input type="hidden" name="resume_data" value={JSON.stringify(value)} />
</div>

<style>
  .rb {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
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
  .add:hover {
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
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .row-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 0 0 auto;
  }
  .num {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--muted);
    margin-bottom: 2px;
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
  .ctl:hover:not(:disabled) {
    border-color: var(--ink);
    color: var(--ink);
  }
  .ctl:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .ctl.warn {
    color: var(--error);
    font-size: 16px;
  }
  .ctl.warn:hover {
    border-color: var(--error);
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
