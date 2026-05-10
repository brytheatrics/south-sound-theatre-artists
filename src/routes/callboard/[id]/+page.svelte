<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const { post, verifiedOrgName, isVerified, typeLabel } = data;

  function isClosingSoon(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000;
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const keyDates = $derived((post.key_dates ?? []) as [string, string][]);
  const closingSoon = $derived(isClosingSoon(post.expires_at));
</script>

<svelte:head>
  <title>{post.title} - {post.organization_name} - SSTA Callboard</title>
  <meta name="description" content="{post.organization_name}: {post.title}" />
</svelte:head>

<div class="back-row">
  <a class="back-link" href="/callboard">&larr; Back to callboard</a>
</div>

<div class="post-layout">
  <!-- MAIN COLUMN -->
  <main class="post-main">
    <div class="post-top">
      <span class="type-badge">{typeLabel}</span>
      {#if isVerified}
        <span class="verified-badge" title="Verified producing company">&#10003;</span>
        {#if verifiedOrgName}
          <span class="verified-label">Verified company</span>
        {/if}
      {/if}
    </div>

    <div class="post-org">
      <span class="org-name serif-it">{post.organization_name}</span>
      {#if post.location}
        <span class="post-location mono-label">{post.location}</span>
      {/if}
    </div>

    <h1 class="post-title">
      {#if post.is_ssta_event}
        <span class="ssta-pill" title="SSTA event">SSTA</span>
      {/if}
      {post.title}
    </h1>

    {#if post.compensation}
      <div class="comp-line mono-label">{post.compensation}</div>
    {/if}

    {#if post.roles && post.roles.length > 0}
      <div class="roles-row">
        {#each post.roles as role}
          <span class="chip">{role}</span>
        {/each}
      </div>
    {/if}

    {#if post.description}
      <div class="post-description">
        {post.description}
      </div>
    {/if}

    {#if post.ticket_url}
      <div class="ticket-row">
        <a class="bt bt-acc" href={post.ticket_url} target="_blank" rel="noopener">
          {post.post_type === "production" ? "Tickets & info" : "More info"} &rarr;
        </a>
      </div>
    {/if}

    {#if post.contact_info}
      <section class="contact-section">
        <div class="eyebrow"><span class="num">&rarr;</span>How to apply</div>
        <p class="contact-body">{post.contact_info}</p>
      </section>
    {/if}

    <div class="post-footer-meta mono-label">
      Posted {fmtDate(post.created_at)}
    </div>
  </main>

  <!-- SIDEBAR -->
  <aside class="post-sidebar">
    {#if keyDates.length > 0}
      <div class="sidebar-section">
        <div class="eyebrow">Key dates</div>
        <dl class="dates-list">
          {#each keyDates as [label, value]}
            <div class="date-row">
              <dt class="date-label">{label}</dt>
              <dd class="date-value">{value}</dd>
            </div>
          {/each}
        </dl>
      </div>
    {/if}

    {#if post.deadline_text}
      <div class="deadline-box" class:warn-deadline={closingSoon}>
        <span class="deadline-label mono-label">Deadline</span>
        <span class="deadline-val">{post.deadline_text}</span>
      </div>
      {#if closingSoon}
        <div class="eyebrow warn-text">&#9679; Closing soon</div>
      {/if}
    {/if}

    {#if post.contact_info}
      <div class="sidebar-section">
        <div class="eyebrow">How to apply</div>
        <p class="sidebar-contact">{post.contact_info}</p>
      </div>
    {/if}

    <div class="sidebar-post-cta">
      <a class="bt bt-pri" href="/callboard/submit">Post your own call</a>
      <a class="bt bt-ghost" href="/callboard">All open calls</a>
    </div>
  </aside>
</div>

<style>
  .back-row {
    padding: 1.25rem var(--page-pad-x) 0;
  }
  .back-link {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    text-decoration: none;
  }
  .back-link:hover { color: var(--ink); }

  .post-layout {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 3rem;
    padding: 2rem var(--page-pad-x) 4rem;
    align-items: start;
  }

  /* MAIN */
  .post-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 1rem;
  }
  .type-badge {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    background: var(--paper);
    border: 1px solid var(--rule);
    color: var(--ink);
    padding: 4px 8px;
    border-radius: 2px;
  }
  .verified-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
  }
  .verified-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .post-org {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }
  .org-name {
    font-size: 18px;
    color: var(--accent);
  }
  .post-location, .mono-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .ssta-pill {
    display: inline-block;
    padding: 0.05em 0.5em;
    margin-right: 0.4em;
    border-radius: 999px;
    background: var(--accent);
    color: white;
    font-family: var(--font-mono);
    font-size: 0.4em;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    vertical-align: 0.55em;
    font-weight: 600;
  }
  .post-title {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.04;
    margin: 0 0 1.25rem;
    color: var(--ink);
  }
  .comp-line {
    margin-bottom: 1rem;
  }
  .roles-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 1.25rem;
  }
  .post-description {
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.65;
    color: var(--ink-soft);
    white-space: pre-wrap;
    max-width: 640px;
    margin-bottom: 1.5rem;
  }
  .ticket-row { margin-bottom: 1.5rem; }
  .contact-section {
    border-top: 1px solid var(--rule-soft);
    padding-top: 1.5rem;
    margin-top: 1.5rem;
  }
  .contact-body {
    font-size: 15px;
    line-height: 1.6;
    color: var(--ink-soft);
    margin: 0.75rem 0 0;
    white-space: pre-wrap;
    max-width: 600px;
  }
  .post-footer-meta {
    margin-top: 2.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--rule-soft);
  }

  /* SIDEBAR */
  .post-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: sticky;
    top: 1.5rem;
  }
  .sidebar-section {
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 1rem 1.125rem;
  }
  .dates-list {
    margin: 0.75rem 0 0;
    display: flex;
    flex-direction: column;
  }
  .date-row {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.3rem 0;
    font-family: var(--font-body);
    font-size: 13.5px;
    color: var(--ink-soft);
    border-bottom: 1px solid var(--rule-soft);
  }
  .date-row:last-child { border-bottom: none; }
  .date-label { color: var(--muted); }
  .date-value { text-align: right; color: var(--ink); }
  .deadline-box {
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .warn-deadline { border-color: var(--warn); }
  .warn-deadline .deadline-val { color: var(--warn); }
  .deadline-val {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }
  .warn-text { color: var(--warn) !important; }
  .sidebar-contact {
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--ink-soft);
    margin: 0.5rem 0 0;
    white-space: pre-wrap;
  }
  .sidebar-post-cta {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* BUTTONS */
  .bt {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    padding: 9px 16px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1.2;
  }
  .bt-pri { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .bt-pri:hover { background: var(--accent); border-color: var(--accent); text-decoration: none; }
  .bt-acc { background: var(--accent); color: #fff; border-color: var(--accent); }
  .bt-acc:hover { background: var(--ink); border-color: var(--ink); text-decoration: none; }
  .bt-ghost { background: transparent; color: var(--ink); border-color: var(--rule); }
  .bt-ghost:hover { border-color: var(--ink); text-decoration: none; }

  @media (max-width: 720px) {
    .post-layout {
      grid-template-columns: 1fr;
    }
    .post-sidebar {
      position: static;
      order: -1;
      border-bottom: 1px solid var(--rule-soft);
      padding-bottom: 1.5rem;
    }
    .sidebar-post-cta { display: none; }
  }
</style>
