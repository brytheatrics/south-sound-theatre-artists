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

  /* svelte-ignore state_referenced_locally */
  const v = (form?.values ?? {}) as {
    fullName?: string;
    email?: string;
    slug?: string;
    pronouns?: string;
    bio?: string;
    headshotUrl?: string;
    headshotConsent?: boolean;
    area?: string;
    areaOther?: string;
    city?: string;
    resumes?: Array<{ label: string; url: string }>;
    resumeData?: ResumeData;
    disciplines?: string[];
    disciplineOther?: string;
    publish?: boolean;
    sendLink?: boolean;
  };

  let fullName = $state(v.fullName ?? "");
  let email = $state(v.email ?? "");
  let slug = $state(v.slug ?? "");
  let slugTouched = $state(!!v.slug);
  let pronouns = $state(v.pronouns ?? "");
  let bio = $state(v.bio ?? "");
  let headshotUrl = $state(v.headshotUrl ?? "");
  // headshotConsent removed - auto-set server-side when headshotUrl is present.
  let area = $state(v.area ?? "");
  let areaOther = $state(v.areaOther ?? "");
  let city = $state(v.city ?? "");
  let resumes = $state<Array<{ label: string; url: string }>>(v.resumes ?? []);
  let resumeData = $state<ResumeData>(
    v.resumeData ?? { credits: [], training: [], skills: [] },
  );
  let mentorshipOffering = $state<Set<string>>(new Set());
  let mentorshipSeeking = $state<Set<string>>(new Set());
  // Disciplines: ordered array drives display order on cards. Set is
  // derived for the picker's checked state; toggle appends/splices.
  let disciplineOrder = $state<string[]>(v.disciplines ?? []);
  const selectedDisciplines = $derived(new Set(disciplineOrder));
  let disciplineOther = $state(v.disciplineOther ?? "");
  let publish = $state(v.publish ?? true);
  let sendLink = $state(v.sendLink ?? true);

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

  function toggleDiscipline(name: string) {
    disciplineOrder = disciplineOrder.includes(name)
      ? disciplineOrder.filter((d) => d !== name)
      : [...disciplineOrder, name];
  }

  function toggleSet(set: Set<string>, value: string): Set<string> {
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return new Set(set);
  }

  const errors = $derived((form?.errors ?? {}) as Record<string, string>);
</script>

<svelte:head><title>New profile - SSTA admin</title><meta name="robots" content="noindex" /></svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · profiles</span>
  <h1 class="h1-display">New profile.</h1>
  <p class="lede">
    For starter profiles you're entering on behalf of an artist. Only name,
    email, and URL slug are required. Send them an edit link on save and
    they'll fill in the rest.
  </p>
  <p>
    <a class="bt-ghost" href="/admin/profiles">← All profiles</a>
  </p>
</header>

