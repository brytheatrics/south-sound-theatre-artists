<script lang="ts">
  import SubscribeFiltersForm from "$lib/components/SubscribeFiltersForm.svelte";
  let { data, form } = $props();

  // For new signups, pre-tick every option in every dimension so the
  // default reads as "send me the firehose" - the server's "ticked all
  // = empty array = no filter" convention picks that up correctly.
  const allTypeSlugs = $derived(
    new Set(data.postTypes.map((t: { slug: string }) => t.slug)),
  );
  const allAreaIds = $derived(
    new Set(data.areas.map((a: { id: string }) => a.id)),
  );
  const allCategoryIds = $derived(
    new Set(data.categories.map((c: { id: string }) => c.id)),
  );
</script>

<svelte:head>
  <title>Weekly digest signup - SSTA</title>
</svelte:head>

<main class="page">
  {#if data.sent}
    <span class="eyebrow"><span class="num">·</span>Almost there</span>
    <h1 class="h1-display">Check <span class="serif-it">your inbox</span>.</h1>
    <p class="lede">
      We just emailed you a confirmation link. Click it and we'll add
      you to the Sunday-evening digest. The note expires harmlessly if
      you ignore it.
    </p>
  {:else}
    <span class="eyebrow"><span class="num">·</span>Subscribe</span>
    <h1 class="h1-display">Weekly <span class="serif-it">digest</span>.</h1>
    <p class="lede">
      One email a week, Sunday evening. New auditions, designer / crew
      calls, and upcoming shows across South Sound theatre. Filter to
      what you actually care about - or leave everything ticked for
      the broad newsletter.
    </p>
    <p class="meta">
      We only send when there's something to share. On a quiet week
      with nothing new, no email goes out.
    </p>

    <SubscribeFiltersForm
      mode="new"
      postTypes={data.postTypes}
      callboardAreas={data.areas}
      categories={data.categories}
      calendarAreas={data.areas}
      initialPickedTypes={allTypeSlugs}
      initialPickedCallboardAreas={allAreaIds}
      initialPickedCategories={allCategoryIds}
      initialPickedCalendarAreas={allAreaIds}
      initialEmail={form?.values?.email ?? ""}
      formError={form?.error}
    />
  {/if}
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
  .meta {
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin: 0 0 1.25rem;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--muted);
    margin: 0 0 1.5rem;
    max-width: 50ch;
  }
</style>
