<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  let { data, form } = $props();

  // Track which row is currently submitting so its button shows a busy
  // state without locking the rest of the page.
  let busy = $state<string | null>(null);

  // Confirm modal state. The pending form's section name drives the
  // copy + the cascade warning ("X profiles use this").
  type PendingKind = "area" | "union" | "ethnicity";
  let pendingForm = $state<HTMLFormElement | null>(null);
  let pendingName = $state("");
  let pendingKind = $state<PendingKind>("area");
  let pendingCount = $state(0);

  function askRemove(
    e: MouseEvent,
    name: string,
    kind: PendingKind,
    count: number,
  ) {
    pendingForm = (e.currentTarget as HTMLElement).closest("form");
    pendingName = name;
    pendingKind = kind;
    pendingCount = count;
  }
  function cancelRemove() {
    pendingForm = null;
    pendingName = "";
    pendingCount = 0;
  }
  function confirmRemove() {
    pendingForm?.requestSubmit();
    cancelRemove();
  }

  // Section-scoped status banner. The form result tells us which section
  // handled the action; we render the banner right above that section.
  function statusFor(section: "areas" | "unions" | "ethnicities") {
    if (!form || form.section !== section) return null;
    return form;
  }

  // Auto-save the sort number on blur. Skips if the field is empty or
  // unchanged so we don't fire round-trips that wouldn't change anything
  // (and don't accidentally save 0/100 when she's mid-edit and clicks
  // away). The Sort button still works as an explicit save.
  function autoSubmitSort(e: FocusEvent, original: number) {
    const input = e.currentTarget as HTMLInputElement;
    const v = input.value.trim();
    if (!v) return;
    if (Number(v) === original) return;
    input.form?.requestSubmit();
  }
</script>

<svelte:head>
  <title>Submit form fields - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · submit form fields</span>
  <h1 class="h1-display">Submit form fields.</h1>
  <p class="lede">
    The picker lists artists see when filling out the submit form. Edits
    here cascade through every existing profile so renames don't orphan
    anyone.
  </p>
  <p class="hint">
    Disciplines have their own page because they're grouped by category &mdash;
    <a href="/admin/disciplines">edit disciplines &rarr;</a>
  </p>
</header>

<!-- ============================================================
     AREAS
     ============================================================ -->
