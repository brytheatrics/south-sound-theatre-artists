<script lang="ts">
  import { enhance } from "$app/forms";
  import HeadshotPlaceholder from "$lib/components/HeadshotPlaceholder.svelte";

  let { data, form } = $props();
  // svelte-ignore state_referenced_locally
  const p = data.profile;

  let submitting = $state(false);

  function splitName(full: string) {
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
  }
  const split = splitName(p.full_name);

  function memberSince(date: string): string {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function fmtAge(min: number | null, max: number | null): string | null {
    if (min == null || max == null) return null;
    return `${min}-${max}`;
  }

  const playable = $derived(fmtAge(p.playable_age_min, p.playable_age_max));
  const errors = $derived((form?.errors ?? {}) as Record<string, string>);

  let showContact = $state(false);

  // Build a click-through URL from a handle. Handles can be entered as
  // either @name or name; the platform's own URL format normalises it.
  function handleUrl(platform: "instagram" | "tiktok" | "twitter", handle: string): string {
    const h = handle.replace(/^@+/, "").trim();
    switch (platform) {
      case "instagram":
        return `https://instagram.com/${h}`;
      case "tiktok":
        return `https://tiktok.com/@${h}`;
      case "twitter":
        return `https://x.com/${h}`;
    }
  }
</script>

<svelte:head>
  <title>{p.full_name} - South Sound Theatre Artists</title>
  <meta name="description" content={p.bio ? p.bio.slice(0, 160) : `${p.full_name} - ${p.disciplines.join(", ")}`} />
  <meta property="og:title" content={p.full_name} />
  {#if p.headshot_url}<meta property="og:image" content={p.headshot_url} />{/if}
</svelte:head>

<article class="profile">
  <div class="hero">
    <div class="head">
      <HeadshotPlaceholder name={p.full_name} src={p.headshot_url} ratio="3 / 4" />
    </div>
    <div class="meta">
      <span class="eyebrow"><span class="num">·</span>Profile</span>
      <h1 class="hero-name">
        <span class="first">{split.first}</span>{#if split.last}<span class="serif-it last">&nbsp;{split.last}</span>{/if}
      </h1>
      {#if p.pronouns}<p class="pronouns">{p.pronouns}</p>{/if}

      <p class="disc">
        {p.disciplines.join(" · ")}
        {#if p.geographic_area}<span class="area"> · {p.geographic_area}</span>{/if}
      </p>

      {#if p.unions.length > 0}
        <ul class="chips" aria-label="Unions">
          {#each p.unions as u}
            <li class="chip solid">{u}</li>
          {/each}
        </ul>
      {/if}

      <div class="actions">
        <button
          type="button"
          class="bt bt-pri"
          onclick={() => {
            showContact = !showContact;
            if (showContact) setTimeout(() => document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
          }}
        >
          Contact {split.first}
        </button>
        {#if p.website_url}
          <a class="bt bt-ghost" href={p.website_url} target="_blank" rel="noopener">
            Website <span aria-hidden="true">↗</span>
          </a>
        {/if}
      </div>

      <p class="member">Member since {memberSince(p.member_since)}</p>
    </div>
  </div>

  <hr class="rule" />

  <div class="body-grid">
    <div class="bio-block">
      {#if p.bio}
        <span class="eyebrow"><span class="num">01</span>About</span>
        <p class="bio">{p.bio}</p>
      {/if}

      {#if p.instagram_handle || p.facebook_url || p.tiktok_handle || p.linkedin_url || p.twitter_handle || p.youtube_url}
        <span class="eyebrow"><span class="num">02</span>Find them online</span>
        <ul class="socials">
          {#if p.instagram_handle}
            <li><a href={handleUrl("instagram", p.instagram_handle)} target="_blank" rel="noopener">
              Instagram <span class="handle">{p.instagram_handle}</span> <span aria-hidden="true">↗</span>
            </a></li>
          {/if}
          {#if p.tiktok_handle}
            <li><a href={handleUrl("tiktok", p.tiktok_handle)} target="_blank" rel="noopener">
              TikTok <span class="handle">{p.tiktok_handle}</span> <span aria-hidden="true">↗</span>
            </a></li>
          {/if}
          {#if p.twitter_handle}
            <li><a href={handleUrl("twitter", p.twitter_handle)} target="_blank" rel="noopener">
              X / Twitter <span class="handle">{p.twitter_handle}</span> <span aria-hidden="true">↗</span>
            </a></li>
          {/if}
          {#if p.facebook_url}
            <li><a href={p.facebook_url} target="_blank" rel="noopener">Facebook <span aria-hidden="true">↗</span></a></li>
          {/if}
          {#if p.linkedin_url}
            <li><a href={p.linkedin_url} target="_blank" rel="noopener">LinkedIn <span aria-hidden="true">↗</span></a></li>
          {/if}
          {#if p.youtube_url}
            <li><a href={p.youtube_url} target="_blank" rel="noopener">YouTube <span aria-hidden="true">↗</span></a></li>
          {/if}
        </ul>
      {/if}
    </div>

    <aside class="side">
      <span class="eyebrow"><span class="num">·</span>At a glance</span>
      <dl class="kv">
        <dt>Disciplines</dt>
        <dd class="kv-chips">
          {#each p.disciplines as d}<span class="kv-chip">{d}</span>{/each}
        </dd>

        {#if p.geographic_area}
          <dt>Area</dt><dd>{p.geographic_area}</dd>
        {/if}
        {#if playable}
          <dt>Playable age</dt><dd>{playable}</dd>
        {/if}

        {#if p.languages.length > 0}
          <dt>Languages</dt>
          <dd class="kv-chips">
            {#each p.languages as l}<span class="kv-chip subtle">{l}</span>{/each}
          </dd>
        {/if}
        {#if p.unions.length > 0}
          <dt>Unions</dt>
          <dd class="kv-chips">
            {#each p.unions as u}<span class="kv-chip">{u}</span>{/each}
          </dd>
        {/if}
        {#if p.ethnicities.length > 0}
          <dt>Ethnicity</dt>
          <dd class="kv-chips">
            {#each p.ethnicities as e}<span class="kv-chip subtle">{e}</span>{/each}
          </dd>
        {/if}
      </dl>

      <p class="report-note">
        See something off? <a href={`/report?profile=${p.slug}`}>Report this profile</a>.
      </p>
    </aside>
  </div>

  {#if showContact}
    <section id="contact-form" class="contact">
      <hr class="rule" />
      <span class="eyebrow"><span class="num">→</span>Contact</span>
      <h2 class="h2-section">Reach out to {split.first}.</h2>

      {#if form?.sent}
        <p class="lede">
          Message sent. {split.first} will reply directly from their own
          email - no need to come back here.
        </p>
      {:else}
        <p class="lede">
          Your message goes straight to {split.first}'s inbox. Their email
          is never shown here, but their reply will come from it.
        </p>

        <form
          method="POST"
          action="?/contact"
          use:enhance={() => {
            submitting = true;
            return async ({ update }) => {
              await update({ reset: false });
              submitting = false;
            };
          }}
        >
          <div class="honeypot" aria-hidden="true">
            <label for="website_url_extra">Leave empty</label>
            <input id="website_url_extra" name="website_url_extra" type="text" tabindex="-1" autocomplete="off" />
          </div>

          {#if errors._form}<div class="form-error" role="alert">{errors._form}</div>{/if}

          <label class="field">
            <span>Your name</span>
            <input name="sender_name" type="text" required value={form?.values?.senderName ?? ""} aria-invalid={!!errors.sender_name} />
            {#if errors.sender_name}<span class="error">{errors.sender_name}</span>{/if}
          </label>

          <label class="field">
            <span>Your email</span>
            <input name="sender_email" type="email" required value={form?.values?.senderEmail ?? ""} aria-invalid={!!errors.sender_email} />
            {#if errors.sender_email}<span class="error">{errors.sender_email}</span>{/if}
          </label>

          <label class="field">
            <span>Message</span>
            <textarea name="message" rows="6" required aria-invalid={!!errors.message}>{form?.values?.message ?? ""}</textarea>
            {#if errors.message}<span class="error">{errors.message}</span>{/if}
          </label>

          <button type="submit" class="bt bt-pri" disabled={submitting}>
            {submitting ? "Sending..." : "Send message"}
          </button>
        </form>
      {/if}
    </section>
  {/if}
</article>

<style>
  .profile {
    max-width: 1100px;
    margin: 0 auto;
    padding: clamp(1.5rem, 4vw, 3rem) var(--page-pad-x) 4rem;
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(260px, 360px) 1fr;
    gap: clamp(1.5rem, 4vw, 3rem);
    align-items: start;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .hero-name {
    margin: 0.5rem 0 0;
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    line-height: 0.95;
    letter-spacing: -0.04em;
    font-size: clamp(48px, 8vw, 96px);
  }
  .last {
    margin-left: 0.16em;
  }
  .pronouns {
    margin: 0;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .disc {
    margin: 0;
    font-family: var(--font-accent);
    font-style: italic;
    color: var(--ink-soft);
    font-size: clamp(18px, 2vw, 22px);
    text-transform: lowercase;
  }
  .area {
    color: var(--muted);
  }
  .chips {
    list-style: none;
    margin: 0.25rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    padding: 4px 11px;
    border-radius: 100px;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--ink-soft);
    background: transparent;
    border: 1px solid var(--rule);
  }
  .chip.solid {
    background: var(--paper);
    border-color: var(--paper);
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 0.75rem;
    flex-wrap: wrap;
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
    line-height: 1.2;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .bt-pri {
    background: var(--ink);
    color: var(--bg);
  }
  .bt-pri:hover:not(:disabled) {
    background: var(--accent);
    text-decoration: none;
  }
  .bt-ghost {
    background: transparent;
    color: var(--ink);
    border-color: var(--rule);
  }
  .bt-ghost:hover {
    border-color: var(--ink);
    text-decoration: none;
  }
  .bt:disabled {
    opacity: 0.5;
    cursor: progress;
  }
  .member {
    margin: 0.5rem 0 0;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .rule {
    border: 0;
    border-top: 1px solid var(--rule);
    margin: 2.5rem 0;
  }

  .body-grid {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: clamp(1.5rem, 4vw, 3rem);
    align-items: start;
  }
  .bio-block {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .bio-block .eyebrow {
    margin-top: 1rem;
  }
  .bio-block .eyebrow:first-child {
    margin-top: 0;
  }
  .bio {
    font-family: var(--font-body);
    font-size: 17px;
    line-height: 1.65;
    color: var(--ink-soft);
    margin: 0 0 0.5rem;
    white-space: pre-line;
  }
  .socials {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-family: var(--font-body);
    font-size: 13px;
  }
  .socials li {
    display: inline-flex;
  }
  .socials a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 100px;
    border: 1px solid var(--rule);
    color: var(--ink);
    text-decoration: none;
    background: var(--bg-raised);
    line-height: 1.2;
  }
  .socials a:hover {
    border-color: var(--ink);
    background: var(--paper);
    text-decoration: none;
  }
  .socials .handle {
    color: var(--muted);
    font-size: 12px;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.5rem;
    background: var(--paper);
    border-radius: var(--radius-lg);
  }
  .kv {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 0;
  }
  .kv dt {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 0 0 4px;
  }
  .kv dd {
    margin: 0;
    color: var(--ink);
    font-size: 14px;
    line-height: 1.4;
  }
  .kv-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .kv-chip {
    display: inline-flex;
    padding: 3px 9px;
    border-radius: 100px;
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--ink);
    line-height: 1.2;
  }
  .kv-chip.subtle {
    background: transparent;
    color: var(--ink-soft);
    border-style: dashed;
  }
  .report-note {
    margin: 1rem 0 0;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    line-height: 1.6;
  }
  .report-note a {
    color: var(--accent);
  }

  .contact {
    margin-top: 2rem;
    max-width: 600px;
  }
  .h2-section {
    margin: 0.5rem 0 1rem;
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    font-size: clamp(24px, 3vw, 32px);
    letter-spacing: -0.02em;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--ink-soft);
    line-height: 1.55;
    margin: 0 0 1.5rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 1rem;
  }
  .field > span:first-child {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .field input,
  .field textarea {
    padding: 10px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 15px;
    font-family: var(--font-body);
    background: var(--bg-raised);
  }
  .field input:focus,
  .field textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .field textarea {
    resize: vertical;
    min-height: 140px;
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
    padding: 10px 14px;
    border-radius: var(--radius);
    margin-bottom: 1rem;
    font-size: 14px;
  }
  .honeypot {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  @media (max-width: 900px) {
    .hero,
    .body-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
