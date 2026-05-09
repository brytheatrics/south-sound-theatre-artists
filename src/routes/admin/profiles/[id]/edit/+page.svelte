<script lang="ts">
  import { enhance } from "$app/forms";
  import DisciplinePicker from "$lib/components/DisciplinePicker.svelte";
  import DisciplineOrder from "$lib/components/DisciplineOrder.svelte";
  import HeadshotUpload from "$lib/components/HeadshotUpload.svelte";
  import ResumesEditor from "$lib/components/ResumesEditor.svelte";
  import MultiResumeBuilder from "$lib/components/MultiResumeBuilder.svelte";
  import { telHref } from "$lib/util/phone";

  let { data, form } = $props();
  // svelte-ignore state_referenced_locally
  const p = data.profile;

  let fullName = $state(p.full_name);
  let slug = $state(p.slug);
  let email = $state(p.email);
  let phone = $state(p.phone ?? "");
  let pronouns = $state(p.pronouns ?? "");
  let bio = $state(p.bio ?? "");
  let headshotUrl = $state(p.headshot_url ?? "");
  // svelte-ignore state_referenced_locally
  const areaNames = data.areas.map((a) => a.name);
  // Empty or non-canonical area -> empty select (forces a real pick on
  // save). Canonical area -> pre-select that option. The non-canonical
  // case only happens for legacy rows from before we removed the
  // free-text "Specify area" input.
  // svelte-ignore state_referenced_locally
  let area = $state(
    p.geographic_area && areaNames.includes(p.geographic_area) ? p.geographic_area : "",
  );
  let city = $state(p.city ?? "");
  let resumes = $state<Array<{ label: string; url: string }>>(
    Array.isArray(p.resumes) ? p.resumes : [],
  );
  let mentorshipOffering = $state<Set<string>>(
    new Set(p.mentorship_offering ?? []),
  );
  let mentorshipSeeking = $state<Set<string>>(
    new Set(p.mentorship_seeking ?? []),
  );
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
  let adminNote = $state(p.admin_note ?? "");

  // Source of truth for disciplines is an ordered array since the
  // directory + homepage cards render the first two entries. The Set
  // is derived for the picker's checked state.
  const canonicalDisc = $derived(new Set(data.disciplines.map((d) => d.name)));
  let disciplineOrder = $state<string[]>([]);
  let disciplineOther = $state("");
  $effect(() => {
    const order: string[] = [];
    let other = "";
    for (const d of p.disciplines ?? []) {
      if (canonicalDisc.has(d)) order.push(d);
      else {
        if (!order.includes("Other")) order.push("Other");
        other = d;
      }
    }
    disciplineOrder = order;
    disciplineOther = other;
  });
  const selectedDisciplines = $derived(new Set(disciplineOrder));
  function toggleDiscipline(name: string) {
    disciplineOrder = disciplineOrder.includes(name)
      ? disciplineOrder.filter((d) => d !== name)
      : [...disciplineOrder, name];
  }

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

  const canonicalEth = new Set([
    "African American / Black",
    "Asian",
    "Hispanic / Latino",
    "Indigenous / Native American",
    "Middle Eastern / North African",
    "Pacific Islander",
    "White / European",
    "Multiracial / Mixed",
    "Prefer not to say",
  ]);
  let selectedEthnicities = $state<Set<string>>(new Set());
  let ethnicityOther = $state("");
  $effect(() => {
    const set = new Set<string>();
    let other = "";
    for (const e of p.ethnicities ?? []) {
      if (canonicalEth.has(e)) set.add(e);
      else other = e;
    }
    selectedEthnicities = set;
    ethnicityOther = other;
  });

  function toggleSet(set: Set<string>, value: string): Set<string> {
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return new Set(set);
  }

  let saving = $state(false);
  let sendingInvite = $state(false);
  const errors = $derived((form?.errors ?? {}) as Record<string, string>);
  // Any field-level validation issue (vs. the catch-all _form key). Used
  // to render a "couldn't save" banner near the submit button so a 400
  // doesn't look like a no-op when the per-field error is off-screen.
  const hasFieldErrors = $derived(
    Object.keys(errors).some((k) => k !== "_form"),
  );
