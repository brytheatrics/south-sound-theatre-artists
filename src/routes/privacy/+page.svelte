<svelte:head>
  <title>Privacy - South Sound Theatre Artists</title>
</svelte:head>

<main>
  <span class="eyebrow"><span class="num">·</span>Legal</span>
  <h1 class="h1-display">Privacy.</h1>

  <p class="draft-banner">
    Draft text - not yet reviewed by a lawyer or template service. Real
    privacy policy lands before public launch.
  </p>

  <h2 class="h2-section">What we collect</h2>
  <p class="body">
    The email address you use to submit a profile, the profile fields you
    fill in, and the headshot file (if you upload one). On public pages we
    don't run analytics that profile individuals.
  </p>

  <h2 class="h2-section">How we use it</h2>
  <p class="body">
    Profile fields appear on your public profile page and in directory
    search results. Your email is never displayed publicly - it's used to
    send you your edit link and to route messages from the contact form.
  </p>

  <h2 class="h2-section">Where it lives</h2>
  <p class="body">
    Profile data sits in a Supabase Postgres database. Headshots sit on
    Cloudinary. Outbound email goes through Resend.
  </p>

  <h2 class="h2-section">How to remove it</h2>
  <p class="body">
    Use your magic-link edit page to unpublish or delete your profile, or
    email the admin and we'll handle it.
  </p>
</main>

<style>
  main {
    max-width: 700px;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) var(--page-pad-x) 4rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .h1-display {
    margin: 0.5rem 0 1rem;
  }
  .h2-section {
    margin: 1.5rem 0 0.25rem;
  }
  .body {
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.65;
    color: var(--ink-soft);
    margin: 0;
    max-width: 560px;
  }
  .draft-banner {
    background: color-mix(in oklch, var(--warn), var(--bg) 80%);
    border: 1px solid var(--warn);
    color: var(--warn);
    padding: 12px 16px;
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.5;
    margin: 0 0 1.5rem;
  }
</style>
