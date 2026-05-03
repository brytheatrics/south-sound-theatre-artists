<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import AnnouncementBanner from "$lib/components/AnnouncementBanner.svelte";
  import Nav from "$lib/components/Nav.svelte";
  import Footer from "$lib/components/Footer.svelte";

  let { data, children } = $props();

  // GoatCounter analytics: only load on public-facing pages and only when
  // the env var is set. Skips admin and magic-link edit screens so internal
  // activity doesn't pollute the dashboard.
  const goatCode = env.PUBLIC_GOATCOUNTER_CODE ?? "";
  const isPrivateRoute = $derived(
    page.url.pathname.startsWith("/admin") ||
      page.url.pathname.startsWith("/edit"),
  );
  const trackThisPage = $derived(!!goatCode && !isPrivateRoute);
</script>

<svelte:head>
  {#if trackThisPage}
    <script
      data-goatcounter={`https://${goatCode}.goatcounter.com/count`}
      async
      src="https://gc.zgo.at/count.js"
    ></script>
  {/if}
</svelte:head>

<div class="page">
  {#if data?.banner}
    <AnnouncementBanner body={data.banner} />
  {/if}
  <Nav isAdmin={data?.isAdmin ?? false} navLabels={data?.navLabels} />
  <main class="content">
    {@render children()}
  </main>
  <Footer tagline={data?.footer ?? null} />
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .content {
    flex: 1;
  }
</style>
