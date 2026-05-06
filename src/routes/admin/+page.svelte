<script lang="ts">
  import { enhance } from "$app/forms";

  let { data, form } = $props();

  let openId = $state<string | null>(null);
  let rejectingId = $state<string | null>(null);
  let busyId = $state<string | null>(null);

  function toggle(id: string) {
    openId = openId === id ? null : id;
    rejectingId = null;
  }

  function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function fmtPlayable(min: number | null, max: number | null): string {
    if (min == null || max == null) return "—";
    return `${min}-${max}`;
  }
</script>

<svelte:head>
  <title>Pending queue - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · queue</span>
  <h1 class="h1-display">Pending review.</h1>
  <p class="lede">
    {data.submissions.length}
    {data.submissions.length === 1 ? "submission" : "submissions"} waiting.
  </p>
  {#if data.callboardPendingCount > 0}
    <div class="queue-notice">
      <a href="/admin/callboard?status=pending_review" class="queue-notice-link">
        {data.callboardPendingCount} callboard
        {data.callboardPendingCount === 1 ? "post" : "posts"} pending review &rarr;
      </a>
    </div>
  {/if}
  {#if data.orgsPendingCount > 0}
    <div class="queue-notice">
      <a href="/admin/organizations" class="queue-notice-link">
        {data.orgsPendingCount} organization
        {data.orgsPendingCount === 1 ? "application" : "applications"} pending &rarr;
      </a>
    </div>
  {/if}
  {#if form?.error}
    <div class="form-error" role="alert">{form.error}</div>
  {/if}
  {#if form?.approved}
    <div class="form-ok" role="status">Approved {form.approved}.</div>
  {/if}
  {#if form?.rejected}
    <div class="form-ok" role="status">Rejected {form.rejected}.</div>
  {/if}
  {#if form?.resentTo}
    <div class="form-ok" role="status">Verification email resent to {form.resentTo}.</div>
  {/if}
</header>

{#if data.submissions.length === 0}
  <p class="empty">Nothing in the queue. Check back when new submissions roll in.</p>
{:else}
  <ul class="queue">
    {#each data.submissions as s (s.id)}
      <li class="row" class:open={openId === s.id}>
        <button class="row-head" onclick={() => toggle(s.id)} type="button">
          <div class="row-left">
            <span class="row-name">{s.full_name}</span>
            <span class="row-meta">
              {s.email}
              <span class="dot" aria-hidden="true">·</span>
              {s.disciplines.slice(0, 2).join(" · ")}{s.disciplines.length > 2 ? " +" + (s.disciplines.length - 2) : ""}
              <span class="dot" aria-hidden="true">·</span>
              {s.geographic_area ?? "—"}
            </span>
          </div>
          <span class="row-ago">{timeAgo(s.created_at)}</span>
        </button>

        {#if openId === s.id}
          <div class="row-detail">
            <div class="grid">
              <dl class="kv">
                <dt>Pronouns</dt><dd>{s.pronouns ?? "—"}</dd>
                <dt>Slug</dt><dd><code>/artists/{s.desired_slug}</code></dd>
                <dt>Disciplines</dt><dd>{s.disciplines.join(" · ")}</dd>
                <dt>Area</dt><dd>{s.geographic_area ?? "—"}</dd>
                <dt>Playable age</dt><dd>{fmtPlayable(s.playable_age_min, s.playable_age_max)}</dd>
                <dt>Languages</dt><dd>{s.languages.join(", ") || "—"}</dd>
                <dt>Unions</dt><dd>{s.unions.join(", ") || "—"}</dd>
                <dt>Ethnicities</dt><dd>{s.ethnicities.join(", ") || "—"}</dd>
                <dt>Headshot consent</dt><dd>{s.headshot_consent ? "yes" : "no"}</dd>
              </dl>
              {#if s.headshot_url}
                <a href={s.headshot_url} target="_blank" rel="noopener" class="headshot-link">
                  <img src={s.headshot_url} alt={`${s.full_name} headshot`} />
                </a>
              {:else}
                <div class="headshot-link no-img">No headshot</div>
              {/if}
            </div>

            {#if s.bio}
              <h3 class="block-h">Bio</h3>
              <p class="block-bio">{s.bio}</p>
            {/if}

            {#if Array.isArray(s.resumes) && s.resumes.length > 0}
              <h3 class="block-h">Resume PDFs</h3>
              <ul class="links">
                {#each s.resumes as r}
                  <li>
                    <a href={r.url} target="_blank" rel="noopener">
                      {r.label}: {r.url.split("/").pop()}
                    </a>
                  </li>
                {/each}
              </ul>
            {/if}

            {#if s.resume_data && (
              (s.resume_data.credits?.length ?? 0) +
              (s.resume_data.training?.length ?? 0) +
              (s.resume_data.skills?.length ?? 0)
            ) > 0}
              <h3 class="block-h">Resume builder</h3>
              <p class="block-bio">
                {s.resume_data.credits?.length ?? 0} credit{(s.resume_data.credits?.length ?? 0) === 1 ? "" : "s"},
                {s.resume_data.training?.length ?? 0} training,
                {s.resume_data.skills?.length ?? 0} skill group{(s.resume_data.skills?.length ?? 0) === 1 ? "" : "s"}
                <br>
                <a href={`/artists/${s.desired_slug}`} target="_blank" rel="noopener" class="link-soft">
                  Preview profile (after approval) ↗
                </a>
              </p>
            {/if}

            {#if s.instagram_handle || s.facebook_url || s.tiktok_handle || s.linkedin_url || s.twitter_handle || s.youtube_url || s.website_url}
              <h3 class="block-h">Links</h3>
              <ul class="links">
                {#if s.website_url}<li><a href={s.website_url} target="_blank" rel="noopener">Website: {s.website_url}</a></li>{/if}
                {#if s.instagram_handle}<li>Instagram: {s.instagram_handle}</li>{/if}
                {#if s.tiktok_handle}<li>TikTok: {s.tiktok_handle}</li>{/if}
                {#if s.twitter_handle}<li>X/Twitter: {s.twitter_handle}</li>{/if}
                {#if s.facebook_url}<li><a href={s.facebook_url} target="_blank" rel="noopener">Facebook: {s.facebook_url}</a></li>{/if}
                {#if s.linkedin_url}<li><a href={s.linkedin_url} target="_blank" rel="noopener">LinkedIn: {s.linkedin_url}</a></li>{/if}
                {#if s.youtube_url}<li><a href={s.youtube_url} target="_blank" rel="noopener">YouTube: {s.youtube_url}</a></li>{/if}
              </ul>
            {/if}

            <div class="actions">
              <form
                method="POST"
                action="?/approve"
                use:enhance={() => {
                  busyId = s.id;
                  return async ({ update }) => {
                    await update();
                    busyId = null;
                  };
                }}
              >
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" class="bt bt-pri" disabled={busyId === s.id}>
                  {busyId === s.id ? "Approving..." : "Approve"}
                </button>
              </form>
              <button
                type="button"
                class="bt bt-ghost"
                onclick={() => (rejectingId = rejectingId === s.id ? null : s.id)}
              >
                {rejectingId === s.id ? "Cancel reject" : "Reject"}
              </button>
            </div>

            {#if rejectingId === s.id}
              <form
                method="POST"
                action="?/reject"
                class="reject-form"
                use:enhance={() => {
                  busyId = s.id;
                  return async ({ update }) => {
                    await update();
                    busyId = null;
                  };
                }}
              >
                <input type="hidden" name="id" value={s.id} />
                <label class="field">
                  <span>Reason (sent to the artist)</span>
                  <textarea
                    name="reason"
                    rows="3"
                    required
                    placeholder="Headshot is too low-resolution to use - upload a 1200px-min image and resubmit."
                  ></textarea>
                </label>
                <button type="submit" class="bt bt-warn" disabled={busyId === s.id}>
                  {busyId === s.id ? "Sending..." : "Send rejection"}
                </button>
              </form>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<!-- Floating submissions: someone hit /submit but never clicked the
     verification link. Without this surface they're invisible to admin.
     Resend regenerates the verification token and re-fires the email
     so it lands in their inbox (or a fresh inbox if they hit the wrong
     address the first time). -->
{#if data.awaitingVerification.length > 0}
  <section class="await-section">
    <header class="await-hd">
      <h2 class="await-h">Awaiting email verification</h2>
      <p class="await-sub">
        {data.awaitingVerification.length}
        {data.awaitingVerification.length === 1 ? "submission" : "submissions"}
        submitted but never clicked the verification link. Resend the email
        if it might have ended up in spam or the artist took longer than 24
        hours.
      </p>
    </header>
    <ul class="await-list">
      {#each data.awaitingVerification as a (a.id)}
        {@const expired = new Date(a.email_verification_expires_at) < new Date()}
        <li class="await-row">
          <div class="await-info">
            <span class="await-name">{a.full_name}</span>
            <span class="await-meta">
              {a.email}
              <span class="dot" aria-hidden="true">·</span>
              {a.disciplines?.slice(0, 2).join(" · ") || "—"}
              <span class="dot" aria-hidden="true">·</span>
              {a.geographic_area ?? "—"}
            </span>
            <span class="await-stamps">
              <span class="ago">submitted {timeAgo(a.created_at)}</span>
              <span
                class="link-state"
                class:expired
                title={expired
                  ? "The original verification link has expired."
                  : "The original verification link is still valid."}
              >
                {expired ? "link expired" : "link valid"}
              </span>
            </span>
          </div>
          <form
            method="POST"
            action="?/resendVerification"
            use:enhance={() => {
              busyId = a.id;
              return async ({ update }) => {
                await update();
                busyId = null;
              };
            }}
          >
            <input type="hidden" name="id" value={a.id} />
            <button type="submit" class="bt bt-ghost" disabled={busyId === a.id}>
              {busyId === a.id ? "Sending..." : "Resend verification"}
            </button>
          </form>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .hd {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 800px;
    margin-bottom: 2rem;
  }
  .h1-display {
    margin: 0.5rem 0 0.25rem;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--muted);
    margin: 0 0 0.5rem;
  }
  .form-error,
  .form-ok {
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 14px;
    font-family: var(--font-body);
    margin-top: 0.5rem;
  }
  .form-error {
    background: color-mix(in oklch, var(--error), var(--bg) 80%);
    border: 1px solid var(--error);
    color: var(--error);
  }
  .form-ok {
    background: color-mix(in oklch, var(--accent), var(--bg) 85%);
    border: 1px solid var(--accent);
    color: var(--accent);
  }
  .empty {
    color: var(--muted);
    font-family: var(--font-accent);
    font-style: italic;
    padding: 3rem 0;
    text-align: center;
  }

  .queue {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--bg-raised);
  }
  .row {
    border-bottom: 1px solid var(--rule-soft);
  }
  .row:last-child {
    border-bottom: 0;
  }
  .row.open {
    background: var(--bg);
    border-left: 2px solid var(--accent);
  }

  .row-head {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 14px 18px;
    background: transparent;
    border: 0;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-body);
    color: var(--ink);
  }
  .row-head:hover {
    background: var(--paper);
  }
  .row-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .row-name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 16px;
    color: var(--ink);
  }
  .row-meta {
    font-size: 13px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dot {
    margin: 0 6px;
  }
  .row-ago {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    white-space: nowrap;
  }

  .row-detail {
    padding: 1.25rem 1.25rem 1.5rem;
    border-top: 1px solid var(--rule-soft);
    background: var(--paper);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 180px;
    gap: 1.5rem;
    align-items: start;
  }
  .kv {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 16px;
    margin: 0;
    font-size: 13px;
  }
  .kv dt {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 0;
  }
  .kv dd {
    margin: 0;
    color: var(--ink);
  }
  .kv code {
    font-family: var(--font-mono);
    font-size: 12px;
    background: var(--bg-raised);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .headshot-link {
    display: block;
    width: 180px;
    aspect-ratio: 3 / 4;
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .headshot-link img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .headshot-link.no-img {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .block-h {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 1.25rem 0 0.4rem;
    font-weight: 500;
  }
  .block-bio {
    margin: 0;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
    line-height: 1.55;
  }
  .links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
  }
  .links a {
    color: var(--accent);
    word-break: break-all;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 1.5rem;
  }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 9px 18px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
  }
  .bt-pri {
    background: var(--ink);
    color: var(--bg);
  }
  .bt-pri:hover:not(:disabled) {
    background: var(--accent);
  }
  .bt-ghost {
    background: transparent;
    color: var(--ink);
    border-color: var(--rule);
  }
  .bt-ghost:hover:not(:disabled) {
    border-color: var(--ink);
  }
  .bt-warn {
    background: var(--error);
    color: #fff;
  }
  .bt-warn:hover:not(:disabled) {
    background: var(--ink);
  }
  .bt:disabled {
    opacity: 0.5;
    cursor: progress;
  }

  .reject-form {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .reject-form .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .reject-form .field span {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .reject-form textarea {
    padding: 10px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg);
    resize: vertical;
  }
  .reject-form textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }

  @media (max-width: 720px) {
    .grid {
      grid-template-columns: 1fr;
    }
    .row-meta {
      white-space: normal;
    }
  }

  /* ============================================================
     Awaiting email verification
     ============================================================ */
  .await-section {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid var(--rule);
  }
  .await-hd {
    margin-bottom: 1rem;
    max-width: 640px;
  }
  .await-h {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    font-size: 20px;
    margin: 0 0 4px;
    letter-spacing: -0.01em;
  }
  .await-sub {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    line-height: 1.5;
    margin: 0;
  }
  .await-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-raised);
  }
  .await-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--rule-soft);
    flex-wrap: wrap;
  }
  .await-row:last-child {
    border-bottom: 0;
  }
  .await-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1 1 280px;
  }
  .await-name {
    font-family: var(--font-body);
    font-weight: 500;
    color: var(--ink);
    font-size: 14px;
  }
  .await-meta {
    font-family: var(--font-body);
    font-size: 12.5px;
    color: var(--ink-soft);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .await-stamps {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
  }
  .ago {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .link-state {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent);
    background: color-mix(in oklch, var(--accent), var(--bg) 88%);
    border: 1px solid color-mix(in oklch, var(--accent), var(--bg) 65%);
    padding: 2px 6px;
    border-radius: 2px;
  }
  .link-state.expired {
    color: var(--muted);
    background: var(--paper);
    border-color: var(--rule);
  }
</style>
