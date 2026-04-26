<script lang="ts">
  import HeadshotPlaceholder from "$lib/components/HeadshotPlaceholder.svelte";
  let { data } = $props();
  // svelte-ignore state_referenced_locally
  const p = data.profile;

  function splitName(full: string) {
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
  }
  const split = splitName(p.full_name);
</script>

<svelte:head>
  <title>{p.full_name} - South Sound Theatre Artists</title>
</svelte:head>

<main>
  <div class="grid">
    <div class="head">
      <HeadshotPlaceholder name={p.full_name} src={p.headshot_url} ratio="3 / 4" />
    </div>
    <div class="meta">
      <span class="eyebrow"><span class="num">·</span>Profile</span>
      <h1 class="hero-name">
        <span>{split.first}</span>{#if split.last}<span class="serif-it ln">{split.last}</span>{/if}
      </h1>
      {#if p.pronouns}<p class="pronouns">{p.pronouns}</p>{/if}
      <p class="disc">
        {p.disciplines.join(" · ")}
        {#if p.geographic_area}<span class="area"> · {p.geographic_area}</span>{/if}
      </p>
      {#if p.bio}
        <hr class="rule" />
        <p class="bio">{p.bio}</p>
      {/if}
      <p class="placeholder-note">
        Full profile page lands in step 11. Headshot, contact form, and
        the credits / training sections come with it.
      </p>
    </div>
  </div>
</main>

<style>
  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) 4rem;
  }
  .grid {
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
  .ln {
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
    color: var(--ink-soft);
    font-size: 15px;
    text-transform: lowercase;
  }
  .area {
    color: var(--muted);
  }
  .bio {
    margin: 0;
    color: var(--ink-soft);
    font-size: 16px;
    line-height: 1.65;
  }
  .rule {
    margin: 0.5rem 0;
  }
  .placeholder-note {
    margin-top: 1.5rem;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
