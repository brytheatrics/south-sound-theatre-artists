<script lang="ts">
  // Poster upload widget for /calendar/submit. Mirrors HeadshotUpload's
  // shape but signs against /api/cloudinary/sign-poster (public sign
  // endpoint) and uploads larger images (posters are typically 2:3
  // portrait, can run to 2000x2400).

  type Props = { value?: string };
  let { value = $bindable("") }: Props = $props();

  let busy = $state(false);
  let err = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | undefined>();

  async function upload(file: File) {
    busy = true;
    err = null;
    try {
      const sigRes = await fetch("/api/cloudinary/sign-poster", { method: "POST" });
      if (!sigRes.ok) throw new Error("Couldn't get upload signature.");
      const sig = (await sigRes.json()) as {
        cloud_name: string;
        api_key: string;
        timestamp: number;
        signature: string;
        folder: string;
        transformation: string;
      };
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.api_key);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);
      fd.append("transformation", sig.transformation);
      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, {
        method: "POST",
        body: fd,
      });
      if (!upRes.ok) throw new Error("Cloudinary upload failed.");
      const up = (await upRes.json()) as { secure_url: string };
      value = up.secure_url;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
      if (fileInput) fileInput.value = "";
    }
  }

  function clearImage() {
    value = "";
  }
</script>

<div class="up">
  <p class="hint">
    Optional. A 2:3 portrait poster works best - we'll show it at the top
    of the show's page. JPG / PNG / WEBP, up to about 5MB.
  </p>
  {#if value}
    <div class="preview">
      <img src={value} alt="Poster preview" />
      <button type="button" class="clear" onclick={clearImage}>Remove</button>
    </div>
  {:else}
    <input
      type="file"
      accept="image/*"
      bind:this={fileInput}
      onchange={(e) => {
        const f = (e.currentTarget as HTMLInputElement).files?.[0];
        if (f) upload(f);
      }}
    />
  {/if}
  {#if busy}<p class="status">Uploading...</p>{/if}
  {#if err}<p class="status err">{err}</p>{/if}
  <input type="hidden" name="cover_url" {value} />
</div>

<style>
  .up {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hint {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
    line-height: 1.5;
  }
  input[type="file"] {
    font-family: var(--font-body);
    font-size: 13px;
  }
  .preview {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .preview img {
    max-width: 220px;
    max-height: 320px;
    border-radius: var(--radius);
    border: 1px solid var(--rule);
  }
  .clear {
    background: transparent;
    color: var(--warn);
    border: 1px solid var(--rule);
    padding: 4px 10px;
    font-family: var(--font-body);
    font-size: 12px;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .status {
    margin: 0;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
  }
  .status.err {
    color: var(--warn);
  }
</style>
