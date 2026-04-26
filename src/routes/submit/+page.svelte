<script lang="ts">
  import { enhance } from "$app/forms";
  import HeadshotUpload from "$lib/components/HeadshotUpload.svelte";
  import SlugCollisionModal from "$lib/components/SlugCollisionModal.svelte";
  import { slugify } from "$lib/util/slug";

  let { data, form } = $props();

  // Prefilled values when the server returns a validation failure or slug
  // collision so the user doesn't lose their work. Widen the type because
  // the three fail() branches in +page.server.ts have different shapes.
  type FormValues = {
    fullName?: string;
    email?: string;
    slug?: string;
    bio?: string;
    pronouns?: string;
    headshotUrl?: string;
    headshotConsent?: boolean;
    availability?: string;
    experience?: string;
    union?: string;
    area?: string;
    ageRange?: string;
    languages?: string;
    instagram?: string;
    website?: string;
    disciplines?: string[];
    ethnicities?: string[];
    ethnicityOther?: string;
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
  let availability = $state(v.availability ?? "Available");
  let experience = $state(v.experience ?? "");
  let unionStatus = $state(v.union ?? "");
  let area = $state(v.area ?? "");
  let ageRange = $state(v.ageRange ?? "");
  let languages = $state(v.languages ?? "");
  let instagram = $state(v.instagram ?? "");
  let website = $state(v.website ?? "");
  let selectedDisciplines = $state<Set<string>>(new Set(v.disciplines ?? []));
  let selectedEthnicities = $state<Set<string>>(new Set(v.ethnicities ?? []));
  let ethnicityOther = $state(v.ethnicityOther ?? "");

  // Auto-derive slug from name until the user edits it.
  $effect(() => {
    if (!slugTouched && fullName) {
      slug = slugify(fullName);
    }
  });

  let submitting = $state(false);

  // Slug collision modal opens when the server reports a taken slug.
  let collisionOpen = $state(false);
  $effect(() => {
    if (form?.slugCollision) collisionOpen = true;
  });

  function pickAlternativeSlug(s: string) {
    slug = s;
    slugTouched = true;
    collisionOpen = false;
  }

  function toggleDiscipline(name: string) {
    if (selectedDisciplines.has(name)) selectedDisciplines.delete(name);
    else selectedDisciplines.add(name);
    selectedDisciplines = new Set(selectedDisciplines);
  }

  function toggleEthnicity(name: string) {
    if (selectedEthnicities.has(name)) selectedEthnicities.delete(name);
    else selectedEthnicities.add(name);
    selectedEthnicities = new Set(selectedEthnicities);
  }

  const errors = $derived(
    (form?.errors ?? {}) as Record<string, string>,
  );
</script>

<svelte:head>
  <title>Submit your profile - South Sound Theatre Artists</title>
</svelte:head>

<main>
  <h1>Submit your profile</h1>
  <p class="intro">
    Add yourself to the South Sound theatre artist directory. Fields marked
    with <span class="req">*</span> are required.
  </p>

  {#if errors._form}
    <div class="form-error" role="alert">{errors._form}</div>
  {/if}

  <form method="POST" use:enhance={() => {
    submitting = true;
    return async ({ update }) => {
      await update({ reset: false });
      submitting = false;
    };
  }}>
    <!-- Honeypot: visually hidden, real users skip past it. -->
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
        {#if errors.slug && errors.slug !== "taken"}<span class="error">{errors.slug}</span>{/if}
      </label>
    </fieldset>

    <fieldset>
      <legend>Headshot <span class="req">*</span></legend>
      <HeadshotUpload bind:value={headshotUrl} />
      <input type="hidden" name="headshot_url" value={headshotUrl} />
      {#if errors.headshot_url}<span class="error">{errors.headshot_url}</span>{/if}
      <label class="checkbox">
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
      {#if errors.headshot_consent}<span class="error">{errors.headshot_consent}</span>{/if}
    </fieldset>

    <fieldset>
      <legend>Disciplines <span class="req">*</span></legend>
      <p class="hint">Pick all that apply.</p>
      <div class="checkbox-grid">
        {#each data.disciplines as d}
          <label class="checkbox">
            <input
              type="checkbox"
              name="disciplines"
              value={d}
              checked={selectedDisciplines.has(d)}
              onchange={() => toggleDiscipline(d)}
            />
            <span>{d}</span>
          </label>
        {/each}
      </div>
      {#if errors.disciplines}<span class="error">{errors.disciplines}</span>{/if}
    </fieldset>

    <fieldset>
      <legend>Bio</legend>
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
      <legend>Casting & availability</legend>

      <div class="radio-group" role="radiogroup" aria-labelledby="availability-label">
        <span id="availability-label" class="field-label">Availability <span class="req">*</span></span>
        {#each data.options.availability as opt}
          <label class="radio">
            <input
              type="radio"
              name="availability"
              value={opt}
              checked={availability === opt}
              onchange={() => (availability = opt)}
            />
            <span>{opt}</span>
          </label>
        {/each}
        {#if errors.availability}<span class="error">{errors.availability}</span>{/if}
      </div>

      <label class="field">
        <span>Experience level</span>
        <select name="experience" bind:value={experience}>
          <option value="">Choose one (optional)</option>
          {#each data.options.experience as opt}
            <option value={opt}>{opt}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span>Union status</span>
        <select name="union" bind:value={unionStatus}>
          <option value="">Choose one (optional)</option>
          {#each data.options.union as opt}
            <option value={opt}>{opt}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span>Area <span class="req">*</span></span>
        <select name="area" bind:value={area} required aria-invalid={!!errors.area}>
          <option value="">Choose your primary area</option>
          {#each data.options.area as opt}
            <option value={opt}>{opt}</option>
          {/each}
        </select>
        {#if errors.area}<span class="error">{errors.area}</span>{/if}
      </label>

      <label class="field">
        <span>Age range</span>
        <select name="age_range" bind:value={ageRange}>
          <option value="">Choose one (optional)</option>
          {#each data.options.age as opt}
            <option value={opt}>{opt}</option>
          {/each}
        </select>
        <span class="hint">Optional. Helps with age-specific casting.</span>
      </label>

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
              onchange={() => toggleEthnicity(opt)}
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
        <span>Instagram handle</span>
        <input
          name="instagram"
          type="text"
          bind:value={instagram}
          placeholder="@yourhandle"
        />
      </label>

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
    max-width: 640px;
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
    font-family: system-ui, sans-serif;
    color: #222;
  }
  h1 {
    margin: 0 0 0.5rem;
    color: #2d1f3d;
  }
  .intro {
    color: #555;
    margin: 0 0 2rem;
  }
  .req {
    color: #c00;
  }
  fieldset {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1.25rem;
    margin: 0 0 1.5rem;
  }
  legend {
    font-weight: 600;
    color: #2d1f3d;
    padding: 0 0.5rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-bottom: 1rem;
  }
  .field:last-child {
    margin-bottom: 0;
  }
  .field > span:first-child,
  .field-label {
    font-weight: 500;
  }
  input[type="text"],
  input[type="email"],
  input[type="url"],
  textarea,
  select {
    padding: 0.55rem 0.7rem;
    border: 1px solid #aaa;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
    background: white;
  }
  input:focus,
  textarea:focus,
  select:focus {
    outline: 2px solid #38817d;
    outline-offset: -1px;
    border-color: #38817d;
  }
  input[aria-invalid="true"],
  select[aria-invalid="true"] {
    border-color: #c00;
  }
  textarea {
    resize: vertical;
    min-height: 120px;
  }
  .hint {
    font-size: 0.85rem;
    color: #666;
  }
  .error {
    color: #c00;
    font-size: 0.85rem;
    margin-top: 0.2rem;
  }
  .form-error {
    background: #ffe5e5;
    border: 1px solid #c00;
    color: #800;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
  }
  .slug-row {
    display: flex;
    align-items: stretch;
  }
  .slug-row .prefix {
    display: flex;
    align-items: center;
    padding: 0 0.6rem;
    background: #f0f0f0;
    border: 1px solid #aaa;
    border-right: none;
    border-radius: 6px 0 0 6px;
    color: #666;
    font-size: 0.95rem;
  }
  .slug-row input {
    flex: 1;
    border-radius: 0 6px 6px 0;
  }
  .checkbox-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.5rem 1rem;
    margin-bottom: 0.5rem;
  }
  .checkbox,
  .radio {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.25rem 0;
  }
  .checkbox input,
  .radio input {
    margin: 0.2rem 0 0;
  }
  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }
  .submit {
    background: #38817d;
    color: white;
    border: none;
    padding: 0.85rem 1.5rem;
    border-radius: 8px;
    font-size: 1.05rem;
    font-weight: 500;
    cursor: pointer;
    width: 100%;
  }
  .submit:hover:not(:disabled) {
    background: #2d6b67;
  }
  .submit:disabled {
    background: #888;
    cursor: progress;
  }
  .footer-note {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: #666;
    text-align: center;
  }
  .honeypot {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
</style>
