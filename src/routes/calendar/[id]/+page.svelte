<script lang="ts">
  import HeadshotPlaceholder from "$lib/components/HeadshotPlaceholder.svelte";

  let { data } = $props();
  // Supabase types the FK join `organizations` as an array even though
  // we set it up as a single org. Coerce here so the template can read
  // .name / .slug directly.
  type Org = { id: string; name: string; slug: string; homepage_url: string | null; logo_url: string | null };
  type Production = {
    id: string; title: string; description: string | null;
    run_start: string; run_end: string | null; show_dates: string | null;
    detail_url: string | null; cover_url: string | null;
    status: string; category_id: string | null;
    organizations: Org | Org[] | null; category_name: string | null;
  };
  // svelte-ignore state_referenced_locally
  const p: Omit<Production, "organizations"> & { organizations: Org | null } = (() => {
    const raw = data.production as Production;
    const orgs = raw.organizations;
    const orgFirst = Array.isArray(orgs) ? orgs[0] ?? null : orgs;
    return { ...raw, organizations: orgFirst };
  })();
  // svelte-ignore state_referenced_locally
  const credits = data.credits;
  // svelte-ignore state_referenced_locally
  const profileMap = data.profileMap as Record<
    string,
    { slug: string; headshot_url: string | null; full_name: string }
  >;

  function fmtDate(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function fmtRunRange(): string {
    if (p.run_start && p.run_end && p.run_start !== p.run_end) {
      return `${fmtDate(p.run_start)} - ${fmtDate(p.run_end)}`;
    }
    if (p.run_start) return fmtDate(p.run_start);
    return "";
  }

  const hasCredits =
    credits.cast.length > 0 ||
    credits.creative.length > 0 ||
    credits.crew.length > 0;
</script>

<svelte:head>
  <title>{p.title} - South Sound Theatre Artists</title>
  <meta
    name="description"
    content={p.description ? p.description.slice(0, 160) : `${p.title} at ${p.organizations?.name ?? "South Sound theatre"}`}
  />
  {#if p.cover_url}
    <meta property="og:image" content={p.cover_url} />
  {/if}
</svelte:head>

<article class="prod">
  {#if p.cover_url}
    <div class="cover">
      <img src={p.cover_url} alt={`${p.title} poster`} />
    </div>
  {/if}
  <header class="head">
    <span class="eyebrow">
      <span class="num">·</span>{p.category_name ?? "Production"}
    </span>
    <h1 class="title">{p.title}</h1>
    {#if p.organizations}
      <p class="org">
        <a href={`/theatres#${p.organizations.slug}`}>{p.organizations.name}</a>
      </p>
    {/if}
    {#if fmtRunRange()}
      <p class="dates">{fmtRunRange()}</p>
    {/if}
    {#if p.show_dates}
      <p class="dates-detail">{p.show_dates}</p>
    {/if}
    {#if p.detail_url || p.organizations?.homepage_url}
      <p class="cta">
        <a
          class="bt-pri"
          href={p.detail_url ?? p.organizations!.homepage_url!}
          target="_blank"
          rel="noopener"
        >
          {p.detail_url ? "Tickets & details" : `Visit ${p.organizations!.name}`}
          <span aria-hidden="true">↗</span>
        </a>
      </p>
    {/if}
  </header>

  {#if p.description}
    <hr class="rule" />
    <section class="block">
      <span class="eyebrow"><span class="num">01</span>About</span>
      <p class="desc">{p.description}</p>
    </section>
  {/if}

  {#if hasCredits}
    <hr class="rule" />
    <section class="block">
      <span class="eyebrow"><span class="num">02</span>Cast & creative</span>

      {#if credits.cast.length > 0}
        <h3 class="sub-h">Cast</h3>
        <ul class="credits">
          {#each credits.cast as c (c.id)}
            {@const linked = c.profile_id ? profileMap[c.profile_id] : null}
            <li class="cred">
              <div class="ava">
                {#if linked}
                  <a href={`/artists/${linked.slug}`}>
                    <HeadshotPlaceholder
                      name={linked.full_name}
                      src={linked.headshot_url}
                      ratio="1 / 1"
                    />
                  </a>
                {:else}
                  <HeadshotPlaceholder name={c.display_name} src={null} ratio="1 / 1" />
                {/if}
              </div>
              <div class="cred-text">
                <strong>
                  {#if linked}
                    <a class="cred-link" href={`/artists/${linked.slug}`}>{c.display_name}</a>
                  {:else}{c.display_name}{/if}
                </strong>
                {#if c.position}<span class="cred-position">{c.position}</span>{/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}

      {#if credits.creative.length > 0}
        <h3 class="sub-h">Creative team</h3>
        <ul class="credits compact">
          {#each credits.creative as c (c.id)}
            {@const linked = c.profile_id ? profileMap[c.profile_id] : null}
            <li class="cred row">
              <span class="cred-text">
                <strong>{c.position}:</strong>
                {#if linked}
                  <a class="cred-link" href={`/artists/${linked.slug}`}>{c.display_name}</a>
                {:else}{c.display_name}{/if}
              </span>
            </li>
          {/each}
        </ul>
      {/if}

      {#if credits.crew.length > 0}
        <h3 class="sub-h">Crew</h3>
        <ul class="credits compact">
          {#each credits.crew as c (c.id)}
            {@const linked = c.profile_id ? profileMap[c.profile_id] : null}
            <li class="cred row">
              <span class="cred-text">
                <strong>{c.position}:</strong>
                {#if linked}
                  <a class="cred-link" href={`/artists/${linked.slug}`}>{c.display_name}</a>
                {:else}{c.display_name}{/if}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</article>

<style>
  .prod {
    max-width: 760px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }
  .cover {
    margin-bottom: 1.5rem;
    display: flex;
    justify-content: center;
  }
  .cover img {
    max-width: 100%;
    max-height: 540px;
    border-radius: var(--radius);
    border: 1px solid var(--rule);
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    display: inline-flex;
    gap: 8px;
  }
  .num {
    color: var(--accent);
  }
  .title {
    font-family: var(--font-display);
    font-size: clamp(34px, 6vw, 56px);
    font-weight: 600;
    margin: 0.25rem 0 0;
    letter-spacing: -0.025em;
    line-height: 1.05;
    color: var(--ink);
  }
  .org {
    margin: 0.25rem 0 0;
    font-family: var(--font-body);
    font-size: 17px;
    color: var(--ink);
  }
  .org a {
    color: var(--ink);
    text-decoration: none;
    border-bottom: 1px solid var(--rule);
  }
  .org a:hover {
    border-bottom-color: var(--accent);
    color: var(--accent);
  }
  .dates {
    margin: 0.25rem 0 0;
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--ink-soft);
  }
  .dates-detail {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
  }
  .cta {
    margin-top: 0.75rem;
  }
  .bt-pri {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 22px;
    background: var(--ink);
    color: var(--bg);
    border: 1px solid var(--ink);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 500;
    text-decoration: none;
  }
  .bt-pri:hover {
    background: var(--accent);
    border-color: var(--accent);
  }
  .rule {
    border: 0;
    border-top: 1px solid var(--rule);
    margin: 2rem 0;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .desc {
    margin: 0;
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.6;
    color: var(--ink);
    white-space: pre-line;
  }
  .sub-h {
    margin: 0.5rem 0 0;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    font-weight: 500;
  }
  .credits {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
  }
  .credits.compact {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cred {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cred.row {
    flex-direction: row;
    gap: 6px;
    align-items: baseline;
  }
  .ava {
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .ava :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .ava a {
    display: block;
    width: 100%;
    height: 100%;
  }
  .cred-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
  }
  .cred.row .cred-text {
    flex-direction: row;
    gap: 6px;
    flex-wrap: wrap;
  }
  .cred-position {
    font-size: 12px;
    color: var(--muted);
  }
  .cred-link {
    color: var(--ink);
    text-decoration: none;
    border-bottom: 1px solid var(--rule);
  }
  .cred-link:hover {
    border-bottom-color: var(--accent);
    color: var(--accent);
  }
</style>
