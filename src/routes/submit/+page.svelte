<script lang="ts">
  import { enhance } from "$app/forms";
  import DisciplinePicker from "$lib/components/DisciplinePicker.svelte";
  import DisciplineOrder from "$lib/components/DisciplineOrder.svelte";
  import HeadshotUpload from "$lib/components/HeadshotUpload.svelte";
  import ResumesEditor from "$lib/components/ResumesEditor.svelte";
  import ResumeBuilder from "$lib/components/ResumeBuilder.svelte";

  type ResumeData = {
    credits: Array<{ show: string; role: string; company: string; director?: string; year?: string; notes?: string }>;
    training: Array<{ title: string; institution: string; year?: string; notes?: string }>;
    skills: Array<{ category: string; items: string }>;
  };
  import SlugCollisionModal from "$lib/components/SlugCollisionModal.svelte";
  import { slugify } from "$lib/util/slug";

  let { data, form } = $props();

  type FormValues = {
    fullName?: string;
    email?: string;
    slug?: string;
    bio?: string;
    pronouns?: string;
    headshotUrl?: string;
    headshotConsent?: boolean;
    isMinor?: boolean;
    guardianEmail?: string;
    guardianName?: string;
    area?: string;
    areaOther?: string;
    city?: string;
    playableAgeMin?: string;
    playableAgeMax?: string;
    languages?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    linkedin?: string;
    twitter?: string;
    youtube?: string;
    website?: string;
    disciplines?: string[];
    disciplineOther?: string;
    unions?: string[];
    unionOther?: string;
    ethnicities?: string[];
    ethnicityOther?: string;
    resumes?: Array<{ label: string; url: string }>;
    resumeData?: ResumeData;
    mentorshipOffering?: string[];
    mentorshipSeeking?: string[];
  };
  // svelte-ignore state_referenced_locally
  const v: FormValues = (form?.values ?? {}) as FormValues;

  let fullName = $state(v.fullName ?? "");
  let email = $state(v.email ?? "");
  let slug = $state(v.slug ?? "");
  let slugTouched = $state(!!v.slug);
  let bio = $state(v.bio ?? "");
  let pronouns = $state(v.pronouns ?? "");
  let headshotUrl = $state(v.headshotUrl ?? "");
  let headshotConsent = $state(v.headshotConsent ?? false);
  let isMinor = $state(v.isMinor ?? false);
  let guardianEmail = $state(v.guardianEmail ?? "");
  let guardianName = $state(v.guardianName ?? "");
  let area = $state(v.area ?? "");
  let areaOther = $state(v.areaOther ?? "");
  let city = $state(v.city ?? "");
  let playableAgeMin = $state(v.playableAgeMin ?? "");
  let playableAgeMax = $state(v.playableAgeMax ?? "");
  let languages = $state(v.languages ?? "");
  let instagram = $state(v.instagram ?? "");
  let facebook = $state(v.facebook ?? "");
  let tiktok = $state(v.tiktok ?? "");
  let linkedin = $state(v.linkedin ?? "");
  let twitter = $state(v.twitter ?? "");
  let youtube = $state(v.youtube ?? "");
  let website = $state(v.website ?? "");
  // Disciplines: ordered array is the source of truth (drives card display
  // order). The Set is derived for the picker's checked state. Toggling
  // appends on add and splices on remove so user-chosen positions stick.
  let disciplineOrder = $state<string[]>(v.disciplines ?? []);
  const selectedDisciplines = $derived(new Set(disciplineOrder));
  function toggleDiscipline(name: string) {
    disciplineOrder = disciplineOrder.includes(name)
      ? disciplineOrder.filter((d) => d !== name)
      : [...disciplineOrder, name];
  }
  let disciplineOther = $state(v.disciplineOther ?? "");
  let selectedUnions = $state<Set<string>>(new Set(v.unions ?? []));
  let unionOther = $state(v.unionOther ?? "");
  let selectedEthnicities = $state<Set<string>>(new Set(v.ethnicities ?? []));
  let ethnicityOther = $state(v.ethnicityOther ?? "");
  let resumes = $state<Array<{ label: string; url: string }>>(v.resumes ?? []);
  let resumeData = $state<ResumeData>(
    v.resumeData ?? { credits: [], training: [], skills: [] },
  );
  let mentorshipOffering = $state<Set<string>>(
    new Set(v.mentorshipOffering ?? []),
  );
  let mentorshipSeeking = $state<Set<string>>(
    new Set(v.mentorshipSeeking ?? []),
  );

  $effect(() => {
    if (!slugTouched && fullName) slug = slugify(fullName);
  });

  let submitting = $state(false);

  let collisionOpen = $state(false);
  $effect(() => {
    if (form?.slugCollision) collisionOpen = true;
  });

  function pickAlternativeSlug(s: string) {
    slug = s;
    slugTouched = true;
    collisionOpen = false;
  }

  function toggleSet(set: Set<string>, value: string): Set<string> {
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return new Set(set);
  }

  const errors = $derived(
    (form?.errors ?? {}) as Record<string, string>,
  );
