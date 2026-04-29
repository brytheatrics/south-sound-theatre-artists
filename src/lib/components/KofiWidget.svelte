<script lang="ts">
  import { env } from "$env/dynamic/public";

  // Ko-fi username comes from PUBLIC_KOFI_USERNAME so future renames
  // (or migrating away from Ko-fi entirely) is a one-line env update
  // instead of a code change. Empty -> widget hidden.
  const username = env.PUBLIC_KOFI_USERNAME ?? "";
  const embedUrl = $derived(
    username
      ? `https://ko-fi.com/${encodeURIComponent(username)}/?hidefeed=true&widget=true&embed=true&preview=true`
      : "",
  );
  const profileUrl = $derived(
    username ? `https://ko-fi.com/${encodeURIComponent(username)}` : "",
  );
</script>

{#if username}
  <section class="kofi" aria-label="Support via Ko-fi">
    <header class="kofi-head">
      <span class="eyebrow"><span class="num">+</span>Donate via Ko-fi</span>
      <p class="kofi-blurb">
        Donations cover hosting, domain renewal, and the small ongoing
        costs of keeping the directory running. Anything helps - even a
        one-time $3 coffee is genuinely useful. Donations are not tax
        deductible (we're not a 501(c)(3)).
      </p>
    </header>

    <div class="kofi-frame">
      <iframe
        title="Ko-fi donation widget"
        src={embedUrl}
        loading="lazy"
        height="680"
      ></iframe>
    </div>

    <p class="kofi-footer">
      Prefer a direct link?
      <a href={profileUrl} target="_blank" rel="noopener">
        Open Ko-fi page <span aria-hidden="true">↗</span>
      </a>
    </p>
  </section>
{/if}

<style>
  .kofi {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--rule);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .kofi-head {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .kofi-blurb {
    font-family: var(--font-body);
    font-size: 14.5px;
    line-height: 1.6;
    color: var(--ink-soft);
    margin: 0;
    max-width: 580px;
  }
  .kofi-frame {
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-raised);
  }
  .kofi-frame iframe {
    display: block;
    width: 100%;
    border: 0;
  }
  .kofi-footer {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }
  .kofi-footer a {
    color: var(--accent);
    text-decoration: none;
  }
  .kofi-footer a:hover {
    text-decoration: underline;
  }
</style>
