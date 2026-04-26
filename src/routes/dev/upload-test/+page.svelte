<script lang="ts">
  import HeadshotUpload from "$lib/components/HeadshotUpload.svelte";

  let url = $state("");
  let publicId = $state("");
  let lastError = $state("");

  function onUpload(secureUrl: string, pid: string) {
    url = secureUrl;
    publicId = pid;
    lastError = "";
  }

  function onError(message: string) {
    lastError = message;
  }
</script>

<svelte:head>
  <title>Headshot upload test</title>
</svelte:head>

<main>
  <h1>Headshot upload test</h1>
  <p>
    Drop or click to upload an image. It uploads directly to Cloudinary's
    <code>headshots/</code> folder, resized to a 1200px max edge with
    auto-quality. Server signs each request; the API secret never leaves the
    server.
  </p>

  <HeadshotUpload bind:value={url} {onUpload} {onError} />

  {#if url}
    <section>
      <h2>Uploaded</h2>
      <p><strong>secure_url:</strong> <code>{url}</code></p>
      <p><strong>public_id:</strong> <code>{publicId}</code></p>
    </section>
  {/if}

  {#if lastError}
    <p class="error">Last error: {lastError}</p>
  {/if}
</main>

<style>
  main {
    max-width: 640px;
    margin: 2rem auto;
    padding: 1rem;
    font-family: system-ui, sans-serif;
    color: #222;
  }
  h1 {
    margin-top: 0;
  }
  code {
    background: #f0f0f0;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    word-break: break-all;
    font-size: 0.9rem;
  }
  section {
    margin-top: 2rem;
    padding: 1rem;
    background: #f7f7f7;
    border-radius: 8px;
  }
  .error {
    color: #c00;
    margin-top: 1rem;
  }
</style>