<section class="block">
  <header class="block-hd">
    <h2 class="block-h">Geographic areas</h2>
    <p class="block-sub">
      The "Where are you based?" picker. Each area can have a description
      that shows as a hover tooltip listing covered cities.
    </p>
  </header>

  {#if statusFor("areas")}
    {@const s = statusFor("areas")}
    {#if s?.error}<div class="form-error" role="alert">{s.error}</div>{/if}
    {#if s?.added}<div class="form-ok" role="status">Added {s.added}.</div>{/if}
    {#if s?.renamed}
      <div class="form-ok" role="status">
        {#if s.merged}
          Merged into {s.renamed}. All profiles updated.
        {:else}
          Renamed to {s.renamed}. All profiles updated.
        {/if}
      </div>
    {/if}
    {#if s?.descSaved}<div class="form-ok" role="status">Description saved.</div>{/if}
    {#if s?.removed}<div class="form-ok" role="status">Removed.</div>{/if}
  {/if}

  <form
    method="POST"
    action="?/addArea"
    class="add-form add-form-3"
    use:enhance={() => {
      busy = "addArea";
      return async ({ update }) => {
        await update({ reset: true });
        busy = null;
      };
    }}
  >
    <label class="field">
      <span>Name</span>
      <input type="text" name="name" required placeholder="e.g. Steilacoom area" />
    </label>
    <label class="field">
      <span>Description (optional)</span>
      <input type="text" name="description" placeholder="Cities covered" />
    </label>
    <label class="field">
      <span>Sort</span>
      <input type="number" name="sort_order" value="100" />
    </label>
    <button type="submit" class="bt bt-pri" disabled={busy === "addArea"}>
      {busy === "addArea" ? "Adding..." : "Add area"}
    </button>
  </form>

  <ul class="rows">
    {#each data.areas as a (a.id)}
      {@const count = data.counts.areas[a.name] ?? 0}
      {@const isOther = a.name === "Other"}
      <li class="row">
        <form
          method="POST"
          action="?/renameArea"
          class="rename-form"
          use:enhance={() => {
            busy = `renameArea-${a.id}`;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={a.id} />
          <input
            type="text"
            name="new_name"
            value={a.name}
            class="rename-input"
            disabled={isOther}
            title={isOther ? "Reserved for the free-text fallback option." : ""}
          />
          {#if !isOther}
            <button
              type="submit"
              class="bt-link"
              disabled={busy === `renameArea-${a.id}`}>Save name</button
            >
          {/if}
        </form>

        <form
          method="POST"
          action="?/editAreaDescription"
          class="desc-form"
          use:enhance={() => {
            busy = `descArea-${a.id}`;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={a.id} />
          <input
            type="text"
            name="description"
            value={a.description ?? ""}
            placeholder="Description (optional)"
            class="desc-input"
          />
          <button
            type="submit"
            class="bt-link"
            disabled={busy === `descArea-${a.id}`}>Save desc</button
          >
        </form>

        <form
          method="POST"
          action="?/reorderArea"
          class="inline-form"
          use:enhance={() => {
            busy = `sortArea-${a.id}`;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={a.id} />
          <input
            type="number"
            name="sort_order"
            value={a.sort_order}
            class="num-input"
            title="Auto-saves when you tab away"
            onblur={(e) => autoSubmitSort(e, a.sort_order)}
          />
          <button type="submit" class="bt-link" disabled={busy === `sortArea-${a.id}`}>
            Sort
          </button>
        </form>

        <span class="count" title="{count} profile{count === 1 ? '' : 's'} using">
          {count}
        </span>

        <form
          method="POST"
          action="?/removeArea"
          use:enhance={() => {
            busy = `removeArea-${a.id}`;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={a.id} />
          <button
            type="button"
            class="bt-link warn"
            disabled={busy === `removeArea-${a.id}` || isOther}
            title={isOther ? "Reserved for the free-text fallback option." : ""}
            onclick={(e) => askRemove(e, a.name, "area", count)}>Remove</button
          >
        </form>
      </li>
    {/each}
  </ul>
</section>

<!-- ============================================================
     UNIONS
     ============================================================ -->
<section class="block">
  <header class="block-hd">
    <h2 class="block-h">Unions</h2>
    <p class="block-sub">
      Membership options on the submit form. Description shows as the
      tooltip body next to the union name.
    </p>
  </header>

  {#if statusFor("unions")}
    {@const s = statusFor("unions")}
    {#if s?.error}<div class="form-error" role="alert">{s.error}</div>{/if}
    {#if s?.added}<div class="form-ok" role="status">Added {s.added}.</div>{/if}
    {#if s?.renamed}
      <div class="form-ok" role="status">
        {#if s.merged}
          Merged into {s.renamed}. All profiles updated.
        {:else}
          Renamed to {s.renamed}. All profiles updated.
        {/if}
      </div>
    {/if}
    {#if s?.descSaved}<div class="form-ok" role="status">Description saved.</div>{/if}
    {#if s?.removed}<div class="form-ok" role="status">Removed.</div>{/if}
  {/if}

  <form
    method="POST"
    action="?/addUnion"
    class="add-form add-form-3"
    use:enhance={() => {
      busy = "addUnion";
      return async ({ update }) => {
        await update({ reset: true });
        busy = null;
      };
    }}
  >
    <label class="field">
      <span>Name</span>
      <input type="text" name="name" required placeholder="e.g. AGVA" />
    </label>
    <label class="field">
      <span>Description (optional)</span>
      <input type="text" name="description" placeholder="What it stands for" />
    </label>
    <label class="field">
      <span>Sort</span>
      <input type="number" name="sort_order" value="100" />
    </label>
    <button type="submit" class="bt bt-pri" disabled={busy === "addUnion"}>
      {busy === "addUnion" ? "Adding..." : "Add union"}
    </button>
  </form>

  <ul class="rows">
    {#each data.unions as u (u.id)}
      {@const count = data.counts.unions[u.name] ?? 0}
      {@const isOther = u.name === "Other"}
      <li class="row">
        <form
          method="POST"
          action="?/renameUnion"
          class="rename-form"
          use:enhance={() => {
            busy = `renameUnion-${u.id}`;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={u.id} />
          <input
            type="text"
            name="new_name"
            value={u.name}
            class="rename-input"
            disabled={isOther}
            title={isOther ? "Reserved for the free-text fallback option." : ""}
          />
          {#if !isOther}
            <button
              type="submit"
              class="bt-link"
              disabled={busy === `renameUnion-${u.id}`}>Save name</button
            >
          {/if}
        </form>

        <form
          method="POST"
          action="?/editUnionDescription"
          class="desc-form"
          use:enhance={() => {
            busy = `descUnion-${u.id}`;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={u.id} />
          <input
            type="text"
            name="description"
            value={u.description ?? ""}
            placeholder="Description (optional)"
            class="desc-input"
          />
          <button
            type="submit"
            class="bt-link"
            disabled={busy === `descUnion-${u.id}`}>Save desc</button
          >
        </form>

        <form
          method="POST"
          action="?/reorderUnion"
          class="inline-form"
          use:enhance={() => {
            busy = `sortUnion-${u.id}`;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={u.id} />
          <input
            type="number"
            name="sort_order"
            value={u.sort_order}
            class="num-input"
            title="Auto-saves when you tab away"
            onblur={(e) => autoSubmitSort(e, u.sort_order)}
          />
          <button type="submit" class="bt-link" disabled={busy === `sortUnion-${u.id}`}>
            Sort
          </button>
        </form>

        <span class="count" title="{count} profile{count === 1 ? '' : 's'} using">
          {count}
        </span>

        <form
          method="POST"
          action="?/removeUnion"
          use:enhance={() => {
            busy = `removeUnion-${u.id}`;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={u.id} />
          <button
            type="button"
            class="bt-link warn"
            disabled={busy === `removeUnion-${u.id}` || isOther}
            title={isOther ? "Reserved for the free-text fallback option." : ""}
            onclick={(e) => askRemove(e, u.name, "union", count)}>Remove</button
          >
        </form>
      </li>
    {/each}
  </ul>
</section>

<!-- ============================================================
     ETHNICITIES
     ============================================================ -->
<section class="block">
  <header class="block-hd">
    <h2 class="block-h">Ethnicities</h2>
    <p class="block-sub">
      The "Ethnicity" picker. Optional for artists; the form also has a
      free-text "Other" line that always works regardless of what's here.
    </p>
  </header>

  {#if statusFor("ethnicities")}
    {@const s = statusFor("ethnicities")}
    {#if s?.error}<div class="form-error" role="alert">{s.error}</div>{/if}
    {#if s?.added}<div class="form-ok" role="status">Added {s.added}.</div>{/if}
    {#if s?.renamed}
      <div class="form-ok" role="status">
        {#if s.merged}
          Merged into {s.renamed}. All profiles updated.
        {:else}
          Renamed to {s.renamed}. All profiles updated.
        {/if}
      </div>
    {/if}
    {#if s?.removed}<div class="form-ok" role="status">Removed.</div>{/if}
  {/if}

  <form
    method="POST"
    action="?/addEthnicity"
    class="add-form add-form-2"
    use:enhance={() => {
      busy = "addEthnicity";
      return async ({ update }) => {
        await update({ reset: true });
        busy = null;
      };
    }}
  >
    <label class="field">
      <span>Name</span>
      <input type="text" name="name" required placeholder="e.g. Caribbean" />
    </label>
    <label class="field">
      <span>Sort</span>
      <input type="number" name="sort_order" value="100" />
    </label>
    <button type="submit" class="bt bt-pri" disabled={busy === "addEthnicity"}>
      {busy === "addEthnicity" ? "Adding..." : "Add ethnicity"}
    </button>
  </form>

  <ul class="rows">
    {#each data.ethnicities as e (e.id)}
      {@const count = data.counts.ethnicities[e.name] ?? 0}
      <li class="row">
        <form
          method="POST"
          action="?/renameEthnicity"
          class="rename-form rename-form-wide"
          use:enhance={() => {
            busy = `renameEthnicity-${e.id}`;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={e.id} />
          <input type="text" name="new_name" value={e.name} class="rename-input" />
          <button
            type="submit"
            class="bt-link"
            disabled={busy === `renameEthnicity-${e.id}`}>Save name</button
          >
        </form>

        <form
          method="POST"
          action="?/reorderEthnicity"
          class="inline-form"
          use:enhance={() => {
            busy = `sortEthnicity-${e.id}`;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={e.id} />
          <input
            type="number"
            name="sort_order"
            value={e.sort_order}
            class="num-input"
            title="Auto-saves when you tab away"
            onblur={(ev) => autoSubmitSort(ev, e.sort_order)}
          />
          <button type="submit" class="bt-link" disabled={busy === `sortEthnicity-${e.id}`}>
            Sort
          </button>
        </form>

        <span class="count" title="{count} profile{count === 1 ? '' : 's'} using">
          {count}
        </span>

        <form
          method="POST"
          action="?/removeEthnicity"
          use:enhance={() => {
            busy = `removeEthnicity-${e.id}`;
            return async ({ update }) => {
              await update();
              busy = null;
            };
          }}
        >
          <input type="hidden" name="id" value={e.id} />
          <button
            type="button"
            class="bt-link warn"
            disabled={busy === `removeEthnicity-${e.id}`}
            onclick={(ev) => askRemove(ev, e.name, "ethnicity", count)}
            >Remove</button
          >
        </form>
      </li>
    {/each}
  </ul>
</section>

<ConfirmModal
  open={pendingForm !== null}
  title="Remove {pendingKind}?"
  body={pendingCount > 0
    ? `"${pendingName}" will no longer appear in the submission picker. ${pendingCount} existing profile${pendingCount === 1 ? "" : "s"} still tagged with it will keep the tag.`
    : `"${pendingName}" will no longer appear in the submission picker.`}
  confirmLabel="Remove"
  variant="warn"
  onConfirm={confirmRemove}
  onClose={cancelRemove}
/>

<style>
  .hd {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 800px;
    margin-bottom: 2rem;
  }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 16px;
    color: var(--muted);
    margin: 0 0 0.25rem;
  }
  .hint {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }
  .hint a { color: var(--accent); }

  .block {
    margin-bottom: 2.5rem;
  }
  .block-hd {
    margin-bottom: 0.75rem;
  }
  .block-h {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    font-size: 20px;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .block-sub {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 4px 0 0;
    max-width: 60ch;
  }

  .add-form {
    display: grid;
    gap: 8px;
    align-items: end;
    padding: 1rem;
    background: var(--paper);
    border-radius: var(--radius-lg);
    margin-bottom: 1rem;
  }
  .add-form-3 {
    grid-template-columns: 1fr 1.5fr 90px auto;
  }
  .add-form-2 {
    grid-template-columns: 1fr 90px auto;
  }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field span {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .field input {
    padding: 8px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg-raised);
  }
  .field input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }

  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    padding: 9px 16px;
    border-radius: var(--radius);
    border: 1px solid transparent;
    cursor: pointer;
  }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt:disabled { opacity: 0.5; cursor: progress; }

  .form-error {
    background: color-mix(in oklch, var(--error), var(--bg) 80%);
    border: 1px solid var(--error);
    color: var(--error);
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
    margin-bottom: 1rem;
  }
  .form-ok {
    background: color-mix(in oklch, var(--accent), var(--bg) 85%);
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
    margin-bottom: 1rem;
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-bottom: 1px solid var(--rule-soft);
    background: var(--bg-raised);
  }
  .row:last-child { border-bottom: 0; }

  .rename-form,
  .desc-form {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: 1 1 200px;
    min-width: 0;
  }
  .rename-form-wide { flex: 1 1 350px; }
  .rename-input,
  .desc-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg);
    min-width: 0;
  }
  .rename-input:focus,
  .desc-input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .rename-input:disabled {
    background: var(--paper);
    color: var(--muted);
    cursor: not-allowed;
  }

  .inline-form { display: inline-flex; align-items: center; gap: 4px; }
  .num-input {
    width: 4.5rem;
    padding: 4px 8px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
    min-width: 1.75rem;
    text-align: right;
  }

  .bt-link {
    background: none;
    border: 0;
    padding: 6px 10px;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
  }
  .bt-link.warn { color: var(--error); }
  .bt-link:hover:not(:disabled) { text-decoration: underline; }
  .bt-link:disabled { opacity: 0.4; cursor: not-allowed; }

  @media (max-width: 720px) {
    .add-form-3,
    .add-form-2 {
      grid-template-columns: 1fr;
    }
    .row {
      flex-direction: column;
      align-items: stretch;
    }
    .rename-form,
    .desc-form,
    .inline-form {
      flex: 1 1 auto;
    }
    .count {
      text-align: left;
    }
  }
</style>
