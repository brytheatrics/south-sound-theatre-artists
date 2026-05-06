<script lang="ts">
  // Markdown toolbar for the admin content / template editors.
  // Manipulates the bound textarea via selection ranges and dispatches
  // an `input` event so the parent's bind:value picks up the change.
  //
  // Designed for a non-technical operator. Buttons label what they DO
  // visually, not what they emit. Tooltips spell it out in plain
  // language. A "?" toggle reveals a quick syntax cheat-sheet for
  // anyone who wants to learn the underlying markdown.

  import { downsizeImage } from "$lib/util/downsizeImage";
  import { convertHeicIfNeeded } from "$lib/util/convertHeic";

  type Props = {
    textareaId: string;
  };
  let { textareaId }: Props = $props();

  let imageInput: HTMLInputElement | undefined = $state();
  let uploading = $state(false);
  let uploadError = $state("");

  // Help panel: visible by default so the operator sees the key
  // without having to click anything. After they collapse it once
  // (because they remember the syntax now), the choice is remembered
  // in localStorage for next time.
  const HELP_PREF_KEY = "ssta_markdown_help_open";
  let helpOpen = $state(true);
  $effect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(HELP_PREF_KEY);
      if (stored === "false") helpOpen = false;
    } catch {
      // private mode / blocked storage; default-open is fine.
    }
  });
  function toggleHelp() {
    helpOpen = !helpOpen;
    try {
      window.localStorage.setItem(HELP_PREF_KEY, String(helpOpen));
    } catch {
      // ignore - state still works for the session
    }
  }

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
      // HEIC -> JPEG first, in case Lexi (or anyone) drags an iPhone
      // photo into the about page or an email template. Same lazy-
      // loaded converter the headshot uploader uses.
      let working: File = file;
      try {
        working = await convertHeicIfNeeded(file);
      } catch (convErr) {
        console.warn("HEIC conversion failed, falling through:", convErr);
      }
      const blob = await downsizeImage(working);
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
  <button type="button" class="b" title="Bold — make selected text stand out" onclick={() => wrap("**", "**", "bold")}>
    <strong>B</strong>
  </button>
  <button type="button" class="b" title="Italic — adds emphasis (renders in serif accent)" onclick={() => wrap("*", "*", "italic")}>
    <em>I</em>
  </button>

  <span class="sep" aria-hidden="true"></span>

  <button type="button" class="b b-h h1" title="Page title (largest heading) — only one per page, at the very top" onclick={() => prefixLines("# ")}>
    H1
  </button>
  <button type="button" class="b b-h h2" title="Section heading — use to start a new section like 'Mission' or 'Our story'" onclick={() => prefixLines("## ")}>
    H2
  </button>
  <button type="button" class="b b-h h3" title="Sub-section heading — use under a section, like a person's name under 'Our team'" onclick={() => prefixLines("### ")}>
    H3
  </button>

  <span class="sep" aria-hidden="true"></span>

  <button type="button" class="b" title="Bullet list" onclick={() => prefixLines("- ")}>
    •
  </button>
  <button type="button" class="b b-text" title="Insert a link to another page or website" onclick={insertLink}>
    Link
  </button>
  <button type="button" class="b b-text" title="Upload an image (Cloudinary)" onclick={() => imageInput?.click()} disabled={uploading}>
    {uploading ? "Uploading..." : "Image"}
  </button>
  <input
    bind:this={imageInput}
    type="file"
    accept="image/*"
    onchange={onImageChange}
    style="display: none"
  />

  <span class="sep" aria-hidden="true"></span>

  <button type="button" class="b b-help" title="Show what each formatting symbol means" onclick={toggleHelp} aria-expanded={helpOpen}>
    {helpOpen ? "Hide key" : "Show key"}
  </button>

  {#if uploadError}
    <span class="err">{uploadError}</span>
  {/if}
</div>

{#if helpOpen}
  <!-- Plain-language reference for what the toolbar actually inserts.
       Lexi can keep this open while editing or close it once she
       remembers. Examples are deliberately concrete (the kinds of
       things she'll actually type) instead of abstract markdown docs. -->
  <div class="help">
    <p class="help-lead">
      What you type → what it looks like. The buttons above do this for you;
      this panel is just so you understand why the symbols appear.
    </p>
    <table class="help-table">
      <thead>
        <tr><th>Type this</th><th>You get</th><th>When to use</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><code>**bold**</code></td>
          <td><strong>bold</strong></td>
          <td>A word or phrase you want to stand out.</td>
        </tr>
        <tr>
          <td><code>*italic*</code></td>
          <td><em class="ex-italic">italic</em></td>
          <td>Editorial emphasis. Inside body text it renders in the serif accent.</td>
        </tr>
        <tr>
          <td><code># Page title</code></td>
          <td><span class="ex-h1">Page title</span></td>
          <td>Only at the very top of a page. Big serif headline.</td>
        </tr>
        <tr>
          <td><code>## Section heading</code></td>
          <td><span class="ex-h2">Section heading</span></td>
          <td>Each major section ("Mission", "Our team", etc).</td>
        </tr>
        <tr>
          <td><code>### Smaller heading</code></td>
          <td><span class="ex-h3">Smaller heading</span></td>
          <td>Sub-section under a section heading. E.g. a person's name under "Our team".</td>
        </tr>
        <tr>
          <td><code>- list item</code></td>
          <td>• list item</td>
          <td>Bulleted list. Put each item on its own line, all starting with <code>-</code>.</td>
        </tr>
        <tr>
          <td><code>[link text](url)</code></td>
          <td><span class="ex-link">link text</span></td>
          <td>Link to another page or external site.</td>
        </tr>
        <tr>
          <td><code>![alt text](image-url)</code></td>
          <td><em>image embedded</em></td>
          <td>Embed an image. Use the Image button above to upload + insert in one step.</td>
        </tr>
        <tr>
          <td><code>\-</code> or <code>\*</code></td>
          <td>literal <code>-</code> or <code>*</code></td>
          <td>
            Put a backslash before any of <code>-</code>, <code>*</code>,
            <code>[</code>, <code>]</code>, <code>!</code>, or another
            <code>\</code> to make it appear as plain text. Mostly useful
            when you want a line that starts with a dash but isn't a list.
          </td>
        </tr>
      </tbody>
    </table>
    <p class="help-tip">
      <strong>Tip:</strong> hit Enter to start a new paragraph. Long
      sentences wrap to the next line on their own — you don't need
      to break them by hand. Headings, lists, and images also start
      fresh on their own line.
    </p>
  </div>
{/if}

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
  /* Heading buttons: visually graduated so the H1/H2/H3 hierarchy is
     skim-readable. H1 = largest type, H3 = smallest. */
  .b-h {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
  }
  .b-h.h1 { font-size: 16px; }
  .b-h.h2 { font-size: 14px; }
  .b-h.h3 { font-size: 12px; color: var(--ink-soft); }
  /* Word-buttons: Link, Image — small text instead of emojis so the
     action is unambiguous on first read. */
  .b-text {
    font-size: 13px;
    padding: 4px 11px;
    color: var(--ink-soft);
  }
  .b-help {
    margin-left: auto;
    font-size: 13px;
    color: var(--muted);
    border: 1px solid var(--rule);
  }
  .b-help[aria-expanded="true"] {
    background: var(--bg-raised);
    color: var(--ink);
    border-color: var(--ink);
  }
  .sep {
    width: 1px;
    height: 18px;
    background: var(--rule);
    margin: 0 4px;
  }
  .err {
    color: var(--error);
    font-size: 12px;
    margin-left: 8px;
  }

  /* Help panel */
  .help {
    background: var(--paper);
    border: 1px solid var(--rule);
    border-top: 0;
    padding: 14px 18px;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
    line-height: 1.55;
  }
  .help-lead {
    margin: 0 0 12px;
    font-style: italic;
    color: var(--muted);
  }
  .help-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 10px;
  }
  .help-table th,
  .help-table td {
    text-align: left;
    padding: 6px 10px;
    border-bottom: 1px solid var(--rule-soft);
    vertical-align: top;
  }
  .help-table th {
    font-family: var(--font-mono);
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    font-weight: 500;
  }
  .help-table td:first-child {
    width: 30%;
    white-space: nowrap;
  }
  .help-table td:nth-child(2) {
    width: 22%;
  }
  .help-table code {
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: 3px;
    padding: 1px 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink);
  }
  /* Visual examples in the "You get" column. */
  .ex-italic {
    font-family: var(--font-accent);
    font-style: italic;
    color: var(--accent);
  }
  .ex-h1 {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 18px;
    color: var(--ink);
  }
  .ex-h2 {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 15px;
    color: var(--ink);
  }
  .ex-h3 {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 13px;
    color: var(--ink);
  }
  .ex-link {
    color: var(--accent);
    text-decoration: underline;
  }
  .help-tip {
    margin: 8px 0 0;
    color: var(--ink-soft);
    font-size: 12.5px;
  }
  .help-tip strong {
    color: var(--ink);
  }

  @media (max-width: 540px) {
    /* Don't hide buttons on mobile, just allow wrap and shrink padding. */
    .b { padding: 4px 7px; }
    .help-table td:first-child {
      white-space: normal;
    }
  }
</style>
