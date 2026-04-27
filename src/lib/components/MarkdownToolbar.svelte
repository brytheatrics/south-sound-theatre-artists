<script lang="ts">
  // Markdown toolbar for the admin content / template editors.
  // Manipulates the bound textarea via selection ranges and dispatches
  // an `input` event so the parent's bind:value picks up the change.

  import { downsizeImage } from "$lib/util/downsizeImage";

  type Props = {
    textareaId: string;
  };
  let { textareaId }: Props = $props();

  let imageInput: HTMLInputElement | undefined = $state();
  let uploading = $state(false);
  let uploadError = $state("");

  function getTextarea(): HTMLTextAreaElement | null {
    return document.getElementById(textareaId) as HTMLTextAreaElement | null;
  }

  function wrap(before: string, after = before, placeholder = "") {
    const ta = getTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end) || placeholder;
    const next = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
    ta.value = next;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
    const cursorStart = start + before.length;
    ta.setSelectionRange(cursorStart, cursorStart + selected.length);
  }

  function prefixLines(prefix: string) {
    const ta = getTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = ta.value.slice(0, start);
    const selection = ta.value.slice(start, end) || "text";
    const after = ta.value.slice(end);
    const lines = selection.split(/\r?\n/);
    const prefixed = lines.map((l) => (l.startsWith(prefix) ? l : prefix + l)).join("\n");
    ta.value = before + prefixed + after;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
    ta.setSelectionRange(start, start + prefixed.length);
  }

  function insertLink() {
    const ta = getTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    const text = selected || "link text";
    const snippet = `[${text}](https://example.com)`;
    ta.value = ta.value.slice(0, start) + snippet + ta.value.slice(end);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
    // Select the URL portion so they can paste over it.
    const urlStart = start + text.length + 3;
    ta.setSelectionRange(urlStart, urlStart + "https://example.com".length);
  }

  async function handleImageUpload(file: File) {
    uploading = true;
    uploadError = "";
    try {
      const blob = await downsizeImage(file);
      const sigResp = await fetch("/api/cloudinary/sign-content", { method: "POST" });
      if (!sigResp.ok) throw new Error("Could not start upload.");
      const sig = await sigResp.json();

      const form = new FormData();
      form.append("file", blob, file.name);
      form.append("api_key", sig.api_key);
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      form.append("folder", sig.folder);
      form.append("transformation", sig.transformation);

      const upResp = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
        { method: "POST", body: form },
      );
      const result = await upResp.json();
      if (!result.secure_url) throw new Error(result?.error?.message || "Upload failed.");

      // Insert markdown image syntax at the cursor.
      const ta = getTextarea();
      if (ta) {
        const start = ta.selectionStart;
        const snippet = `![${file.name.replace(/\.[^.]+$/, "")}](${result.secure_url})`;
        ta.value = ta.value.slice(0, start) + snippet + ta.value.slice(ta.selectionEnd);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus();
        ta.setSelectionRange(start + snippet.length, start + snippet.length);
      }
    } catch (err) {
      uploadError = err instanceof Error ? err.message : "Upload failed.";
    } finally {
      uploading = false;
      if (imageInput) imageInput.value = "";
    }
  }

  function onImageChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) handleImageUpload(file);
  }
</script>

<div class="tb">
  <button type="button" class="b" title="Bold (**text**)" onclick={() => wrap("**", "**", "bold")}>
    <strong>B</strong>
  </button>
  <button type="button" class="b" title="Italic (*text*)" onclick={() => wrap("*", "*", "italic")}>
    <em>I</em>
  </button>
  <span class="sep" aria-hidden="true"></span>
  <button type="button" class="b" title="Heading (# text)" onclick={() => prefixLines("## ")}>
    H
  </button>
  <button type="button" class="b" title="Bullet list" onclick={() => prefixLines("- ")}>
    •
  </button>
  <span class="sep" aria-hidden="true"></span>
  <button type="button" class="b" title="Insert link" onclick={insertLink}>
    🔗
  </button>
  <button type="button" class="b" title="Upload image" onclick={() => imageInput?.click()} disabled={uploading}>
    {uploading ? "..." : "🖼"}
  </button>
  <input
    bind:this={imageInput}
    type="file"
    accept="image/*"
    onchange={onImageChange}
    style="display: none"
  />
  {#if uploadError}
    <span class="err">{uploadError}</span>
  {/if}
</div>

<style>
  .tb {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--radius) var(--radius) 0 0;
    border-bottom: 0;
    flex-wrap: wrap;
  }
  .b {
    background: transparent;
    border: 1px solid transparent;
    padding: 4px 9px;
    border-radius: var(--radius);
    cursor: pointer;
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1;
    min-width: 28px;
  }
  .b:hover:not(:disabled) {
    background: var(--bg-raised);
    border-color: var(--rule);
  }
  .b:disabled {
    opacity: 0.5;
    cursor: progress;
  }
  .sep {
    width: 1px;
    height: 18px;
    background: var(--rule);
    margin: 0 4px;
  }
  .err {
    color: var(--warn);
    font-size: 12px;
    margin-left: 8px;
  }
</style>
