<script lang="ts">
  // Placeholder admin landing - real pending-queue lands in step 8.
</script>

<svelte:head>
  <title>Admin - SSTA</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">→</span>Admin</span>
  <h1 class="h1-display">Pending queue.</h1>
  <p class="lede">Submissions waiting on review will land here.</p>
</header>

<style>
  .hd {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 800px;
  }
  .h1-display {
    margin: 0.5rem 0 1rem;
  }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    color: var(--muted);
    margin: 0;
  }
</style>
