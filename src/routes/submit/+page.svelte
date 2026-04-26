<script lang="ts">
  import { enhance } from "$app/forms";
  import HeadshotUpload from "$lib/components/HeadshotUpload.svelte";
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
    area?: string;
    areaOther?: string;
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
  let area = $state(v.area ?? "");
  let areaOther = $state(v.areaOther ?? "");
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
  let selectedDisciplines = $state<Set<string>>(new Set(v.disciplines ?? []));
  let disciplineOther = $state(v.disciplineOther ?? "");
  let selectedUnions = $state<Set<string>>(new Set(v.unions ?? []));
  let unionOther = $state(v.unionOther ?? "");
  let selectedEthnicities = $state<Set<string>>(new Set(v.ethnicities ?? []));
  let ethnicityOther = $state(v.ethnicityOther ?? "");

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
  <h1>Submit your profile</h1>
  <p class="intro">
    Add yourself to the South Sound theatre artist directory. Fields marked
    with <span class="req">*</span> are required.
  </p>

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

    <fieldset>
      <legend>Headshot</legend>
      <p class="hint">Optional. Helps casting directors put a face to a name.</p>
      <HeadshotUpload bind:value={headshotUrl} />
      <input type="hidden" name="headshot_url" value={headshotUrl} />
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
              onchange={() =>
                (selectedDisciplines = toggleSet(selectedDisciplines, d))}
            />
            <span>{d}</span>
          </label>
        {/each}
      </div>
      {#if selectedDisciplines.has("Other")}
        <label class="field" style="margin-top: 0.75rem">
          <span>Specify your discipline</span>
          <input
            name="discipline_other"
            type="text"
            bind:value={disciplineOther}
            placeholder="What other discipline?"
          />
          <span class="hint">
            Helps the admin add commonly-requested disciplines to the list.
          </span>
        </label>
      {/if}
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
            <option value={opt}>{opt}</option>
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
  input[type="number"],
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
  .age-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .age-row input {
    width: 5.5rem;
  }
  .age-row span {
    color: #666;
  }
  .checkbox-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.5rem 1rem;
    margin-bottom: 0.5rem;
  }
  .checkbox {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.25rem 0;
  }
  .checkbox input {
    margin: 0.2rem 0 0;
  }
  .union-desc {
    color: #666;
    font-weight: normal;
    font-size: 0.9rem;
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
