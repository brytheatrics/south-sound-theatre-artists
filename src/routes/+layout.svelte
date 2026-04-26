<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import Nav from "$lib/components/Nav.svelte";
  import Footer from "$lib/components/Footer.svelte";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="page">
  <Nav />
  <main class="content">
    {@render children()}
  </main>
  <Footer />
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
