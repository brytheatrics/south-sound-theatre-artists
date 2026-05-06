<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const POST_TYPE_FALLBACK: Record<string, string> = {
    audition: "Audition",
    designer: "Designer call",
    crew: "Crew call",
    production: "Now playing",
    general: "Opportunity",
  };
  function labelFor(slug: string): string {
    return data.postTypeLabels[slug] ?? POST_TYPE_FALLBACK[slug] ?? "Opportunity";
  }

  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  function fmtDate(iso: string | null): string {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return "";
    return `${MONTHS[m - 1]} ${d}`;
  }
  function fmtRun(start: string | null, end: string | null): string {
    if (!start) return "";
    const a = fmtDate(start);
    if (!end || end === start) return a;
    return `${a} - ${fmtDate(end)}`;
  }

  function fmtNextDigest(iso: string): string {
    const d = new Date(iso);
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }
</script>

<svelte:head>
  <title>Weekly digest - South Sound Theatre Artists</title>
  <meta
    name="description"
    content="A preview of the weekly digest - the auditions, calls, and shows landing in subscribers' inboxes this Sunday."
  />
</svelte:head>

<main>
  <header class="hd">
    <span class="eyebrow"><span class="num">→</span>Weekly digest</span>
    <h1 class="h1-display">
      What's <span class="serif-it">happening</span>.
    </h1>
    <p class="lede">
      The same auditions, calls, and shows that go out by email every Sunday.
      Next digest sends {fmtNextDigest(data.nextDigestAt)}.
    </p>
  </header>

  <!-- Subscribe CTA. Visible right at the top - the page exists partly
       as a way to demo the digest content so people will subscribe. -->
  <section class="subscribe-cta">
    <div class="subscribe-copy">
      <h2 class="subscribe-h">Get this in your inbox.</h2>
      <p class="subscribe-body">
        Every Sunday evening, just the new stuff from the week, with the
        option to filter by post type, area, or category.
      </p>
    </div>
    <a class="bt subscribe-btn" href="/callboard/subscribe">
      Subscribe →
    </a>
  </section>

  <!-- Callboard slice: posts created in the past 7 days. -->
  <section class="block">
    <header class="block-hd">
      <h2 class="block-h">On the callboard</h2>
      <p class="block-sub">
        New auditions, designer / crew calls, and opportunities from the past week.
      </p>
    </header>
    {#if data.posts.length === 0}
      <p class="empty">Nothing new on the callboard this week.</p>
    {:else}
      <ul class="post-list">
        {#each data.posts as p (p.id)}
          <li class="post-row">
            <a class="post-link" href={`/callboard/${p.id}`}>
              <span class="post-type">{labelFor(p.post_type)}</span>
              <span class="post-title">
                <strong>{p.organization_name}</strong> - {p.title}
              </span>
              {#if p.deadline_text}
                <span class="post-tail">{p.deadline_text}</span>
              {:else if p.location}
                <span class="post-tail">{p.location}</span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- Calendar slice: productions opening in the next 14 days. -->
  <section class="block">
    <header class="block-hd">
      <h2 class="block-h">Opening soon</h2>
      <p class="block-sub">Productions starting in the next two weeks.</p>
    </header>
    {#if data.productions.length === 0}
      <p class="empty">Nothing new on the calendar this week.</p>
    {:else}
      <ul class="prod-list">
        {#each data.productions as p (p.id)}
          <li class="prod-row">
            <span class="prod-name">
              <strong>{p.organization_name}</strong> - {p.title}
            </span>
            <span class="prod-dates">{fmtRun(p.run_start, p.run_end)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <p class="footer-note">
    Want the full picture instead of a preview? <a href="/callboard">Browse the
    callboard</a> or check <a href="/calendar">what's playing</a>.
  </p>
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }
  .hd {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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
    max-width: 60ch;
  }

  /* Subscribe banner */
  .subscribe-cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    padding: 1.25rem 1.5rem;
    border: 1px solid var(--rule);
    border-left: 4px solid var(--accent);
    border-radius: var(--radius);
    background: color-mix(in oklch, var(--accent), var(--bg) 92%);
    margin-bottom: 2.5rem;
    flex-wrap: wrap;
  }
  .subscribe-copy {
    flex: 1 1 280px;
    min-width: 0;
  }
  .subscribe-h {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    font-size: 22px;
    margin: 0 0 0.25rem;
    letter-spacing: -0.01em;
  }
  .subscribe-body {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
    line-height: 1.5;
    margin: 0;
  }
  .subscribe-btn {
    background: var(--ink);
    color: var(--bg);
    padding: 12px 22px;
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    border: 1px solid var(--ink);
    white-space: nowrap;
  }
  .subscribe-btn:hover {
    background: var(--accent);
    border-color: var(--accent);
  }

  /* Section blocks */
  .block {
    margin-bottom: 2.5rem;
  }
  .block-hd {
    margin-bottom: 0.75rem;
  }
  .block-h {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    font-size: 22px;
    margin: 0 0 4px;
    letter-spacing: -0.01em;
  }
  .block-sub {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    line-height: 1.5;
    margin: 0;
  }
  .empty {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--muted);
    font-style: italic;
    margin: 0.5rem 0 0;
  }

  /* Post list */
  .post-list, .prod-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-raised);
  }
  .post-row, .prod-row {
    border-bottom: 1px solid var(--rule-soft);
  }
  .post-row:last-child, .prod-row:last-child {
    border-bottom: 0;
  }
  .post-link {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 12px;
    padding: 10px 14px;
    text-decoration: none;
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 14px;
  }
  .post-link:hover {
    background: color-mix(in oklch, var(--accent), var(--bg) 94%);
  }
  .post-type {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent);
    background: color-mix(in oklch, var(--accent), var(--bg) 88%);
    border: 1px solid color-mix(in oklch, var(--accent), var(--bg) 65%);
    padding: 2px 6px;
    border-radius: 2px;
    flex: 0 0 auto;
  }
  .post-title {
    flex: 1 1 auto;
    min-width: 0;
  }
  .post-tail {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    flex: 0 0 auto;
  }

  /* Productions list */
  .prod-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 10px 14px;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
    flex-wrap: wrap;
  }
  .prod-name {
    flex: 1 1 280px;
    min-width: 0;
  }
  .prod-dates {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    flex: 0 0 auto;
  }

  .footer-note {
    margin-top: 2rem;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    text-align: center;
    line-height: 1.6;
  }
  .footer-note a {
    color: var(--accent);
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }
  .num {
    color: var(--accent);
  }

  @media (max-width: 540px) {
    .subscribe-cta {
      flex-direction: column;
      align-items: stretch;
      text-align: left;
    }
    .subscribe-btn {
      align-self: flex-start;
    }
  }
</style>
