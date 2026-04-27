<script lang="ts">
  import "../app.css";
  import AnnouncementBanner from "$lib/components/AnnouncementBanner.svelte";
  import Nav from "$lib/components/Nav.svelte";
  import Footer from "$lib/components/Footer.svelte";

  let { data, children } = $props();
</script>

<div class="page">
  {#if data?.banner}
    <AnnouncementBanner body={data.banner} />
  {/if}
  <Nav isAdmin={data?.isAdmin ?? false} />
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