</script>

<svelte:head>
  <title>Edit {p.full_name} - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · profiles · edit</span>
  <h1 class="h1-display">Edit profile.</h1>
  <p class="lede">
    Direct edit, no flagged-edit queue. Saves apply immediately to the
    public profile.
  </p>
  <div class="quick-links">
    <a class="bt bt-ghost" href="/admin/profiles">← All profiles</a>
    <a class="bt bt-ghost" href={`/artists/${p.slug}`} target="_blank" rel="noopener">View public ↗</a>
    <!-- Sends the artist a "we set up your profile, claim it" email
         with a fresh 24h edit link. For admin-created profiles (bulk
         import or /admin/profiles/new) where the artist hasn't yet
         been invited to manage their own page. -->
    <form
      method="POST"
      action="?/sendInvitation"
      class="inline-form"
      use:enhance={() => {
        sendingInvite = true;
        return async ({ update }) => {
          await update({ reset: false });
          sendingInvite = false;
        };
      }}
    >
      <button type="submit" class="bt bt-ghost" disabled={sendingInvite}>
        {sendingInvite ? "Sending..." : "Send invitation email →"}
      </button>
    </form>
  </div>
  {#if form?.saved}<div class="form-ok" role="status">Saved.</div>{/if}
  {#if form?.invitationSent}
    <div class="form-ok" role="status">
      Invitation email sent to {form.invitationSent}. Link expires in 24 hours.
    </div>
  {/if}
  {#if errors._form}<div class="form-error" role="alert">{errors._form}</div>{/if}

  <!-- Same complete-to-publish surface as /edit/[token]. Admin sees
       exactly what the artist will be prompted to fill in when they
       click their invitation link. Profile stays unpublished until
       these are resolved (whether by admin save here or artist save
       on the magic-link form). -->
  {#if data.missingFields.length > 0}
    <div class="incomplete-banner" role="status">
      <p class="incomplete-title">
        <strong>This profile won't be public until these are filled in.</strong>
      </p>
      <p class="incomplete-body">
        The artist sees the same list when they open their edit link.
        Saving with all required fields filled in auto-publishes the
        profile.
      </p>
      <ul class="incomplete-list">
        {#each data.missingFields as f (f)}
          <li>{f}</li>
        {/each}
      </ul>
    </div>
  {/if}
</header>

<form
  method="POST"
  action="?/save"
  class="ed"
  use:enhance={() => {
    saving = true;
    return async ({ update }) => {
      await update({ reset: false });
      saving = false;
    };
  }}
>
  <section class="row">
    <h2 class="block-h">Identity</h2>
    <label class="field">
      <span>Full name</span>
      <input name="full_name" type="text" bind:value={fullName} required aria-invalid={!!errors.full_name} />
      {#if errors.full_name}<span class="error">{errors.full_name}</span>{/if}
    </label>
    <div class="grid-2">
      <label class="field">
        <span>Slug</span>
        <input name="slug" type="text" bind:value={slug} required aria-invalid={!!errors.slug} />
        {#if errors.slug}<span class="error">{errors.slug}</span>{/if}
      </label>
      <label class="field">
        <span>Email (private)</span>
        <input name="email" type="email" bind:value={email} required aria-invalid={!!errors.email} />
        {#if errors.email}<span class="error">{errors.email}</span>{/if}
      </label>
    </div>
    <div class="grid-2">
      <label class="field">
        <span>
          Phone (private)
          {#if phone && telHref(phone)}
            <a class="tel-link" href={telHref(phone)}>tap to call</a>
          {/if}
        </span>
        <input name="phone" type="tel" autocomplete="tel" bind:value={phone} placeholder="253-555-0142" aria-invalid={!!errors.phone} />
        <span class="hint">Never rendered publicly. Used by theatres in casting / callback workflows.</span>
        {#if errors.phone}<span class="error">{errors.phone}</span>{/if}
      </label>
      <label class="field">
        <span>Pronouns</span>
        <input name="pronouns" type="text" bind:value={pronouns} placeholder="she/her" />
      </label>
    </div>
    <div class="grid-2">
      <label class="field">
        <span>Languages (comma-separated)</span>
        <input name="languages" type="text" bind:value={languages} placeholder="English, Spanish" />
      </label>
    </div>
  </section>

  <section class="row">
    <h2 class="block-h">Headshot/photo</h2>
    <HeadshotUpload bind:value={headshotUrl} />
    <input type="hidden" name="headshot_url" value={headshotUrl} />
  </section>

  <section class="row">
    <h2 class="block-h">Bio</h2>
    <label class="field">
      <span class="visually-hidden">Bio</span>
      <textarea name="bio" rows="6" bind:value={bio} placeholder="A short professional bio."></textarea>
    </label>
  </section>

  <section class="row">
    <h2 class="block-h">Resume builder</h2>
    <p class="hint">
      Multi-resume editor. Changes save as you type - they aren't part of
      the form's main Save button. Useful when an artist asks you to add
      / fix something on their behalf.
    </p>
    <MultiResumeBuilder
      initial={data.resumeSnapshot}
      apiBase={`/api/admin/profiles/${p.id}`}
    />
  </section>

  <section class="row">
    <h2 class="block-h">Resume PDFs</h2>
    <ResumesEditor bind:value={resumes} />
  </section>

  <section class="row">
    <h2 class="block-h">Disciplines</h2>
    <DisciplinePicker
      items={data.disciplines}
      categoryOrder={data.disciplineCategories}
      selected={selectedDisciplines}
      selectedOrder={disciplineOrder}
      onToggle={toggleDiscipline}
      otherValue={disciplineOther}
      onOtherChange={(v) => (disciplineOther = v)}
      inputName="disciplines"
      error={errors.disciplines}
    />
    <DisciplineOrder
      value={disciplineOrder}
      otherLabel={disciplineOther}
      onChange={(next) => (disciplineOrder = next)}
    />
    <input type="hidden" name="discipline_other" value={disciplineOther} />
  </section>

  <section class="row">
    <h2 class="block-h">Mentorship</h2>
    <p style="margin: 0; font-family: var(--font-body); font-size: 13px; color: var(--muted);">
      Open to mentoring in
    </p>
    <DisciplinePicker
      items={data.disciplines}
      categoryOrder={data.disciplineCategories}
      selected={mentorshipOffering}
      onToggle={(n) => (mentorshipOffering = toggleSet(mentorshipOffering, n))}
      inputName="mentorship_offering"
      showOtherInput={false}
    />
    <p style="margin: 0.5rem 0 0; font-family: var(--font-body); font-size: 13px; color: var(--muted);">
      Looking to learn
    </p>
    <DisciplinePicker
      items={data.disciplines}
      categoryOrder={data.disciplineCategories}
      selected={mentorshipSeeking}
      onToggle={(n) => (mentorshipSeeking = toggleSet(mentorshipSeeking, n))}
      inputName="mentorship_seeking"
      showOtherInput={false}
    />
  </section>

  <section class="row">
    <h2 class="block-h">Area</h2>
    <div class="chip-row">
      <!-- The areas table already includes an "Other" row (seeded by
           mig 004), so the loop renders it. We don't add a hardcoded
           fallback here - that would produce two "Other" chips. -->
      {#each data.areas as a (a.name)}
        <label class="chip-label" title={a.description ?? ""}>
          <input
            type="radio"
            name="area"
            value={a.name}
            checked={area === a.name}
            onchange={() => (area = a.name)}
          />
          <span class="chip" class:on={area === a.name}>{a.name}</span>
        </label>
      {/each}
    </div>
    {#if errors.area}<span class="error">{errors.area}</span>{/if}

    <label class="field">
      <span>City</span>
      <input name="city" type="text" bind:value={city} placeholder="Lakewood" />
    </label>
  </section>

  <section class="row">
    <h2 class="block-h">Playable age</h2>
    <div class="age-row">
      <input name="playable_age_min" type="number" min="0" max="120" bind:value={playableAgeMin} placeholder="from" />
      <span class="dash" aria-hidden="true">to</span>
      <input name="playable_age_max" type="number" min="0" max="120" bind:value={playableAgeMax} placeholder="to" />
    </div>
    {#if errors.playable_age}<span class="error">{errors.playable_age}</span>{/if}
  </section>

  <section class="row">
    <h2 class="block-h">Unions</h2>
    <div class="chip-row">
      {#each data.unions as u (u.name)}
        <label class="chip-label">
          <input
            type="checkbox"
            name="unions"
            value={u.name}
            checked={selectedUnions.has(u.name)}
            onchange={() => (selectedUnions = toggleSet(selectedUnions, u.name))}
          />
          <span class="chip" class:on={selectedUnions.has(u.name)}>{u.name}</span>
        </label>
      {/each}
    </div>
    {#if selectedUnions.has("Other")}
      <label class="field">
        <span>Specify union</span>
        <input name="union_other" type="text" bind:value={unionOther} />
      </label>
    {/if}
  </section>

  <section class="row">
    <h2 class="block-h">Ethnicities</h2>
    <div class="chip-row">
      {#each data.options.ethnicity as e (e)}
        <label class="chip-label">
          <input
            type="checkbox"
            name="ethnicities"
            value={e}
            checked={selectedEthnicities.has(e)}
            onchange={() => (selectedEthnicities = toggleSet(selectedEthnicities, e))}
          />
          <span class="chip" class:on={selectedEthnicities.has(e)}>{e}</span>
        </label>
      {/each}
    </div>
    <label class="field">
      <span>Other ethnicity (optional)</span>
      <input name="ethnicity_other" type="text" bind:value={ethnicityOther} />
    </label>
  </section>

  <section class="row">
    <h2 class="block-h">Links</h2>
    <div class="grid-2">
      <label class="field">
        <span>Website</span>
        <input name="website" type="text" bind:value={website} placeholder="https://example.com" />
      </label>
      <label class="field">
        <span>Instagram</span>
        <input name="instagram" type="text" bind:value={instagram} placeholder="@handle" />
      </label>
      <label class="field">
        <span>TikTok</span>
        <input name="tiktok" type="text" bind:value={tiktok} placeholder="@handle" />
      </label>
      <label class="field">
        <span>X / Twitter</span>
        <input name="twitter" type="text" bind:value={twitter} placeholder="@handle" />
      </label>
      <label class="field">
        <span>Facebook URL</span>
        <input name="facebook" type="text" bind:value={facebook} placeholder="https://facebook.com/..." />
      </label>
      <label class="field">
        <span>LinkedIn URL</span>
        <input name="linkedin" type="text" bind:value={linkedin} placeholder="https://linkedin.com/in/..." />
      </label>
      <label class="field">
        <span>YouTube URL</span>
        <input name="youtube" type="text" bind:value={youtube} placeholder="https://youtube.com/..." />
      </label>
    </div>
  </section>

  <fieldset class="admin-note-block">
    <legend>Admin note (private)</legend>
    <p class="admin-note-help">
      Free-form context for other admins. Useful when a profile is
      unpublished, hidden, or in trash so the next person knows why.
      Never shown to the public.
    </p>
    <textarea
      name="admin_note"
      rows="3"
      bind:value={adminNote}
      placeholder="e.g. Hidden 2026-05-08 - reported for repeated harassment in callboard comments. Re-evaluate after 6 months."
    ></textarea>
  </fieldset>

  <div class="actions">
    <!-- Same banners we render in the header, repeated here so feedback
         lands next to the click on long forms. Without this the only
         "Saved." banner is at the top of the page and a ~2000px-down
         click looked like a no-op. -->
    {#if form?.saved}<div class="form-ok" role="status">Saved.</div>{/if}
    {#if errors._form}<div class="form-error" role="alert">{errors._form}</div>{/if}
    {#if hasFieldErrors && !errors._form}
      <div class="form-error" role="alert">
        Couldn't save - one or more fields above need attention.
      </div>
    {/if}
    <button type="submit" class="bt bt-pri" disabled={saving}>
      {saving ? "Saving..." : "Save changes"}
    </button>
  </div>
</form>

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
    margin: 0 0 0.5rem;
  }
  .quick-links {
    display: flex;
    gap: 8px;
    margin: 0 0 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }
  /* Forms inside .quick-links should behave like their child button -
     no extra block-level layout, no margin. */
  .quick-links :global(form.inline-form) {
    display: inline;
    margin: 0;
    padding: 0;
  }
  .bt {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    padding: 8px 14px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    line-height: 1.2;
  }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover:not(:disabled) { background: var(--accent); }
  .bt-pri:disabled { opacity: 0.5; cursor: progress; }
  .bt-ghost {
    background: transparent;
    color: var(--ink);
    border-color: var(--rule);
  }
  .bt-ghost:hover { border-color: var(--ink); text-decoration: none; }

  .form-ok {
    background: color-mix(in oklch, var(--accent), var(--bg) 85%);
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
  }
  .form-error {
    background: color-mix(in oklch, var(--warn), var(--bg) 80%);
    border: 1px solid var(--warn);
    color: var(--warn);
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
  }

  /* Mirrors /edit/[token]'s complete-to-publish gate banner. */
  .incomplete-banner {
    background: color-mix(in oklch, var(--warn), var(--bg) 88%);
    border: 1px solid color-mix(in oklch, var(--warn), var(--bg) 60%);
    border-left: 4px solid var(--warn);
    padding: 14px 18px;
    border-radius: var(--radius);
    margin: 1rem 0 0;
    color: var(--ink);
  }
  .incomplete-title {
    margin: 0 0 6px;
    font-family: var(--font-body);
    font-size: 15px;
  }
  .incomplete-body {
    margin: 0 0 8px;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
  }
  .incomplete-list {
    margin: 0;
    padding-left: 22px;
    font-family: var(--font-body);
    font-size: 14px;
  }
  .incomplete-list li {
    margin: 2px 0;
  }

  .ed {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
    max-width: 800px;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .block-h {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 0;
    font-weight: 500;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field span {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .field input,
  .field textarea {
    padding: 9px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 14px;
    font-family: var(--font-body);
    background: var(--bg-raised);
    color: var(--ink);
  }
  .field input:focus,
  .field textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .field textarea {
    resize: vertical;
    min-height: 120px;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip-label input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    padding: 5px 11px;
    border-radius: 100px;
    border: 1px solid var(--rule);
    font-family: var(--font-body);
    font-size: 12px;
    cursor: pointer;
    line-height: 1.2;
    user-select: none;
    color: var(--ink-soft);
    background: transparent;
  }
  .chip:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .chip.on {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }

  .age-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .age-row input {
    flex: 0 1 110px;
    padding: 9px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 14px;
    font-family: var(--font-body);
    background: var(--bg-raised);
    color: var(--ink);
  }
  .age-row input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .age-row .dash {
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .error {
    color: var(--error);
    font-size: 13px;
    font-family: var(--font-body);
    margin-top: 4px;
    text-transform: none;
    letter-spacing: 0;
  }
  .tel-link {
    margin-left: 8px;
    font-size: 12px;
    text-transform: none;
    letter-spacing: 0;
    color: var(--accent);
    font-weight: 500;
  }
  .hint {
    display: block;
    font-size: 12px;
    color: var(--muted);
    margin-top: 4px;
    text-transform: none;
    letter-spacing: 0;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .admin-note-block {
    margin: 1.5rem 0 0.5rem;
    padding: 1rem 1.1rem 1rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .admin-note-block legend {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    padding: 0 0.4em;
  }
  .admin-note-help {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.5;
  }
  .admin-note-block textarea {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.55;
    resize: vertical;
  }
</style>
