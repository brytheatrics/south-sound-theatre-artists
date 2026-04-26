<script lang="ts">
  // Headshot uploader for the public submission form. Asks the server to
  // sign the upload, then POSTs the file directly to Cloudinary using XHR
  // so we can show a progress bar. On success, calls onUpload(secureUrl).

  type Props = {
    value?: string;
    onUpload?: (url: string, publicId: string) => void;
    onError?: (message: string) => void;
  };

  let {
    value = $bindable(""),
    onUpload = () => {},
    onError = () => {},
  }: Props = $props();

  const MAX_BYTES = 10 * 1024 * 1024; // Cloudinary free-tier per-image cap
  const SLOW_BYTES = 3 * 1024 * 1024; // threshold for "this may take a moment"

  let status: "idle" | "uploading" | "error" = $state("idle");
  let progress = $state(0);
  let pendingBytes = $state(0);
  let errorMessage = $state("");
  let dragActive = $state(false);
  let inputRef: HTMLInputElement | undefined = $state();

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      fail("Please choose an image file (JPEG, PNG, or WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      fail(`That file is ${formatBytes(file.size)}, which is over the 10 MB limit.`);
      return;
    }

    status = "uploading";
    progress = 0;
    pendingBytes = file.size;
    errorMessage = "";

    try {
      const signResp = await fetch("/api/cloudinary/sign", { method: "POST" });
      if (!signResp.ok) throw new Error("Could not start the upload.");
      const sig = await signResp.json();

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.api_key);
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      form.append("folder", sig.folder);
      form.append("transformation", sig.transformation);

      const result = await xhrUpload(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
        form,
        (pct) => {
          progress = pct;
        },
      );

      if (!result.secure_url) {
        throw new Error("Upload finished but no URL came back.");
      }
      value = result.secure_url;
      status = "idle";
      progress = 0;
      onUpload(result.secure_url, result.public_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      fail(msg);
    }
  }

  function fail(message: string) {
    errorMessage = message;
    status = "error";
    progress = 0;
    onError(message);
  }

  function xhrUpload(
    url: string,
    body: FormData,
    onProgress: (pct: number) => void,
  ): Promise<{ secure_url: string; public_id: string; [k: string]: unknown }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(res);
          } else {
            reject(new Error(res?.error?.message || `Upload failed (${xhr.status}).`));
          }
        } catch {
          reject(new Error("Upload failed: response could not be read."));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed: network error."));
      xhr.send(body);
    });
  }

  function onChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) uploadFile(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragActive = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadFile(file);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragActive = true;
  }

  function onDragLeave() {
    dragActive = false;
  }

  function clear() {
    value = "";
    status = "idle";
    progress = 0;
    errorMessage = "";
    if (inputRef) inputRef.value = "";
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
</script>

<div class="headshot-upload">
  {#if value}
    <div class="preview">
      <img src={value} alt="Uploaded headshot" />
      <button type="button" class="replace" onclick={clear}>Replace</button>
    </div>
  {:else}
    <label
      class="dropzone"
      class:drag-active={dragActive}
      class:disabled={status === "uploading"}
      ondrop={onDrop}
      ondragover={onDragOver}
      ondragleave={onDragLeave}
    >
      <input
        bind:this={inputRef}
        type="file"
        accept="image/*"
        onchange={onChange}
        disabled={status === "uploading"}
      />
      {#if status === "uploading"}
        <p class="status">Uploading... {progress}%</p>
        <div class="bar"><div class="fill" style:width="{progress}%"></div></div>
        {#if pendingBytes > SLOW_BYTES}
          <p class="hint">Large files may take a moment.</p>
        {/if}
      {:else}
        <p class="status">Click or drop a headshot image</p>
        <p class="hint">JPEG, PNG, or WebP. Max 10 MB.</p>
      {/if}
    </label>
    {#if status === "error"}
      <p class="error" role="alert">{errorMessage}</p>
    {/if}
  {/if}
</div>

<style>
  .headshot-upload {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 2px dashed #aaa;
    border-radius: 8px;
    padding: 2rem 1rem;
    min-height: 180px;
    cursor: pointer;
    background: #fafafa;
    text-align: center;
    transition: border-color 0.15s, background 0.15s;
  }
  .dropzone:hover,
  .drag-active {
    border-color: #555;
    background: #f0f0f0;
  }
  .dropzone.disabled {
    cursor: progress;
  }
  .dropzone input {
    display: none;
  }
  .status {
    margin: 0;
    font-weight: 500;
  }
  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: #666;
  }
  .bar {
    width: 100%;
    max-width: 320px;
    height: 8px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: #4a90e2;
    transition: width 0.15s;
  }
  .preview {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .preview img {
    max-width: 240px;
    max-height: 240px;
    border-radius: 8px;
    border: 1px solid #ccc;
  }
  .replace {
    font-size: 0.9rem;
    padding: 0.35rem 0.8rem;
    border: 1px solid #888;
    background: white;
    border-radius: 6px;
    cursor: pointer;
  }
  .replace:hover {
    background: #f0f0f0;
  }
  .error {
    color: #c00;
    font-size: 0.9rem;
    margin: 0;
  }
</style>
