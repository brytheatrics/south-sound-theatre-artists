<script lang="ts">
  import { enhance } from "$app/forms";
  import DisciplinePicker from "$lib/components/DisciplinePicker.svelte";
  import DisciplineOrder from "$lib/components/DisciplineOrder.svelte";
  import HeadshotUpload from "$lib/components/HeadshotUpload.svelte";
  import ResumesEditor from "$lib/components/ResumesEditor.svelte";
  import ResumeBuilder from "$lib/components/ResumeBuilder.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";

  type ResumeData = {
    credits: Array<{ show: string; role: string; company: string; director?: string; year?: string; notes?: string }>;
    training: Array<{ title: string; institution: string; year?: string; notes?: string }>;
    skills: Array<{ category: string; items: string }>;
  };

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
  // Empty or non-canonical area -> empty select (forces a real pick on
  // save). Canonical area -> pre-select that option. The non-canonical
  // case only happens for legacy rows from before we removed the
  // free-text "Specify area" input; new submissions can't reach it.
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
  let resumeData = $state<ResumeData>(
    p.resume_data && typeof p.resume_data === "object"
      ? {
          credits: Array.isArray(p.resume_data.credits) ? p.resume_data.credits : [],
          training: Array.isArray(p.resume_data.training) ? p.resume_data.training : [],
          skills: Array.isArray(p.resume_data.skills) ? p.resume_data.skills : [],
        }
      : { credits: [], training: [], skills: [] },
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
  // svelte-ignore state_referenced_locally
  let subscribeDigest = $state(data.digestSubscribed);

  // Disciplines: walk the array. Anything not in the canonical list becomes
  // the "Other" + custom-text combo so the picker handles it. Source of
  // truth is an ordered array since the directory + homepage cards
  // render the first two entries; users control display order via
  // DisciplineOrder.
  const canonical = $derived(new Set(data.disciplines.map((d) => d.name)));
  let disciplineOrder = $state<string[]>([]);
  let disciplineOther = $state("");
  $effect(() => {
    const order: string[] = [];
    let other = "";
    for (const d of p.disciplines ?? []) {
      if (canonical.has(d)) order.push(d);
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

  // Minor profile graduation: a small dedicated form posts to ?/graduate
  // when the parent / guardian (or now-18 artist) confirms the artist
  // has turned 18. After graduation the headshot upload becomes
  // visible and contact-form messages route to whoever owns the email
  // on the row from that point on.
  let confirmingGraduate = $state(false);
  let graduateFormEl: HTMLFormElement | undefined = $state();
  let graduating = $state(false);

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

  <!-- Complete-to-publish gate. Bulk-imported profiles ship unpublished
       when they're missing required info; this banner spells out exactly
       what the artist needs to fill in. Once they save with everything
       complete, the action flips published=true automatically. -->
  {#if data.missingFields.length > 0}
    <div class="incomplete-banner" role="status">
      <p class="incomplete-title">
        <strong>Your profile isn't visible to the public yet.</strong>
      </p>
      <p class="incomplete-body">
        Please fill in the following before saving and your profile will
        be published immediately:
      </p>
      <ul class="incomplete-list">
        {#each data.missingFields as f (f)}
          <li>{f}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if p.is_minor}
    <!-- Minor profile banner: parent/guardian-managed today. When the
         artist turns 18, a click here flips is_minor=false, clears the
         guardian fields, and unlocks the headshot upload. -->
    <div class="minor-banner" role="status">
      <p class="minor-title">
        <strong>This is a parent / guardian-managed profile.</strong>
      </p>
      <p class="minor-body">
        Because the artist is under 18, the headshot is hidden publicly
        and contact-form messages route to
        {p.guardian_name ? p.guardian_name : "the parent or guardian"}.
        Once they turn 18 you can switch this off and a real headshot
        becomes available.
      </p>
      <button
        type="button"
        class="bt bt-pri minor-graduate-btn"
        onclick={() => (confirmingGraduate = true)}
      >
        This artist is now 18 →
      </button>
    </div>

    <!-- Hidden form that the modal's onConfirm will requestSubmit().
         use:enhance keeps the post in-page so we can flash a friendly
         success message + reload data without a full nav. -->
    <form
      method="POST"
      action="?/graduate"
      bind:this={graduateFormEl}
      use:enhance={() => {
        graduating = true;
        return async ({ update }) => {
          // reset:false because we don't want SvelteKit clearing the
          // big edit form's fields when this small action returns.
          await update({ reset: false });
          graduating = false;
          confirmingGraduate = false;
        };
      }}
      class="hidden-form"
    ></form>

    <ConfirmModal
      open={confirmingGraduate}
      title="Confirm: this artist has turned 18"
      body="This will switch the profile from parent / guardian-managed to artist-managed. The headshot upload will become available, and the parent / guardian's contact details will be cleared from the profile. The contact email stays as it is - you can update it from this same form afterwards. This can't be undone from this page (an admin would have to flip it back)."
      confirmLabel={graduating ? "Updating..." : "Yes, the artist is 18"}
      cancelLabel="Cancel"
      onConfirm={() => graduateFormEl?.requestSubmit()}
      onClose={() => { if (!graduating) confirmingGraduate = false; }}
    />
  {/if}

  {#if form?.graduated}
    <div class="form-ok" role="status">
      Profile is now artist-managed. You can upload a headshot below.
    </div>
  {/if}

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

    {#if !p.is_minor}
      <fieldset>
        <legend>Headshot/photo <span class="req">*</span></legend>
        <p class="hint">
          Required. Doesn't need to be a professional headshot - any clear
          photo of you works.
        </p>
        <HeadshotUpload bind:value={headshotUrl} />
        <input type="hidden" name="headshot_url" value={headshotUrl} />
        {#if errors.headshot_url}<span class="error">{errors.headshot_url}</span>{/if}
        {#if headshotUrl}
          <label class="checkbox">
            <input type="checkbox" name="headshot_consent" bind:checked={headshotConsent} />
            <span>I confirm I have the rights to use this image.</span>
          </label>
          {#if errors.headshot_consent}<span class="error">{errors.headshot_consent}</span>{/if}
        {/if}
      </fieldset>
    {:else}
      <!-- Minor profiles don't display a headshot. The graduation flow
           above unlocks this fieldset once the artist turns 18. -->
      <fieldset class="minor-headshot-stub">
        <legend>Headshot/photo</legend>
        <p class="hint">
          Hidden for minor profiles. Once the artist turns 18, click
          the button at the top of the page to unlock headshot upload.
        </p>
      </fieldset>
    {/if}

    <fieldset>
      <legend>Bio</legend>
      <p class="hint">
        Optional. What collaborators should know - training, recent work,
        what you're looking for. A few sentences is plenty.
      </p>
      <textarea name="bio" rows="5" bind:value={bio}></textarea>
    </fieldset>

    <fieldset>
      <legend>Resume builder</legend>
      <p class="hint">
        Optional. Fill in any sections that apply.
      </p>
      <ResumeBuilder bind:value={resumeData} />
    </fieldset>

    <fieldset>
      <legend>Resume PDFs</legend>
      <p class="hint">
        Optional. Add one or more PDF resumes - label each so casting
        can pick the right one.
      </p>
      <ResumesEditor bind:value={resumes} />
    </fieldset>

    <fieldset>
      <legend>Disciplines</legend>
      <DisciplinePicker
        items={data.disciplines}
        categoryOrder={data.disciplineCategories}
        selected={selectedDisciplines}
        selectedOrder={disciplineOrder}
        onToggle={toggleDiscipline}
        otherValue={disciplineOther}
        onOtherChange={(v) => (disciplineOther = v)}
        error={errors.disciplines}
      />
      <DisciplineOrder
        value={disciplineOrder}
        otherLabel={disciplineOther}
        onChange={(next) => (disciplineOrder = next)}
      />
    </fieldset>

    <fieldset>
      <legend>Mentorship</legend>
      <p class="hint">
        Optional. Visible on your profile and filterable on the directory.
      </p>
      <h3 class="field-label" style="margin-top: 0.5rem">Open to mentoring in</h3>
      <DisciplinePicker
        items={data.disciplines}
        categoryOrder={data.disciplineCategories}
        selected={mentorshipOffering}
        onToggle={(n) => (mentorshipOffering = toggleSet(mentorshipOffering, n))}
        inputName="mentorship_offering"
        showOtherInput={false}
      />
      <h3 class="field-label" style="margin-top: 1rem">Looking to learn</h3>
      <DisciplinePicker
        items={data.disciplines}
        categoryOrder={data.disciplineCategories}
        selected={mentorshipSeeking}
        onToggle={(n) => (mentorshipSeeking = toggleSet(mentorshipSeeking, n))}
        inputName="mentorship_seeking"
        showOtherInput={false}
      />
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


      <label class="field">
        <span>City</span>
        <input name="city" type="text" bind:value={city} placeholder="Lakewood" autocomplete="address-level2" />
        <span class="hint">Optional. Shown on your profile in addition to the region above.</span>
      </label>

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

    <fieldset>
      <legend>Email preferences</legend>
      <label class="check-row">
        <input
          type="checkbox"
          name="subscribe_digest"
          bind:checked={subscribeDigest}
        />
        <span class="check-text">
          <strong>Send me a weekly callboard digest</strong>
          <span class="check-hint">
            Sunday evening email of new callboard posts matching the
            disciplines on your profile. Skips weeks with nothing new.
            Unsubscribe any time from a one-click link in the email.
          </span>
        </span>
      </label>
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
  .check-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    cursor: pointer;
  }
  .check-row input[type="checkbox"] {
    margin-top: 3px;
    accent-color: var(--accent);
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .check-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
    line-height: 1.5;
  }
  .check-hint {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.5;
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
  .form-ok {
    background: color-mix(in oklch, var(--accent), var(--bg) 88%);
    border: 1px solid color-mix(in oklch, var(--accent), var(--bg) 60%);
    border-left: 4px solid var(--accent);
    color: var(--ink);
    padding: 12px 16px;
    border-radius: var(--radius);
    margin: 0 0 1.5rem;
    font-size: 14px;
  }
  /* Minor profile banner: parent/guardian-managed status + the
     "graduate to 18" button. Accent-tinted to read as informational
     rather than warning. */
  .minor-banner {
    background: color-mix(in oklch, var(--accent), var(--bg) 92%);
    border: 1px solid color-mix(in oklch, var(--accent), var(--bg) 70%);
    border-left: 4px solid var(--accent);
    padding: 14px 18px;
    border-radius: var(--radius);
    margin: 0 0 1.5rem;
    color: var(--ink);
  }
  .minor-title {
    margin: 0 0 6px;
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--ink);
  }
  .minor-body {
    margin: 0 0 12px;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
    line-height: 1.5;
  }
  .minor-graduate-btn {
    align-self: flex-start;
  }
  .hidden-form { display: none; }
  .minor-headshot-stub { opacity: 0.7; }

  /* Complete-to-publish gate banner. Warmer rust panel so it reads as
     "needs attention" without looking like a hard error. */
  .incomplete-banner {
    background: color-mix(in oklch, var(--warn), var(--bg) 88%);
    border: 1px solid color-mix(in oklch, var(--warn), var(--bg) 60%);
    border-left: 4px solid var(--warn);
    padding: 14px 18px;
    border-radius: var(--radius);
    margin: 0 0 1.5rem;
    color: var(--ink);
  }
  .incomplete-title {
    margin: 0 0 6px;
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--ink);
  }
  .incomplete-body {
    margin: 0 0 8px;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
  }
  .incomplete-list {
    margin: 0;
    padding-left: 22px;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
  }
  .incomplete-list li {
    margin: 2px 0;
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
