<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function fmtRelative(iso: string | null): string {
    if (!iso) return "—";
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return `${Math.floor(ms / 86_400_000)}d ago`;
  }

  // Render a value for the diff column. Strings render as quoted text
  // unless very long; arrays render as bracketed comma-joined; null/""
  // render as "(empty)". Objects (resumes jsonb) get a compact JSON.
  function renderValue(v: unknown): string {
    if (v === null || v === "") return "(empty)";
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      return "[" + v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(", ") + "]";
    }
    if (typeof v === "object") return JSON.stringify(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    return String(v);
  }

  // Pretty label for tracked field names.
  const FIELD_LABELS: Record<string, string> = {
    full_name: "Name",
    slug: "URL slug",
    email: "Email",
    pronouns: "Pronouns",
    phone: "Phone",
    bio: "Bio",
    headshot_url: "Headshot",
    headshot_consent: "Headshot consent",
    geographic_area: "Area",
    city: "City",
    playable_age_min: "Playable age min",
    playable_age_max: "Playable age max",
    languages: "Languages",
    disciplines: "Disciplines",
    unions: "Unions",
    ethnicities: "Ethnicities",
    instagram_handle: "Instagram",
    facebook_url: "Facebook",
    tiktok_handle: "TikTok",
    linkedin_url: "LinkedIn",
    twitter_handle: "Twitter",
    youtube_url: "YouTube",
    website_url: "Website",
    resumes: "Resumes",
    mentorship_offering: "Mentoring",
    mentorship_seeking: "Learning",
    is_minor: "Minor flag",
    guardian_email: "Guardian email",
    guardian_name: "Guardian name",
    published: "Published",
    auto_hidden_incomplete: "Auto-hidden",
    admin_note: "Admin note",
  };

  function fieldLabel(f: string): string {
    return FIELD_LABELS[f] ?? f;
  }
</script>

<svelte:head>
  <title>Recent edits - Admin</title>
</svelte:head>

<main>
  <header>
    <h1>Recent edits</h1>
    <p class="lede">
      Audit log of every profile save since this feature shipped. Each
      row shows who saved, when, and exactly which fields changed
      (old -> new). History starts at the migration boundary; pre-existing
      edits aren't backfilled.
    </p>
  </header>

  {#if data.rows.length === 0}
    <p class="empty">No edits logged yet. The first save will show up here.</p>
  {:else}
    <ol class="log">
      {#each data.rows as r (r.id)}
        <li class="entry">
          <div class="entry-head">
            <a class="who" href="/artists/{r.profile_slug}" target="_blank" rel="noopener">{r.profile_name}</a>
            <span class="kind kind-{r.edited_by_kind}">{r.edited_by_kind}</span>
            {#if r.edited_by_email}
              <span class="email">{r.edited_by_email}</span>
            {/if}
            <span class="when">{fmtRelative(r.edited_at)}</span>
            <a class="adminlink" href="/admin/profiles/{r.profile_id}/edit">Open editor →</a>
          </div>
          <dl class="changes">
            {#each Object.entries(r.changes) as [field, diff] (field)}
              <div class="change">
                <dt>{fieldLabel(field)}</dt>
                <dd>
                  <span class="old">{renderValue(diff.old)}</span>
                  <span class="arrow">→</span>
                  <span class="new">{renderValue(diff.new)}</span>
                </dd>
              </div>
            {/each}
          </dl>
        </li>
      {/each}
    </ol>
  {/if}
</main>

<style>
  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem var(--page-pad-x);
  }
  h1 { font-family: var(--font-display); font-size: 2rem; margin: 0 0 0.5rem; }
  .lede { color: var(--ink-soft); margin: 0 0 2rem; max-width: 60ch; font-size: 14px; }
  .empty { color: var(--muted); font-style: italic; }

  .log {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .entry {
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
  }
  .entry-head {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--rule-soft);
  }
  .who {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--accent);
    text-decoration: none;
  }
  .who:hover { text-decoration: underline; }
  .kind {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1px solid var(--rule);
    color: var(--ink-soft);
  }
  .kind-artist { color: var(--accent); border-color: var(--accent); }
  .kind-admin { color: var(--warn); border-color: var(--warn); }
  .kind-org { color: var(--ink); border-color: var(--ink); }
  .email {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
  }
  .when {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
  }
  .adminlink {
    font-size: 12px;
    color: var(--accent);
    text-decoration: none;
  }
  .adminlink:hover { text-decoration: underline; }

  .changes {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .change {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 0.5rem;
    align-items: baseline;
  }
  .change dt {
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .change dd {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--ink);
    word-break: break-word;
  }
  .old {
    background: color-mix(in oklch, var(--warn), transparent 90%);
    padding: 1px 4px;
    border-radius: 2px;
    color: var(--ink-soft);
    text-decoration: line-through;
    text-decoration-color: color-mix(in oklch, var(--warn), transparent 50%);
  }
  .new {
    background: color-mix(in oklch, var(--accent), transparent 90%);
    padding: 1px 4px;
    border-radius: 2px;
  }
  .arrow {
    color: var(--muted);
    margin: 0 0.25rem;
    font-family: var(--font-mono);
  }
</style>