{#if errors._form}<div class="form-error" role="alert">{errors._form}</div>{/if}

<form
  method="POST"
  class="form"
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
      <span>Full name <em>*</em></span>
      <input name="full_name" type="text" required bind:value={fullName} />
      {#if errors.full_name}<span class="error">{errors.full_name}</span>{/if}
    </label>
    <label class="field">
      <span>Email <em>*</em></span>
      <input name="email" type="email" required bind:value={email} />
      <span class="hint">Where the edit link goes. Never displayed publicly.</span>
      {#if errors.email}<span class="error">{errors.email}</span>{/if}
    </label>
    <label class="field">
      <span>Profile URL <em>*</em></span>
      <div class="slug-row">
        <span class="prefix">/artists/</span>
        <input name="slug" type="text" required bind:value={slug} oninput={() => (slugTouched = true)} />
      </div>
      {#if errors.slug && errors.slug !== "taken"}<span class="error">{errors.slug}</span>{/if}
    </label>
    <label class="field">
      <span>Pronouns</span>
      <input name="pronouns" type="text" bind:value={pronouns} placeholder="she/her, they/them, etc." />
    </label>
  </fieldset>

  <fieldset>
    <legend>Headshot/photo</legend>
    <HeadshotUpload bind:value={headshotUrl} />
    <input type="hidden" name="headshot_url" value={headshotUrl} />
    <!-- Consent flag is auto-set on the server when a headshot URL is
         present - admin is vouching for rights outside the system, no
         need for a manual checkbox. -->
  </fieldset>

  <fieldset>
    <legend>Bio</legend>
    <textarea name="bio" rows="5" bind:value={bio} placeholder="What Lexi has on file."></textarea>
  </fieldset>

  <fieldset>
    <legend>Resume builder</legend>
    <ResumeBuilder bind:value={resumeData} />
  </fieldset>

  <fieldset>
    <legend>Resume PDFs</legend>
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
      onOtherChange={(s) => (disciplineOther = s)}
    />
    <DisciplineOrder
      value={disciplineOrder}
      otherLabel={disciplineOther}
      onChange={(next) => (disciplineOrder = next)}
    />
  </fieldset>

  <fieldset>
    <legend>Mentorship</legend>
    <p class="hint">Optional. Mentoring offered + sought.</p>
    <h3 class="field-label">Open to mentoring in</h3>
    <DisciplinePicker
      items={data.disciplines}
      categoryOrder={data.disciplineCategories}
      selected={mentorshipOffering}
      onToggle={(n) => (mentorshipOffering = toggleSet(mentorshipOffering, n))}
      inputName="mentorship_offering"
      showOtherInput={false}
    />
    <h3 class="field-label" style="margin-top: 0.75rem">Looking to learn</h3>
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
    <legend>Area</legend>
    <label class="field">
      <select name="area" bind:value={area}>
        <option value="">Choose (optional)</option>
        {#each data.areas as a}<option value={a.name}>{a.name}{a.description ? ` - ${a.description}` : ""}</option>{/each}
      </select>
    </label>
    {#if area === "Other"}
      <label class="field">
        <span>Specify area</span>
        <input name="area_other" type="text" bind:value={areaOther} />
      </label>
    {/if}
    <label class="field">
      <span>City (optional)</span>
      <input name="city" type="text" bind:value={city} placeholder="Lakewood" />
    </label>
  </fieldset>

  <fieldset>
    <legend>Save options</legend>
    <label class="checkbox">
      <input type="checkbox" name="publish" checked={publish} onchange={(e) => (publish = (e.target as HTMLInputElement).checked)} />
      <span>Publish immediately (otherwise saves as hidden draft).</span>
    </label>
    <label class="checkbox">
      <input type="checkbox" name="send_link" checked={sendLink} onchange={(e) => (sendLink = (e.target as HTMLInputElement).checked)} />
      <span>Send the artist a magic-link edit email so they can fill in the rest.</span>
    </label>
  </fieldset>

  <button type="submit" class="submit" disabled={submitting}>
    {submitting ? "Creating..." : "Create profile"}
  </button>
</form>

<SlugCollisionModal
  open={collisionOpen}
  requested={form?.slugCollision?.requested ?? ""}
  suggestions={form?.slugCollision?.suggestions ?? []}
  onPick={pickAlternativeSlug}
  onClose={() => (collisionOpen = false)}
/>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 720px; margin-bottom: 2rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede { font-family: var(--font-accent); font-style: italic; font-size: 16px; color: var(--muted); margin: 0 0 1rem; max-width: 600px; }
  .bt-ghost { font-family: var(--font-body); font-size: 13px; padding: 8px 14px; border-radius: var(--radius); border: 1px solid var(--rule); color: var(--ink); text-decoration: none; display: inline-flex; }
  .bt-ghost:hover { border-color: var(--ink); text-decoration: none; }
  .form-error { background: color-mix(in oklch, var(--warn), var(--bg) 80%); border: 1px solid var(--warn); color: var(--warn); padding: 12px 16px; border-radius: var(--radius); margin-bottom: 1.5rem; }
  .form { max-width: 720px; counter-reset: section; }
  fieldset { border: 0; border-top: 1px solid var(--rule); padding: 1.5rem 0; margin: 0; counter-increment: section; }
  fieldset:last-of-type { border-bottom: 1px solid var(--rule); }
  legend { padding: 0; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink); font-weight: 500; margin-bottom: 1rem; }
  legend::before { content: counter(section, decimal-leading-zero) " "; color: var(--accent); margin-right: 0.6em; }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 1rem; }
  .field > span:first-child { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
  .field em { color: var(--accent); font-style: normal; }
  input[type="text"], input[type="email"], textarea, select { padding: 10px 14px; border: 1px solid var(--rule); border-radius: var(--radius); font-size: 14px; font-family: var(--font-body); background: var(--bg-raised); }
  input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  textarea { resize: vertical; min-height: 120px; }
  .slug-row { display: flex; align-items: stretch; }
  .slug-row .prefix { display: flex; align-items: center; padding: 0 12px; background: var(--paper); border: 1px solid var(--rule); border-right: 0; border-radius: var(--radius) 0 0 var(--radius); color: var(--muted); font-family: var(--font-mono); font-size: 13px; }
  .slug-row input { flex: 1; border-radius: 0 var(--radius) var(--radius) 0; }
  .checkbox { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; cursor: pointer; font-family: var(--font-body); font-size: 14px; color: var(--ink-soft); }
  .checkbox input { margin: 4px 0 0; accent-color: var(--accent); }
  .hint { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
  .error { color: var(--error); font-size: 13px; }
  .submit { background: var(--ink); color: var(--bg); border: 1px solid var(--ink); padding: 12px 22px; border-radius: var(--radius); font-size: 15px; font-family: var(--font-body); font-weight: 500; cursor: pointer; margin-top: 1.5rem; }
  .submit:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); }
  .submit:disabled { opacity: 0.5; cursor: progress; }
</style>
