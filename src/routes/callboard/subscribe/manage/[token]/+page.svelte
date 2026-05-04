<script lang="ts">
  import SubscribeFiltersForm from "$lib/components/SubscribeFiltersForm.svelte";
  let { data, form } = $props();

  const initialPickedTypes = $derived(new Set<string>(data.initialPickedTypes));
  const initialPickedCallboardAreas = $derived(new Set<string>(data.initialPickedCallboardAreas));
  const initialPickedCategories = $derived(new Set<string>(data.initialPickedCategories));
  const initialPickedCalendarAreas = $derived(new Set<string>(data.initialPickedCalendarAreas));
</script>

<svelte:head>
  <title>Manage your digest preferences - SSTA</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="page">
  <span class="eyebrow"><span class="num">·</span>Your digest</span>
  <h1 class="h1-display">Manage <span class="serif-it">preferences</span>.</h1>
  <p class="lede">
    Adjust what shows up in your weekly digest. Saving takes effect
    immediately - no email reconfirmation needed. Reading <strong>{data.email}</strong>.
  </p>

  <SubscribeFiltersForm
    mode="manage"
    postTypes={data.postTypes}
    callboardAreas={data.areas}
    categories={data.categories}
    calendarAreas={data.areas}
    initialPickedTypes={initialPickedTypes}
    initialPickedCallboardAreas={initialPickedCallboardAreas}
    initialPickedCategories={initialPickedCategories}
    initialPickedCalendarAreas={initialPickedCalendarAreas}
    formError={form?.error}
    saved={form?.saved === true}
  />

  <p class="footer-link">
    Want to unsubscribe entirely? <a href="/callboard/unsubscribe/{(typeof window !== 'undefined') ? window.location.pathname.split('/').pop() : ''}">Unsubscribe →</a>
  </p>
</main>

<style>
  .page {
    max-width: 580px;
    margin: 0 auto;
    padding: clamp(2.5rem, 6vw, 4rem) var(--page-pad-x);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .h1-display { margin: 0.25rem 0 0.5rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--muted);
    margin: 0 0 1.5rem;
    max-width: 50ch;
  }
  .lede strong { color: var(--ink); font-style: normal; font-family: var(--font-mono); font-size: 14px; }
  .footer-link {
    margin-top: 1rem;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .footer-link a { color: var(--accent); }
</style>
