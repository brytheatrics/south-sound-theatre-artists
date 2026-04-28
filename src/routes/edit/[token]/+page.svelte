<script lang="ts">
  import { enhance } from "$app/forms";
  import DisciplinePicker from "$lib/components/DisciplinePicker.svelte";
  import HeadshotUpload from "$lib/components/HeadshotUpload.svelte";

  let { data, form } = $props();
  // svelte-ignore state_referenced_locally
  const p = data.profile;

  let fullName = $state(p.full_name);
  let pronouns = $state(p.pronouns ?? "");
  let bio = $state(p.bio ?? "");
  let headshotUrl = $state(p.headshot_url ?? "");
  let headshotConsent = $state(p.headshot_consent ?? false);
  // svelte-ignore state_referenced_locally
  const areaNames = data.areas.map((a) => a.name);
  // svelte-ignore state_referenced_locally
  let area = $state(areaNames.includes(p.geographic_area) ? p.geographic_area : "Other");
  // svelte-ignore state_referenced_locally
  let areaOther = $state(areaNames.includes(p.geographic_area) ? "" : (p.geographic_area ?? ""));
  let playableAgeMin = $state(p.playable_age_min?.toString() ?? "");
  let playableAgeMax = $state(p.playable_age_max?.toString() ?? "");
  let languages = $state((p.languages ?? []).join(", "));
  let instagram = $state(p.instagram_handle ?? "");
  let facebook = $state(p.facebook_url ?? "");
  let tiktok = $state(p.tiktok_handle ?? "");
  let linkedin = $state(p.linkedin_url ?? "");
  let twitter = $state(p.twitter_handle ?? "");
  let youtube = $state(p.youtube_url ?? "");
  let website = $state(p.website_url ?? "");

  // Disciplines: walk the array. Anything not in the canonical list becomes
  // the "Other" + custom-text combo so the picker handles it.
  const canonical = $derived(new Set(data.disciplines.map((d) => d.name)));
  let selectedDisciplines = $state<Set<string>>(new Set());
  let disciplineOther = $state("");
  $effect(() => {
    const set = new Set<string>();
    let other = "";
    for (const d of p.disciplines ?? []) {
      if (canonical.has(d)) set.add(d);
      else {
        set.add("Other");
        other = d;
      }
    }
    selectedDisciplines = set;
    disciplineOther = other;
  });

  const canonicalUnions = $derived(new Set(data.unions.map((u) => u.name)));
  let selectedUnions = $state<Set<string>>(new Set());
  let unionOther = $state("");
  $effect(() => {
    const set = new Set<string>();
    let other = "";
    for (const u of p.unions ?? []) {
      if (canonicalUnions.has(u)) set.add(u);
      else {
        set.add("Other");
        other = u;
      }
    }
    selectedUnions = set;
    unionOther = other;
  });

  const canonicalEthnicities = $derived(new Set(data.options.ethnicity));
  let selectedEthnicities = $state<Set<string>>(new Set());
  let ethnicityOther = $state("");
  $effect(() => {
    const set = new Set<string>();
    let other = "";
    for (const e of p.ethnicities ?? []) {
      if (canonicalEthnicities.has(e)) set.add(e);
      else other = e;
    }
    selectedEthnicities = set;
    ethnicityOther = other;
  });

  let submitting = $state(false);

  function toggleSet(set: Set<string>, value: string): Set<string> {
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return new Set(set);
  }

  const errors = $derived((form?.errors ?? {}) as Record<string, string>);
</script>

