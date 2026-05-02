<script lang="ts">
  // Headshot uploader for the public submission form. Asks the server to
  // sign the upload, downsizes large images client-side via canvas (so
  // 25 MB phone photos still fit Cloudinary's 10 MB ingest cap), then
  // POSTs the file directly to Cloudinary using XHR for progress reporting.

  import { downsizeImage } from "$lib/util/downsizeImage";
  import { convertHeicIfNeeded } from "$lib/util/convertHeic";

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

  const SLOW_BYTES = 3 * 1024 * 1024;  // "may take a moment" hint threshold
  const CLOUDINARY_MAX_BYTES = 10 * 1024 * 1024;  // post-downsize fallback cap

  let status: "idle" | "converting" | "preparing" | "uploading" | "error" =
    $state("idle");
  let progress = $state(0);
  let pendingBytes = $state(0);
  let errorMessage = $state("");
  let dragActive = $state(false);
  let inputRef: HTMLInputElement | undefined = $state();

  async function uploadFile(file: File) {
    if (!isLikelyImage(file)) {
      fail("Please choose an image file (JPEG, PNG, WebP, or HEIC).");
      return;
    }

    pendingBytes = file.size;
    errorMessage = "";
    progress = 0;

    try {
      // Step 1: HEIC -> JPEG conversion (no-op for non-HEIC files).
      // Browsers can't canvas-decode HEIC, so without this an iPhone
      // photo would slip past downsizeImage and either fail at upload
      // (>10MB) or render incorrectly downstream. heic2any is lazy-
      // loaded inside the helper so non-HEIC users don't pay for it.
      let working: File = file;
      if (isHeic(file)) {
        status = "converting";
        try {
          working = await convertHeicIfNeeded(file);
        } catch (convErr) {
          // Conversion can fail on corrupt or unusual HEIC variants.
          // Fall through with the original file - small HEICs work
          // server-side via Cloudinary's transformation, and large
          // ones get caught by the size check below with a clear
          // error.
          console.warn("HEIC conversion failed, falling through:", convErr);
        }
      }

      status = "preparing";
      const blob = await downsizeImage(working);

      // Downsize is opportunistic - it skips formats the browser can't decode
      // (RAW / DNG / TIFF, sometimes HEIC). For those, the original blob comes
      // back unchanged, and if it's over Cloudinary's 10 MB ingest cap the
      // upload will fail with an unfriendly server error. Catch it up front
      // and steer the user toward the fix - HEIC is the common iPhone case
      // and benefits from format-specific instructions.
      if (blob.size > CLOUDINARY_MAX_BYTES) {
        const sizeStr = formatBytes(blob.size);
        if (isHeic(file)) {
          fail(
            `This photo is ${sizeStr} and saved in HEIC/HEIF format. ` +
              `Browsers can't auto-resize this format, so it's too large to ` +
              `upload as-is. Quickest fix: in your phone's Photos app, share ` +
              `the photo and choose "Save to Files" as a JPEG. Or take a ` +
              `screenshot of the photo and upload that. Then try again.`,
          );
        } else {
          fail(
            `This photo is ${sizeStr}, larger than the 10 MB upload limit. ` +
              `Resize it under 10 MB and try again - ` +
              `squoosh.app is a quick free option.`,
          );
        }
        return;
      }

      status = "uploading";

      const signResp = await fetch("/api/cloudinary/sign", { method: "POST" });
      if (!signResp.ok) throw new Error("Could not start the upload.");
      const sig = await signResp.json();

      const form = new FormData();
      form.append("file", blob, file.name);
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
      const raw = err instanceof Error ? err.message : "Upload failed.";
      // Rewrite Cloudinary's raw size-error text into something
      // actionable. Keeps everything else as-is so debug info is still
      // visible for non-size failures.
      const isSizeError = /size|too large|maximum/i.test(raw);
      const msg = isSizeError
        ? `Your photo is too large to upload. Resize it under 10 MB and try again - squoosh.app is a quick free option.`
        : raw;
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

  // Windows browsers often report file.type === "" for HEIC because the OS
  // has no registered MIME type. Fall back to extension sniffing so iPhone
  // users on Windows aren't locked out.
  const IMAGE_EXTENSIONS = new Set([
    "jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif", "bmp",
    "tif", "tiff", "dng",
  ]);

  function isLikelyImage(file: File): boolean {
    if (file.type.startsWith("image/")) return true;
    const ext = file.name.split(".").pop()?.toLowerCase();
    return !!ext && IMAGE_EXTENSIONS.has(ext);
  }

  // HEIC detection. file.type can be empty on Windows browsers (no
  // registered MIME type for the format), so check the extension as a
  // fallback - same pattern as isLikelyImage above.
  function isHeic(file: File): boolean {
    if (file.type === "image/heic" || file.type === "image/heif") return true;
    const ext = file.name.split(".").pop()?.toLowerCase();
    return ext === "heic" || ext === "heif";
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
      class:disabled={status === "converting" || status === "preparing" || status === "uploading"}
      ondrop={onDrop}
      ondragover={onDragOver}
      ondragleave={onDragLeave}
    >
      <input
        bind:this={inputRef}
        type="file"
        accept="image/*"
        onchange={onChange}
        disabled={status === "converting" || status === "preparing" || status === "uploading"}
      />
      {#if status === "converting"}
        <p class="status">Converting HEIC photo...</p>
        <p class="hint">A few seconds — iPhone HEIC needs to become JPEG.</p>
      {:else if status === "preparing"}
        <p class="status">Preparing image...</p>
        {#if pendingBytes > SLOW_BYTES}
          <p class="hint">Large files may take a moment.</p>
        {/if}
      {:else if status === "uploading"}
        <p class="status">Uploading... {progress}%</p>
        <div class="bar"><div class="fill" style:width="{progress}%"></div></div>
        {#if pendingBytes > SLOW_BYTES}
          <p class="hint">Large files may take a moment.</p>
        {/if}
      {:else}
        <p class="status">Click or drop a headshot or photo</p>
        <p class="hint">Any clear photo works. JPEG, PNG, WebP, or HEIC.</p>
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
    border: 1px dashed var(--rule);
    border-radius: var(--radius-lg);
    padding: 2rem 1rem;
    min-height: 200px;
    cursor: pointer;
    background: var(--paper);
    text-align: center;
    transition: border-color 0.15s, background 0.15s;
    font-family: var(--font-body);
    color: var(--ink-soft);
  }
  .dropzone:hover,
  .drag-active {
    border-color: var(--ink);
    border-style: solid;
    background: var(--paper-2);
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
    color: var(--ink);
    font-family: var(--font-body);
  }
  .hint {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .bar {
    width: 100%;
    max-width: 320px;
    height: 4px;
    background: var(--paper-2);
    border-radius: 0;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.15s;
  }
  .preview {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .preview img {
    max-width: 240px;
    max-height: 240px;
    border-radius: var(--radius);
    border: 1px solid var(--rule);
    background: var(--paper);
  }
  .replace {
    font-family: var(--font-body);
    font-size: 13px;
    padding: 8px 14px;
    border: 1px solid var(--rule);
    color: var(--ink);
    background: transparent;
    border-radius: var(--radius);
    cursor: pointer;
  }
  .replace:hover {
    border-color: var(--ink);
  }
  .error {
    color: var(--error);
    font-size: 0.9rem;
    margin: 0;
  }
</style>
