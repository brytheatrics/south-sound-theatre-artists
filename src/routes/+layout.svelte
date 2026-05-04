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

  // Edge fade masks live on the homepage only. Other pages keep the rules
  // and content full-bleed without the gradient overlay.
  const isHome = $derived(page.url.pathname === "/");
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
    <!-- Edge fade masks bounded by <main>:
           - .edge-fade-anchor is sticky top:0 height:100vh with margin-
             bottom:-100vh so it visually occupies 100vh but takes zero
             flow space (children render as if it weren't there).
           - sticky keeps it pinned below the nav while main is in view
             and lets it scroll up with main's bottom edge so the footer
             is never overlapped.
           - .edge-fade-l/-r are absolute children rendering the gradients.
         Desktop only. -->
    {#if isHome}
      <div class="edge-fade-anchor" aria-hidden="true">
        <div class="edge-fade edge-fade-l"></div>
        <div class="edge-fade edge-fade-r"></div>
      </div>
    {/if}
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
    position: relative;
  }
  .edge-fade-anchor {
    display: none;
  }
  @media (min-width: 1024px) {
    .edge-fade-anchor {
      display: block;
      position: sticky;
      top: 10px;
      height: calc(100vh - 120px);
      margin-bottom: calc(-100vh + 120px);
      pointer-events: none;
      z-index: 1;
    }
    .edge-fade {
      position: absolute;
      top: 0;
      bottom: 0;
      /* Scale toward the centered-column gap on wide screens so the fade
         reaches close to where main content starts. */
      width: clamp(0px, calc((100vw - 1280px) / 2), 870px);
    }
    /* Hold solid for the first ~30% before the fade so rules and the
       marquee visibly dissolve instead of bleeding through at half opacity
       across the whole mask. RED for debugging - revert to var(--bg). */
    .edge-fade-l {
      left: 0;
      background: linear-gradient(
        to right,
        var(--bg) 0%,
        var(--bg) 30%,
        transparent 100%
      );
    }
    .edge-fade-r {
      right: 0;
      background: linear-gradient(
        to left,
        var(--bg) 0%,
        var(--bg) 30%,
        transparent 100%
      );
    }
  }
</style>