<svelte:head>
  <title>Edit your profile - SSTA</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <header class="hd">
    <span class="eyebrow"><span class="num">→</span>Edit profile</span>
    <h1 class="h1-display">
      Update your <span class="serif-it">page</span>.
    </h1>
    <p class="intro">
      Editing <strong>{p.full_name}</strong> · <code>/artists/{p.slug}</code>.
      Changes go live as soon as you save. The link is single-use - request
      a fresh one any time from <a href="/edit-link">edit-link</a>.
    </p>
  </header>

  {#if errors._form}
    <div class="form-error" role="alert">{errors._form}</div>
  {/if}

  <form
    method="POST"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update({ reset: false });
        submitting = false;
      };
    }}
  >
    <fieldset>
      <legend>Identity</legend>

      <label class="field">
        <span>Full name</span>
        <input name="full_name" type="text" required bind:value={fullName} />
        {#if errors.full_name}<span class="error">{errors.full_name}</span>{/if}
      </label>

      <label class="field">
        <span>Pronouns</span>
        <input name="pronouns" type="text" bind:value={pronouns} placeholder="she/her, they/them, etc." />
      </label>
    </fieldset>

    <fieldset>
      <legend>Headshot</legend>
      <p class="hint">Optional. Helps casting directors put a face to a name.</p>
      <HeadshotUpload bind:value={headshotUrl} />
      <input type="hidden" name="headshot_url" value={headshotUrl} />
      {#if headshotUrl}
        <label class="checkbox">
          <input type="checkbox" name="headshot_consent" bind:checked={headshotConsent} />
          <span>I confirm I have the rights to use this image.</span>
        </label>
        {#if errors.headshot_consent}<span class="error">{errors.headshot_consent}</span>{/if}
      {/if}
    </fieldset>

    <fieldset>
      <legend>Disciplines</legend>
      <DisciplinePicker
        items={data.disciplines}
        categoryOrder={data.disciplineCategories}
        selected={selectedDisciplines}
        onToggle={(n) => (selectedDisciplines = toggleSet(selectedDisciplines, n))}
        otherValue={disciplineOther}
        onOtherChange={(v) => (disciplineOther = v)}
        error={errors.disciplines}
      />
    </fieldset>

    <fieldset>
      <legend>Bio</legend>
      <p class="hint">
        Optional. What collaborators should know - training, recent work,
        what you're looking for. A few sentences is plenty.
      </p>
      <textarea name="bio" rows="5" bind:value={bio}></textarea>
    </fieldset>

    <fieldset>
      <legend>Casting details</legend>

      <label class="field">
        <span>Area</span>
        <select name="area" bind:value={area} required>
          <option value="">Choose</option>
          {#each data.areas as opt}<option value={opt.name}>{opt.name}{opt.description ? ` - ${opt.description}` : ""}</option>{/each}
        </select>
        {#if errors.area}<span class="error">{errors.area}</span>{/if}
      </label>

      {#if area === "Other"}
        <label class="field">
          <span>Specify area</span>
          <input name="area_other" type="text" bind:value={areaOther} />
          {#if errors.area_other}<span class="error">{errors.area_other}</span>{/if}
        </label>
      {/if}

      <div class="field">
        <span class="field-label">Playable age range</span>
        <div class="age-row">
          <span>From</span>
          <input name="playable_age_min" type="number" min="0" max="120" bind:value={playableAgeMin} />
          <span>to</span>
          <input name="playable_age_max" type="number" min="0" max="120" bind:value={playableAgeMax} />
        </div>
        <span class="hint">Optional. The range of ages you can convincingly play.</span>
        {#if errors.playable_age}<span class="error">{errors.playable_age}</span>{/if}
      </div>

      <label class="field">
        <span>Languages spoken</span>
        <input name="languages" type="text" bind:value={languages} placeholder="English, Spanish, ASL" />
        <span class="hint">Comma-separated.</span>
      </label>
    </fieldset>

    <fieldset>
      <legend>Unions</legend>
      <p class="hint">Optional. Pick all that apply.</p>
      <div class="checkbox-grid">
        {#each data.unions as u}
          <label class="checkbox">
            <input
              type="checkbox"
              name="unions"
              value={u.name}
              checked={selectedUnions.has(u.name)}
              onchange={() => (selectedUnions = toggleSet(selectedUnions, u.name))}
            />
            <span>
              <strong>{u.name}</strong>
              {#if u.description}<span class="union-desc"> - {u.description}</span>{/if}
            </span>
          </label>
        {/each}
      </div>
      {#if selectedUnions.has("Other")}
        <label class="field" style="margin-top: 0.75rem">
          <span>Specify union</span>
          <input name="union_other" type="text" bind:value={unionOther} />
        </label>
      {/if}
    </fieldset>

    <fieldset>
      <legend>Ethnicity</legend>
      <p class="hint">
        Optional. Used for casting that calls for specific representation.
        Pick all that apply.
      </p>
      <div class="checkbox-grid">
        {#each data.options.ethnicity as opt}
          <label class="checkbox">
            <input
              type="checkbox"
              name="ethnicities"
              value={opt}
              checked={selectedEthnicities.has(opt)}
              onchange={() => (selectedEthnicities = toggleSet(selectedEthnicities, opt))}
            />
            <span>{opt}</span>
          </label>
        {/each}
      </div>
      <label class="field">
        <span>Add another (optional)</span>
        <input name="ethnicity_other" type="text" bind:value={ethnicityOther} />
      </label>
    </fieldset>

    <fieldset>
      <legend>Links</legend>
      <label class="field"><span>Personal website</span><input name="website" type="url" bind:value={website} /></label>
      <label class="field"><span>Instagram handle</span><input name="instagram" type="text" bind:value={instagram} /></label>
      <label class="field"><span>TikTok handle</span><input name="tiktok" type="text" bind:value={tiktok} /></label>
      <label class="field"><span>X / Twitter handle</span><input name="twitter" type="text" bind:value={twitter} /></label>
      <label class="field"><span>Facebook URL</span><input name="facebook" type="url" bind:value={facebook} /></label>
      <label class="field"><span>LinkedIn URL</span><input name="linkedin" type="url" bind:value={linkedin} /></label>
      <label class="field"><span>YouTube URL</span><input name="youtube" type="url" bind:value={youtube} /></label>
    </fieldset>

    <button type="submit" class="submit" disabled={submitting}>
      {submitting ? "Saving..." : "Save changes"}
    </button>
  </form>
</main>

<style>
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: clamp(2rem, 4vw, 3rem) var(--page-pad-x) 4rem;
  }
  .hd {
    margin-bottom: 2rem;
  }
  .h1-display {
    margin: 0.5rem 0 1rem;
  }
  .intro {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.6;
    color: var(--ink-soft);
    margin: 0;
  }
  .intro code {
    font-family: var(--font-mono);
    font-size: 12px;
    background: var(--paper);
    padding: 1px 6px;
    border-radius: 3px;
  }
  form {
    counter-reset: section;
  }
  fieldset {
    border: 0;
    border-top: 1px solid var(--rule);
    padding: 2rem 0;
    margin: 0;
    counter-increment: section;
  }
  fieldset:last-of-type {
    border-bottom: 1px solid var(--rule);
  }
  legend {
    padding: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink);
    font-weight: 500;
    margin-bottom: 1.5rem;
  }
  legend::before {
    content: counter(section, decimal-leading-zero) " ";
    color: var(--accent);
    margin-right: 0.6em;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 1.25rem;
  }
  .field > span:first-child,
  .field-label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  input[type="text"],
  input[type="url"],
  input[type="number"],
  textarea,
  select {
    padding: 10px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 15px;
    font-family: var(--font-body);
    background: var(--bg-raised);
  }
  input:focus,
  textarea:focus,
  select:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  textarea {
    resize: vertical;
    min-height: 140px;
  }
  .age-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .age-row input {
    width: 5rem;
  }
  .age-row span {
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .hint {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .error {
    color: var(--error);
    font-size: 13px;
    margin-top: 4px;
  }
  .form-error {
    background: color-mix(in oklch, var(--warn), var(--bg) 80%);
    border: 1px solid var(--warn);
    color: var(--warn);
    padding: 12px 16px;
    border-radius: var(--radius);
    margin-bottom: 1.5rem;
  }
  .checkbox-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px 16px;
  }
  .checkbox {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    padding: 4px 0;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
  }
  .checkbox input {
    margin: 4px 0 0;
    accent-color: var(--accent);
  }
  .union-desc {
    color: var(--muted);
    font-weight: normal;
    font-size: 13px;
  }
  .submit {
    background: var(--ink);
    color: var(--bg);
    border: 1px solid var(--ink);
    padding: 14px 24px;
    border-radius: var(--radius);
    font-size: 15px;
    font-family: var(--font-body);
    font-weight: 500;
    cursor: pointer;
    width: 100%;
    margin-top: 2rem;
  }
  .submit:hover:not(:disabled) {
    background: var(--accent);
    border-color: var(--accent);
  }
  .submit:disabled {
    opacity: 0.5;
    cursor: progress;
  }
</style>
