<script lang="ts">
  // Resume list editor. Holds an array of { label, url } pairs. Artists
  // can keep multiple resumes (acting / directing / design / tech) and
  // switch them per audition.
  //
  // The bound `value` is the array; the form serialises it through a
  // hidden input as JSON so it survives the round-trip without needing
  // a separate field per row.

  import ConfirmModal from "$lib/components/ConfirmModal.svelte";

  export type Resume = { label: string; url: string };

  type Props = {
    value?: Resume[];
    onError?: (message: string) => void;
  };

  let { value = $bindable([]), onError = () => {} }: Props = $props();

  const MAX_BYTES = 8 * 1024 * 1024;

  let newLabel = $state("");
  let uploading = $state(false);
  let progress = $state(0);
  let errorMessage = $state("");
  let pendingFileName = $state("");
  let inputRef: HTMLInputElement | undefined = $state();

  // Confirmation modal: shows once per file pick to remind artists that
  // public-directory PDFs typically expose phone / email at the top.
  let pendingFile = $state<File | null>(null);

  function setLabel(i: number, label: string) {
    value = value.map((r, idx) => (idx === i ? { ...r, label } : r));
  }

  function remove(i: number) {
    value = value.filter((_, idx) => idx !== i);
  }

  async function uploadFile(file: File) {
    const label = newLabel.trim();
    if (!label) {
      fail("Add a label first (e.g. Acting, Directing, Design).");
      if (inputRef) inputRef.value = "";
      return;
    }
    if (!isAcceptedResume(file)) {
      fail("Resume must be a PDF or Word document (.pdf, .docx, .doc).");
      return;
    }
    if (file.size > MAX_BYTES) {
      fail(
        `That file is ${formatBytes(file.size)} - the limit is ${formatBytes(MAX_BYTES)}. ` +
          `Try compressing the file first.`,
      );
      return;
    }

    uploading = true;
    progress = 0;
    errorMessage = "";
    pendingFileName = file.name;

    try {
      const signResp = await fetch("/api/cloudinary/sign-resume", {
        method: "POST",
      });
      if (!signResp.ok) throw new Error("Could not start the upload.");
      const sig = await signResp.json();

      const form = new FormData();
      form.append("file", file, file.name);
      form.append("api_key", sig.api_key);
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      form.append("folder", sig.folder);

      const result = await xhrUpload(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/raw/upload`,
        form,
        (pct) => {
          progress = pct;
        },
      );

      if (!result.secure_url) {
        throw new Error("Upload finished but no URL came back.");
      }
      value = [...value, { label, url: result.secure_url }];
      newLabel = "";
      pendingFileName = "";
      uploading = false;
      progress = 0;
      if (inputRef) inputRef.value = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      fail(msg);
    }
  }

  function fail(message: string) {
    errorMessage = message;
    uploading = false;
    progress = 0;
    pendingFileName = "";
    onError(message);
  }

  function xhrUpload(
    url: string,
    body: FormData,
    onProgress: (pct: number) => void,
  ): Promise<{ secure_url: string; [k: string]: unknown }> {
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
            reject(
              new Error(res?.error?.message || `Upload failed (${xhr.status}).`),
            );
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
    if (!file) return;
    // Pre-validate locally so the modal doesn't fire on obvious-fails.
    const label = newLabel.trim();
    if (!label) {
      fail("Add a label first (e.g. Acting, Directing, Design).");
      if (inputRef) inputRef.value = "";
      return;
    }
    if (!isAcceptedResume(file)) {
      fail("Resume must be a PDF or Word document (.pdf, .docx, .doc).");
      return;
    }
    if (file.size > MAX_BYTES) {
      fail(
        `That file is ${formatBytes(file.size)} - the limit is ${formatBytes(MAX_BYTES)}. ` +
          `Try compressing the file first.`,
      );
      return;
    }
    pendingFile = file;
  }

  function onCancelUpload() {
    pendingFile = null;
    if (inputRef) inputRef.value = "";
  }

  async function onConfirmUpload() {
    const file = pendingFile;
    pendingFile = null;
    if (file) await uploadFile(file);
  }

  // Accept PDFs + Word docs (modern .docx and legacy .doc). Match on
  // either MIME type or filename extension - mobile browsers sometimes
  // omit the type for less common formats so the extension is the
  // reliable signal.
  function isAcceptedResume(file: File): boolean {
    const okTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    if (file.type && okTypes.has(file.type)) return true;
    const lower = file.name.toLowerCase();
    return lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".doc");
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function fileNameFromUrl(url: string): string {
    try {
      const u = new URL(url);
      const path = u.pathname.split("/").pop() ?? "";
      return decodeURIComponent(path) || "resume.pdf";
    } catch {
      return "resume.pdf";
    }
  }
</script>

<div class="resumes">
  {#if value.length > 0}
    <!-- Persistent reminder for artists who already have resumes uploaded
         (bulk import, prior edit). The upload modal already nags about
         this for new files; this banner covers the existing-resumes
         case so people can revisit redaction without uploading anything
         new. Same advice, paper-rust palette. -->
    <div class="redact-banner" role="status">
      <strong>Heads up about your resumes</strong>
      <p>
        Resume PDFs show on your profile as-is. Most have a phone number
        or email at the top - if yours do, consider redacting and
        re-uploading. Your contact form already routes messages without
        revealing your email.
      </p>
    </div>
    <ul class="list">
      {#each value as r, i (r.url)}
        <li class="row">
          <span class="icon" aria-hidden="true">📄</span>
          <input
            type="text"
            class="label-input"
            value={r.label}
            placeholder="Label"
            oninput={(e) => setLabel(i, (e.currentTarget as HTMLInputElement).value)}
          />
          <a href={r.url} target="_blank" rel="noopener" class="filename">
            {fileNameFromUrl(r.url)}
          </a>
          <button type="button" class="bt warn" onclick={() => remove(i)}>
            Remove
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="add-row" class:uploading>
    <input
      type="text"
      class="label-input"
      bind:value={newLabel}
      placeholder="Label (Acting, Directing, ...)"
      disabled={uploading}
    />
    <label class="file-pick">
      <input
        bind:this={inputRef}
        type="file"
        accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
        onchange={onChange}
        disabled={uploading || !newLabel.trim()}
      />
      <span class="bt" class:disabled={uploading || !newLabel.trim()}>
        {#if uploading}
          Uploading {pendingFileName}... {progress}%
        {:else}
          + Add resume (PDF or Word)
        {/if}
      </span>
    </label>
  </div>

  {#if uploading}
    <div class="bar"><div class="fill" style:width="{progress}%"></div></div>
  {/if}
  {#if errorMessage}
    <p class="error" role="alert">{errorMessage}</p>
  {/if}

  <!-- Hidden input the form serialises. The server JSON.parses it back. -->
  <input type="hidden" name="resumes" value={JSON.stringify(value)} />
</div>

<ConfirmModal
  open={pendingFile !== null}
  title="Heads up about your resume"
  body={`Theatre directories like ours are public, and most uploaded resumes have a phone number or email at the top. Your contact form already routes messages without revealing your email - consider removing those from the file before uploading. ` +
    `\n\nUploading: ${pendingFile?.name ?? ""}`}
  confirmLabel="I've checked it, upload"
  cancelLabel="Cancel"
  variant="warn"
  onConfirm={onConfirmUpload}
  onClose={onCancelUpload}
/>

<style>
  .resumes {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Privacy reminder banner shown above the resume list. Same paper-rust
     palette as the complete-to-publish gate on /edit/[token] so warning
     banners look like a coherent family. */
  .redact-banner {
    background: color-mix(in oklch, var(--warn), var(--bg) 88%);
    border: 1px solid color-mix(in oklch, var(--warn), var(--bg) 60%);
    border-left: 4px solid var(--warn);
    padding: 12px 16px;
    border-radius: var(--radius);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 13px;
  }
  .redact-banner strong {
    display: block;
    font-size: 14px;
    margin-bottom: 4px;
    color: var(--ink);
  }
  .redact-banner p {
    margin: 0;
    color: var(--ink-soft);
    line-height: 1.5;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    flex-wrap: wrap;
  }
  .icon {
    font-size: 18px;
    line-height: 1;
  }
  .label-input {
    flex: 0 1 180px;
    padding: 6px 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg);
    color: var(--ink);
    min-width: 0;
  }
  .label-input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .filename {
    flex: 1;
    min-width: 140px;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--accent);
    text-decoration: none;
    word-break: break-all;
  }
  .filename:hover {
    text-decoration: underline;
  }
  .bt {
    font-family: var(--font-body);
    font-size: 13px;
    padding: 6px 12px;
    border: 1px solid var(--rule);
    color: var(--ink);
    background: transparent;
    border-radius: var(--radius);
    cursor: pointer;
    line-height: 1.2;
    display: inline-flex;
    align-items: center;
  }
  .bt:hover:not(.disabled) {
    border-color: var(--ink);
  }
  .bt.warn {
    color: var(--warn);
  }
  .bt.warn:hover {
    border-color: var(--warn);
  }
  .bt.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .add-row {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    border: 1px dashed var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
    flex-wrap: wrap;
  }
  .add-row.uploading {
    border-style: solid;
    border-color: var(--accent);
  }
  .file-pick {
    display: inline-flex;
    cursor: pointer;
  }
  .file-pick input[type="file"] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .bar {
    width: 100%;
    height: 4px;
    background: var(--paper-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.15s;
  }
  .error {
    color: var(--error);
    font-size: 0.9rem;
    margin: 0;
  }
</style>
