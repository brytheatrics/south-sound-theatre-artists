<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PageData, ActionData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let postType = $state((form?.values?.postType as string) ?? "audition");
  let keyDatesRaw = $state(
    form?.values?.keyDates ? JSON.stringify(form.values.keyDates) : "[]",
  );

  // Dynamic key dates: array of {label, value} the user builds in the form.
  type KD = { label: string; value: string };
  let keyDates = $state<KD[]>(
    form?.values?.keyDates
      ? (form.values.keyDates as [string, string][]).map(([label, value]) => ({ label, value }))
      : [{ label: "", value: "" }],
  );

  function addKeyDate() {
    keyDates = [...keyDates, { label: "", value: "" }];
  }
  function removeKeyDate(i: number) {
    keyDates = keyDates.filter((_, idx) => idx !== i);
  }

  // Serialise key dates to JSON for the hidden input before submit.
  $effect(() => {
    keyDatesRaw = JSON.stringify(
      keyDates.map((kd) => [kd.label, kd.value]),
    );
  });

  const showRoles = $derived(["audition", "designer", "crew", "general"].includes(postType));
  const showTicketUrl = $derived(postType === "production");
</script>

<svelte:head>
  <title>Post to the callboard - South Sound Theatre Artists</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="submit-wrap">
  <header class="submit-hd">
    <span class="eyebrow"><span class="num">+</span>Callboard</span>
    <h1 class="h1-display">Post a call.</h1>
    <p class="lede">
      Fill in the details below. You'll get an email to confirm your address
      before the post goes into review. Verified companies go live immediately
      after confirmation.
    </p>
    <p class="lede-small">
      Want verified status for your company?
      <a href="/callboard/apply-verified">Apply here.</a>
    </p>
  </header>

  {#if form?.errors?._form}
    <div class="form-error" role="alert">{form.errors._form}</div>
  {/if}

  <form method="POST" use:enhance class="submit-form">
    <!-- Honeypot -->
    <input type="text" name="website_url_extra" style="display:none" tabindex="-1" autocomplete="off" />

    <!-- 01. POST TYPE -->
    <fieldset class="fieldset">
      <legend class="legend"><span class="num">01</span> What kind of post?</legend>
      <div class="type-grid">
        {#each [
          { value: "audition", label: "Audition notice", desc: "Open casting call for a show." },
          { value: "designer", label: "Designer call", desc: "Looking for a scenic, lighting, costume, sound, or other designer." },
          { value: "crew", label: "Crew call", desc: "Stage manager, ASM, carpenter, stitcher, run crew, etc." },
          { value: "production", label: "Production announcement", desc: "Announcing a show - dates, tickets, info." },
          { value: "general", label: "General opportunity", desc: "Workshop, class, staged reading, anything else." },
        ] as opt (opt.value)}
          <label class="type-opt" class:on={postType === opt.value}>
            <input
              type="radio"
              name="post_type"
              value={opt.value}
              checked={postType === opt.value}
              onchange={() => { postType = opt.value; }}
              class="sr-only"
            />
            <span class="type-label">{opt.label}</span>
            <span class="type-desc">{opt.desc}</span>
          </label>
        {/each}
      </div>
      {#if form?.errors?.post_type}
        <p class="field-error">{form.errors.post_type}</p>
      {/if}
    </fieldset>

    <!-- 02. POST DETAILS -->
    <fieldset class="fieldset">
      <legend class="legend"><span class="num">02</span> Post details</legend>

      <div class="field">
        <label for="title" class="label">Show or notice title <span class="req">*</span></label>
        <input
          id="title"
          name="title"
          type="text"
          class="input"
          class:error={!!form?.errors?.title}
          value={form?.values?.title ?? ""}
          placeholder={postType === "production" ? "Into the Woods" : "Assistant Stage Manager - Into the Woods"}
          required
        />
        {#if form?.errors?.title}
          <p class="field-error">{form.errors.title}</p>
        {/if}
      </div>

      <div class="field-row">
        <div class="field">
          <label for="organization_name" class="label">Producing company / organization <span class="req">*</span></label>
          <input
            id="organization_name"
            name="organization_name"
            type="text"
            class="input"
            class:error={!!form?.errors?.organization_name}
            value={form?.values?.organizationName ?? ""}
            required
          />
          {#if form?.errors?.organization_name}
            <p class="field-error">{form.errors.organization_name}</p>
          {/if}
        </div>
        <div class="field">
          <label for="location" class="label">City / area</label>
          <input
            id="location"
            name="location"
            type="text"
            class="input"
            value={form?.values?.location ?? ""}
            placeholder="Tacoma, Olympia, Gig Harbor..."
            list="areas-list"
          />
          <datalist id="areas-list">
            {#each data.areas as area}
              <option value={area}></option>
            {/each}
          </datalist>
        </div>
      </div>

      <div class="field">
        <label for="description" class="label">
          Description <span class="req">*</span>
          <span class="label-hint">
            {#if postType === "audition"}
              Roles available, production details, what to prepare, etc.
            {:else if postType === "designer"}
              Design scope, tech specs, aesthetic direction, mentorship notes, etc.
            {:else if postType === "crew"}
              Duties, schedule, experience needed, etc.
            {:else if postType === "production"}
              Show info, company, what audiences can expect.
            {:else}
              What the opportunity is, who it's for, what to expect.
            {/if}
          </span>
        </label>
        <textarea
          id="description"
          name="description"
          class="textarea"
          class:error={!!form?.errors?.description}
          rows="6"
          required
        >{form?.values?.description ?? ""}</textarea>
        {#if form?.errors?.description}
          <p class="field-error">{form.errors.description}</p>
        {/if}
      </div>

      {#if showRoles}
        <div class="field">
          <label for="roles" class="label">
            {postType === "audition" ? "Roles / breakdowns" : "Positions needed"}
            <span class="label-hint">One per line or comma-separated. Shown as chips on the callboard.</span>
          </label>
          <textarea
            id="roles"
            name="roles"
            class="textarea"
            rows="3"
            placeholder={postType === "audition" ? "Lopakhin (M, 35-50)\nRanevskaya (F, 45-60)\nEnsemble (open)" : "Lighting Designer\nScenic Designer"}
          >{form?.values?.roles ?? ""}</textarea>
        </div>
      {/if}

      {#if showTicketUrl}
        <div class="field">
          <label for="ticket_url" class="label">Tickets / info URL</label>
          <input
            id="ticket_url"
            name="ticket_url"
            type="url"
            class="input"
            class:error={!!form?.errors?.ticket_url}
            value={form?.values?.ticketUrl ?? ""}
            placeholder="https://..."
          />
          {#if form?.errors?.ticket_url}
            <p class="field-error">{form.errors.ticket_url}</p>
          {/if}
        </div>
      {/if}
    </fieldset>

    <!-- 03. COMPENSATION -->
    <fieldset class="fieldset">
      <legend class="legend"><span class="num">03</span> Compensation</legend>
      <div class="field-row">
        <div class="field">
          <label for="compensation_type" class="label">Type</label>
          <select id="compensation_type" name="compensation_type" class="select" value={form?.values?.compensationType ?? ""}>
            <option value="">-- Select --</option>
            <option value="paid">Paid</option>
            <option value="stipend">Stipend</option>
            <option value="volunteer">Volunteer</option>
            <option value="none">None / unpaid</option>
          </select>
        </div>
        <div class="field">
          <label for="compensation" class="label">
            Details
            <span class="label-hint">e.g. "Stipend &middot; $400-650" or "$22/hr"</span>
          </label>
          <input
            id="compensation"
            name="compensation"
            type="text"
            class="input"
            value={form?.values?.compensation ?? ""}
          />
        </div>
      </div>
    </fieldset>

    <!-- 04. KEY DATES -->
    <fieldset class="fieldset">
      <legend class="legend"><span class="num">04</span> Key dates</legend>
      <p class="fieldset-hint">These appear as a date strip on your post. Label examples: Auditions, Callbacks, Tech, Run, Deadline.</p>

      <div class="key-dates-list">
        {#each keyDates as kd, i}
          <div class="key-date-row">
            <input
              type="text"
              class="input kd-label"
              placeholder="Label"
              bind:value={kd.label}
              aria-label="Date label {i + 1}"
            />
            <input
              type="text"
              class="input kd-value"
              placeholder="Date / value"
              bind:value={kd.value}
              aria-label="Date value {i + 1}"
            />
            {#if keyDates.length > 1}
              <button type="button" class="kd-remove" onclick={() => removeKeyDate(i)} aria-label="Remove row">
                &times;
              </button>
            {/if}
          </div>
        {/each}
      </div>
      <button type="button" class="bt-add" onclick={addKeyDate}>+ Add date</button>

      <!-- Serialised to JSON for server. -->
      <input type="hidden" name="key_dates" bind:value={keyDatesRaw} />
    </fieldset>

    <!-- 05. DEADLINE & EXPIRY -->
    <fieldset class="fieldset">
      <legend class="legend"><span class="num">05</span> Deadline &amp; expiry</legend>
      <div class="field-row">
        <div class="field">
          <label for="deadline_text" class="label">
            Deadline display text
            <span class="label-hint">Shown on the card. e.g. "Apply by May 5" or "Open until filled"</span>
          </label>
          <input
            id="deadline_text"
            name="deadline_text"
            type="text"
            class="input"
            value={form?.values?.deadlineText ?? ""}
            placeholder="Apply by May 5"
          />
        </div>
        <div class="field">
          <label for="expires_at" class="label">
            Auto-remove date
            <span class="label-hint">Post hides automatically on this date.</span>
          </label>
          <input
            id="expires_at"
            name="expires_at"
            type="date"
            class="input"
            class:error={!!form?.errors?.expires_at}
            value={form?.values?.expiresAt ?? ""}
          />
          {#if form?.errors?.expires_at}
            <p class="field-error">{form.errors.expires_at}</p>
          {/if}
        </div>
      </div>
    </fieldset>

    <!-- 06. HOW TO APPLY -->
    <fieldset class="fieldset">
      <legend class="legend"><span class="num">06</span> How to apply / contact</legend>
      <div class="field">
        <label for="contact_info" class="label">
          Contact or submission info
          <span class="label-hint">Email, form URL, in-person details, etc.</span>
        </label>
        <textarea
          id="contact_info"
          name="contact_info"
          class="textarea"
          rows="3"
          placeholder="Email your resume and headshot to casting@example.org"
        >{form?.values?.contactInfo ?? ""}</textarea>
      </div>
    </fieldset>

    <!-- 07. YOUR INFO -->
    <fieldset class="fieldset">
      <legend class="legend"><span class="num">07</span> Your contact info</legend>
      <p class="fieldset-hint">Used to send your verification email. Not shown publicly.</p>
      <div class="field-row">
        <div class="field">
          <label for="submitter_name" class="label">Your name <span class="req">*</span></label>
          <input
            id="submitter_name"
            name="submitter_name"
            type="text"
            class="input"
            class:error={!!form?.errors?.submitter_name}
            value={form?.values?.submitterName ?? ""}
            required
          />
          {#if form?.errors?.submitter_name}
            <p class="field-error">{form.errors.submitter_name}</p>
          {/if}
        </div>
        <div class="field">
          <label for="submitter_email" class="label">Your email <span class="req">*</span></label>
          <input
            id="submitter_email"
            name="submitter_email"
            type="email"
            class="input"
            class:error={!!form?.errors?.submitter_email}
            value={form?.values?.submitterEmail ?? ""}
            required
          />
          {#if form?.errors?.submitter_email}
            <p class="field-error">{form.errors.submitter_email}</p>
          {/if}
        </div>
      </div>
    </fieldset>

    <div class="submit-row">
      <button type="submit" class="bt bt-pri">Submit post &rarr;</button>
      <span class="submit-note">
        We'll email you a confirmation link. Verified companies go live after confirmation.
        Everyone else goes into a short review queue.
      </span>
    </div>
  </form>
</main>

<style>
  .submit-wrap {
    max-width: calc(760px + var(--page-pad-x) * 2);
    margin: 0 auto;
    padding: clamp(2.5rem, 6vw, 3.5rem) var(--page-pad-x) 4rem;
  }
  .submit-hd {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 2.5rem;
  }
  .h1-display { margin: 0.5rem 0 0; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: clamp(16px, 2vw, 18px);
    color: var(--ink-soft);
    line-height: 1.5;
    margin: 0;
  }
  .lede-small {
    font-size: 14px;
    color: var(--muted);
    margin: 0;
  }
  .lede-small a { color: var(--accent); }

  .submit-form { display: flex; flex-direction: column; gap: 2rem; }

  .fieldset {
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .legend {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 0 6px;
    font-weight: 500;
  }
  .fieldset-hint {
    font-size: 13px;
    color: var(--muted);
    margin: -0.5rem 0 0;
    line-height: 1.5;
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.625rem;
  }
  .type-opt {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0.875rem 1rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color 0.1s;
  }
  .type-opt:hover { border-color: var(--ink); }
  .type-opt.on { border-color: var(--accent); background: color-mix(in oklch, var(--accent), var(--bg) 90%); }
  .type-label {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    color: var(--ink);
  }
  .type-desc {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.4;
  }
  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .field { display: flex; flex-direction: column; gap: 5px; }
  /* align-items: end so inputs in a 2-up row line up even when one field has
     a label-hint and the other doesn't (different label heights otherwise
     push the inputs to different y-positions). */
  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: end;
  }
  /* Plain block so the inline req asterisk sits next to the label text;
     label-hint is forced to its own line below via display: block. */
  .label {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
  }
  .label-hint {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    font-weight: 400;
    color: var(--muted);
    line-height: 1.4;
  }
  .req { color: var(--accent); margin-left: 2px; }
  .input, .textarea, .select {
    font-family: var(--font-body);
    font-size: 14px;
    padding: 9px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink);
    width: 100%;
    box-sizing: border-box;
  }
  .input:focus, .textarea:focus, .select:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .input.error, .textarea.error { border-color: var(--warn); }
  .textarea { resize: vertical; line-height: 1.5; }
  .select { cursor: pointer; }
  .field-error {
    font-size: 12px;
    color: var(--warn);
    margin: 0;
  }
  .form-error {
    background: color-mix(in oklch, var(--warn), var(--bg) 80%);
    border: 1px solid var(--warn);
    color: var(--warn);
    padding: 12px 16px;
    border-radius: var(--radius);
    font-size: 14px;
    margin-bottom: 1rem;
  }

  /* Key dates */
  .key-dates-list { display: flex; flex-direction: column; gap: 8px; }
  .key-date-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 8px;
    align-items: center;
  }
  .kd-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--muted);
    font-size: 18px;
    padding: 4px 8px;
    line-height: 1;
  }
  .kd-remove:hover { color: var(--warn); }
  .bt-add {
    align-self: flex-start;
    background: transparent;
    border: 1px dashed var(--rule);
    color: var(--ink-soft);
    font-family: var(--font-body);
    font-size: 13px;
    padding: 6px 12px;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .bt-add:hover { border-color: var(--ink); color: var(--ink); }

  .submit-row {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: wrap;
    padding-top: 0.5rem;
  }
  .submit-note {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.5;
    flex: 1;
    min-width: 200px;
  }

  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 11px 20px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .bt-pri { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); }

  @media (max-width: 600px) {
    .field-row { grid-template-columns: 1fr; }
    .key-date-row { grid-template-columns: 1fr 1fr auto; }
    .type-grid { grid-template-columns: 1fr; }
  }
</style>