</script>

<svelte:head>
  <title>Submit your profile - South Sound Theatre Artists</title>
</svelte:head>

<main>
  <header class="hd">
    <span class="eyebrow"><span class="num">→</span>Submit your profile</span>
    <h1 class="h1-display">
      You belong <span class="serif-it">here</span>.
    </h1>
    <p class="intro">
      Add yourself to the South Sound theatre artist directory. Fields
      marked with <span class="req">*</span> are required.
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
    <div class="honeypot" aria-hidden="true">
      <label for="website_url_extra">Leave this empty</label>
      <input
        id="website_url_extra"
        name="website_url_extra"
        type="text"
        tabindex="-1"
        autocomplete="off"
      />
    </div>

    <fieldset>
      <legend>About you</legend>

      <label class="field">
        <span>Full name <span class="req">*</span></span>
        <input
          name="full_name"
          type="text"
          autocomplete="name"
          required
          bind:value={fullName}
          aria-invalid={!!errors.full_name}
        />
        {#if errors.full_name}<span class="error">{errors.full_name}</span>{/if}
      </label>

      <label class="field">
        <span>Pronouns</span>
        <input
          name="pronouns"
          type="text"
          placeholder="she/her, they/them, etc."
          bind:value={pronouns}
        />
      </label>

      <label class="field">
        <span>Email <span class="req">*</span></span>
        <input
          name="email"
          type="email"
          autocomplete="email"
          required
          bind:value={email}
          aria-invalid={!!errors.email}
        />
        <span class="hint">Never shown publicly. Used for your edit link and contact routing.</span>
        {#if errors.email}<span class="error">{errors.email}</span>{/if}
      </label>

      <!-- Under-18 toggle. When checked, parent / guardian fields appear
           and become required, the headshot fieldset is hidden, and all
           email routing (verification, magic links, contact form) goes
           to the guardian email instead of the artist's. -->
      <label class="checkbox minor-toggle">
        <input
          type="checkbox"
          name="is_minor"
          bind:checked={isMinor}
        />
        <span>This artist is under 18 (parent or guardian managed profile).</span>
      </label>

      {#if isMinor}
        <div class="minor-block">
          <p class="hint">
            For artists under 18 we list the profile but route all contact
            and edits through a parent or guardian. Their headshot won't be
            shown publicly.
          </p>
          <label class="field">
            <span>Parent or guardian email <span class="req">*</span></span>
            <input
              name="guardian_email"
              type="email"
              autocomplete="email"
              bind:value={guardianEmail}
              aria-invalid={!!errors.guardian_email}
            />
            <span class="hint">
              Required. The edit link and any contact-form messages go here.
            </span>
            {#if errors.guardian_email}<span class="error">{errors.guardian_email}</span>{/if}
          </label>
          <label class="field">
            <span>Parent or guardian name</span>
            <input
              name="guardian_name"
              type="text"
              autocomplete="name"
              bind:value={guardianName}
              placeholder="Optional"
            />
            <span class="hint">
              Optional. Shown to anyone using the contact form: "Messages
              go to {guardianName || "[parent / guardian]"}."
            </span>
          </label>
        </div>
      {/if}

      <label class="field">
        <span>Profile URL <span class="req">*</span></span>
        <div class="slug-row">
          <span class="prefix">/artists/</span>
          <input
            name="slug"
            type="text"
            required
            bind:value={slug}
            oninput={() => (slugTouched = true)}
            aria-invalid={!!errors.slug}
          />
        </div>
        <span class="hint">Auto-suggested from your name. Lowercase letters, numbers, and hyphens.</span>
        {#if errors.slug && errors.slug !== "taken"}
          <span class="error">{errors.slug}</span>
        {/if}
      </label>
    </fieldset>

    {#if !isMinor}
      <fieldset>
        <legend>Headshot/photo <span class="req">*</span></legend>
        <p class="hint">
          Required. Doesn't need to be a professional headshot - any clear
          photo of you works. Casting directors and collaborators rely on
          a face to put with the name.
        </p>
        <HeadshotUpload bind:value={headshotUrl} />
        <input type="hidden" name="headshot_url" value={headshotUrl} />
        {#if errors.headshot_url}<span class="error">{errors.headshot_url}</span>{/if}
        {#if headshotUrl}
          <label class="checkbox" style="margin-top: 0.75rem">
            <input
              type="checkbox"
              name="headshot_consent"
              bind:checked={headshotConsent}
            />
            <span>
              I confirm I have the rights to use this image, including any
              photographer credit if applicable.
            </span>
          </label>
          {#if errors.headshot_consent}
            <span class="error">{errors.headshot_consent}</span>
          {/if}
        {/if}
      </fieldset>
    {:else}
      <!-- For minor profiles we don't collect or display a headshot. The
           directory tile will use the typographic placeholder. -->
      <fieldset class="minor-headshot-stub">
        <legend>Headshot/photo</legend>
        <p class="hint">
          For minor profiles we don't show a headshot publicly. The
          directory tile will display initials instead.
        </p>
      </fieldset>
    {/if}

    <fieldset>
      <legend>Bio</legend>
      <p class="hint">
        Optional. What collaborators should know - training, recent work,
        what you're looking for. A few sentences is plenty.
      </p>
      <label class="field">
        <textarea
          name="bio"
          rows="5"
          bind:value={bio}
          placeholder="Tell directors and collaborators about your work, training, and what you're looking for."
        ></textarea>
      </label>
    </fieldset>

    <fieldset>
      <legend>Resume builder</legend>
      <p class="hint">
        Optional. Fill in any sections that apply - credits, training,
        skills. Sections you skip don't render on your profile.
      </p>
      <ResumeBuilder bind:value={resumeData} />
    </fieldset>

    <fieldset>
      <legend>Resume PDFs</legend>
      <p class="hint">
        Optional. If you'd rather attach an existing PDF (or several -
        acting, directing, design), upload here.
      </p>
      <ResumesEditor bind:value={resumes} />
    </fieldset>

    <fieldset>
      <legend>Disciplines <span class="req">*</span></legend>
      <p class="hint">Search or browse by category. Pick all that apply.</p>
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
        Optional. Both directions are visible on your profile and the
        directory has filters for either.
      </p>

      <h3 class="field-label" style="margin-top: 0.5rem">Open to mentoring in</h3>
      <DisciplinePicker
        items={data.disciplines}
        categoryOrder={data.disciplineCategories}
        selected={mentorshipOffering}
        onToggle={(n) =>
          (mentorshipOffering = toggleSet(mentorshipOffering, n))}
        inputName="mentorship_offering"
        showOtherInput={false}
      />

      <h3 class="field-label" style="margin-top: 1rem">Looking to learn</h3>
      <DisciplinePicker
        items={data.disciplines}
        categoryOrder={data.disciplineCategories}
        selected={mentorshipSeeking}
        onToggle={(n) =>
          (mentorshipSeeking = toggleSet(mentorshipSeeking, n))}
        inputName="mentorship_seeking"
        showOtherInput={false}
      />
    </fieldset>

    <fieldset>
      <legend>Casting details</legend>

      <label class="field">
        <span>Area <span class="req">*</span></span>
        <select
          name="area"
          bind:value={area}
          required
          aria-invalid={!!errors.area}
        >
          <option value="">Choose your primary area</option>
          {#each data.areas as opt}
            <option value={opt.name}>
              {opt.name}{opt.description ? ` - ${opt.description}` : ""}
            </option>
          {/each}
        </select>
        {#if errors.area}<span class="error">{errors.area}</span>{/if}
      </label>

      {#if area === "Other"}
        <label class="field">
          <span>Specify area</span>
          <input
            name="area_other"
            type="text"
            bind:value={areaOther}
            placeholder="Where are you based?"
            aria-invalid={!!errors.area_other}
          />
          {#if errors.area_other}<span class="error">{errors.area_other}</span>{/if}
        </label>
      {/if}

      <label class="field">
        <span>City</span>
        <input
          name="city"
          type="text"
          bind:value={city}
          placeholder="Lakewood"
          autocomplete="address-level2"
        />
        <span class="hint">
          Optional. Shown on your profile so people know your specific
          town. The region above is what powers the directory filter.
        </span>
      </label>

      <div class="field">
        <span class="field-label">Playable age range</span>
        <div class="age-row">
          <span>From</span>
          <input
            name="playable_age_min"
            type="number"
            min="0"
            max="120"
            bind:value={playableAgeMin}
            aria-invalid={!!errors.playable_age}
          />
          <span>to</span>
          <input
            name="playable_age_max"
            type="number"
            min="0"
            max="120"
            bind:value={playableAgeMax}
            aria-invalid={!!errors.playable_age}
          />
        </div>
        <span class="hint">Optional. The range of ages you can convincingly play.</span>
        {#if errors.playable_age}<span class="error">{errors.playable_age}</span>{/if}
      </div>

      <label class="field">
        <span>Languages spoken</span>
        <input
          name="languages"
          type="text"
          bind:value={languages}
          placeholder="English, Spanish, ASL"
        />
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
              onchange={() =>
                (selectedUnions = toggleSet(selectedUnions, u.name))}
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
          <input
            name="union_other"
            type="text"
            bind:value={unionOther}
            placeholder="Which union?"
          />
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
              onchange={() =>
                (selectedEthnicities = toggleSet(selectedEthnicities, opt))}
            />
            <span>{opt}</span>
          </label>
        {/each}
      </div>
      <label class="field">
        <span>Add another (optional)</span>
        <input
          name="ethnicity_other"
          type="text"
          bind:value={ethnicityOther}
          placeholder="If you don't see your group above"
        />
      </label>
    </fieldset>

    <fieldset>
      <legend>Links (optional)</legend>

      <label class="field">
        <span>Personal website</span>
        <input
          name="website"
          type="url"
          autocomplete="url"
          bind:value={website}
          placeholder="https://example.com"
          aria-invalid={!!errors.website}
        />
        {#if errors.website}<span class="error">{errors.website}</span>{/if}
      </label>

      <label class="field">
        <span>Instagram handle</span>
        <input
          name="instagram"
          type="text"
          bind:value={instagram}
          placeholder="@yourhandle"
        />
      </label>

      <label class="field">
        <span>TikTok handle</span>
        <input
          name="tiktok"
          type="text"
          bind:value={tiktok}
          placeholder="@yourhandle"
        />
      </label>

      <label class="field">
        <span>X / Twitter handle</span>
        <input
          name="twitter"
          type="text"
          bind:value={twitter}
          placeholder="@yourhandle"
        />
      </label>

      <label class="field">
        <span>Facebook URL</span>
        <input
          name="facebook"
          type="url"
          bind:value={facebook}
          placeholder="https://facebook.com/yourname"
          aria-invalid={!!errors.facebook}
        />
        {#if errors.facebook}<span class="error">{errors.facebook}</span>{/if}
      </label>

      <label class="field">
        <span>LinkedIn URL</span>
        <input
          name="linkedin"
          type="url"
          bind:value={linkedin}
          placeholder="https://linkedin.com/in/yourname"
          aria-invalid={!!errors.linkedin}
        />
        {#if errors.linkedin}<span class="error">{errors.linkedin}</span>{/if}
      </label>

      <label class="field">
        <span>YouTube URL</span>
        <input
          name="youtube"
          type="url"
          bind:value={youtube}
          placeholder="https://youtube.com/@yourchannel"
          aria-invalid={!!errors.youtube}
        />
        {#if errors.youtube}<span class="error">{errors.youtube}</span>{/if}
      </label>
    </fieldset>

    <button type="submit" class="submit" disabled={submitting}>
      {submitting ? "Submitting..." : "Submit profile"}
    </button>

    <p class="footer-note">
      After submitting, we'll send a verification link to your email. Click
      it within 24 hours to add your profile to the review queue.
    </p>
  </form>
</main>

<SlugCollisionModal
  open={collisionOpen}
  requested={form?.slugCollision?.requested ?? ""}
  suggestions={form?.slugCollision?.suggestions ?? []}
  onPick={pickAlternativeSlug}
  onClose={() => (collisionOpen = false)}
/>

<style>
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: clamp(2rem, 4vw, 3rem) var(--page-pad-x) 4rem;
  }
  .hd {
    margin-bottom: 3rem;
  }
  .h1-display {
    margin: 0.75rem 0 1rem;
  }
  .intro {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: clamp(16px, 1.5vw, 18px);
    line-height: 1.55;
    color: var(--muted);
    margin: 0;
  }
  .req {
    color: var(--accent);
    font-style: normal;
    font-family: var(--font-body);
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
  .field:last-child {
    margin-bottom: 0;
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
  input[type="email"],
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
    color: var(--ink);
    line-height: 1.4;
  }
  input:focus,
  textarea:focus,
  select:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  input[aria-invalid="true"],
  select[aria-invalid="true"] {
    border-color: var(--error);
  }
  textarea {
    resize: vertical;
    min-height: 140px;
    font-family: var(--font-body);
  }
  .hint {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0;
  }
  .error {
    color: var(--error);
    font-size: 13px;
    margin-top: 4px;
    font-family: var(--font-body);
  }
  .form-error {
    background: color-mix(in oklch, var(--error), var(--bg) 80%);
    border: 1px solid var(--error);
    color: var(--error);
    padding: 12px 16px;
    border-radius: var(--radius);
    margin-bottom: 1.5rem;
    font-size: 14px;
    font-family: var(--font-body);
  }

  .slug-row {
    display: flex;
    align-items: stretch;
  }
  .slug-row .prefix {
    display: flex;
    align-items: center;
    padding: 0 14px;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-right: none;
    border-radius: var(--radius) 0 0 var(--radius);
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 13px;
  }
  .slug-row input {
    flex: 1;
    border-radius: 0 var(--radius) var(--radius) 0;
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

  .checkbox-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px 16px;
    margin-bottom: 0.5rem;
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
  /* Minor toggle: subtle box around the checkbox so it reads as a
     "mode-changing" question, not an afterthought. The block beneath
     opens up when checked. */
  .minor-toggle {
    margin: 0.75rem 0 0;
    padding: 10px 12px;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }
  .minor-block {
    margin-top: 0.5rem;
    padding: 12px 14px;
    border-left: 3px solid var(--accent);
    background: color-mix(in oklch, var(--accent), var(--bg) 92%);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .minor-headshot-stub {
    opacity: 0.7;
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
    transition: background 0.15s, color 0.15s;
  }
  .submit:hover:not(:disabled) {
    background: var(--accent);
    border-color: var(--accent);
  }
  .submit:disabled {
    opacity: 0.5;
    cursor: progress;
  }
  .footer-note {
    margin-top: 1.25rem;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    text-align: center;
    line-height: 1.7;
  }
  .honeypot {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
</style>
