<script lang="ts">
  let { data, form } = $props();

  // The form-action return value typing widens form.values into a
  // union with the error shape; cast once so the template can access
  // the well-known submit-time fields without TS choking.
  const v = $derived((form?.values ?? {}) as Record<string, string>);
  const errs = $derived((form?.errors ?? {}) as Record<string, string>);

  /* svelte-ignore state_referenced_locally */
  let pickedAreaId = $state<string>(v.area_id ?? "");

  // Slug: required, lowercase ASCII + dashes, 2-60 chars. We auto-fill
  // the field from the name as the user types - but only while the
  // user hasn't manually edited the slug (slugTouched=false). Once they
  // touch it, we stop overwriting so admin can hand-pick e.g. "tlt"
  // instead of "tacoma-little-theatre".
  /* svelte-ignore state_referenced_locally */
  let nameInput = $state<string>(v.name ?? "");
  /* svelte-ignore state_referenced_locally */
  let slugInput = $state<string>(v.slug ?? "");
  let slugTouched = $state<boolean>(false);

  function autoSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60);
  }

  function onNameInput(e: Event) {
    nameInput = (e.target as HTMLInputElement).value;
    if (!slugTouched) slugInput = autoSlug(nameInput);
  }

  function onSlugInput(e: Event) {
    slugTouched = true;
    slugInput = (e.target as HTMLInputElement).value;
  }

  // Logo upload state. Same Cloudinary signed-upload flow as the per-row
  // editor on /admin/organizations - just simplified for a single-form
  // context (no per-id keying since we don't have an id yet).
  /* svelte-ignore state_referenced_locally */
  let logoUrl = $state<string>(v.logo_url ?? "");
  /* svelte-ignore state_referenced_locally */
  let logoBg = $state<string>(v.logo_bg ?? "paper");
  let uploading = $state<boolean>(false);
  let uploadProgress = $state<number>(0);
  let uploadError = $state<string | null>(null);

  const LOGO_BG_OPTIONS: Array<{ value: string; label: string; hex: string }> = [
    { value: "paper", label: "Paper", hex: "#f1ede0" },
    { value: "paper-2", label: "Cream", hex: "#ebe5d3" },
    { value: "bg-raised", label: "White", hex: "#ffffff" },
    { value: "ink", label: "Ink", hex: "#0e0d0c" },
    { value: "accent", label: "Moss", hex: "#3b6f4a" },
  ];

  async function uploadLogo(file: File) {
    uploading = true;
    uploadProgress = 0;
    uploadError = null;
    try {
      const sigResp = await fetch("/api/cloudinary/sign-logo", { method: "POST" });
      if (!sigResp.ok) throw new Error("Could not start the upload.");
      const sig = await sigResp.json();

      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.api_key);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);
      fd.append("transformation", sig.transformation);

      const result = await xhrUpload(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
        fd,
        (pct) => (uploadProgress = pct),
      );
      if (!result.secure_url) throw new Error("Upload finished but no URL came back.");
      logoUrl = result.secure_url;
    } catch (err) {
      uploadError = err instanceof Error ? err.message : "Upload failed.";
    } finally {
      uploading = false;
      uploadProgress = 0;
    }
  }

  function xhrUpload(
    url: string,
    body: FormData,
    onProgress: (pct: number) => void,
  ): Promise<{ secure_url: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(res);
          else reject(new Error(res?.error?.message || `Upload failed (${xhr.status}).`));
        } catch {
          reject(new Error("Upload failed: response could not be read."));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed: network error."));
      xhr.send(body);
    });
  }

  function onLogoFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) uploadLogo(file);
    (e.target as HTMLInputElement).value = "";
  }
</script>

<svelte:head>
  <title>Add organization - SSTA admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header class="hd">
  <span class="eyebrow"><span class="num">·</span>Admin · organizations · new</span>
  <h1 class="h1-display">Add an <span class="serif-it">organization</span>.</h1>
  <p class="lede">
    For theatres we know exist but aren't already in the system. Saved
    as <strong>manual</strong> by default - the cron leaves manual orgs
    alone. Once Blake has checked whether the org's site is scrape-friendly,
    flip the adapter to "ai-generic" from the list page.
  </p>
  <p class="meta">
    <a href="/admin/organizations">← Back to organizations</a>
  </p>
</header>

{#if errs._form}
  <div class="form-error" role="alert">{errs._form}</div>
{/if}

<form method="POST" action="?/create" class="form">
  <label class="field">
    <span>Name <span class="req">*</span></span>
    <input
      name="name"
      type="text"
      required
      value={nameInput}
      oninput={onNameInput}
      placeholder="Tacoma Little Theatre"
    />
    <span class="hint">
      The display name. Used everywhere on the site - on /theatres,
      productions linked back to this org, and the calendar.
    </span>
    {#if errs.name}<p class="field-error">{errs.name}</p>{/if}
  </label>

  <label class="field">
    <span>Slug <span class="req">*</span></span>
    <input
      name="slug"
      type="text"
      required
      value={slugInput}
      oninput={onSlugInput}
      placeholder="tlt"
      maxlength="60"
      pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
    />
    <span class="hint">
      Short identifier. We auto-suggest one from the name, but admin
      convention is hand-picked + concise (e.g. "tlt" not
      "tacoma-little-theatre", "harlequin" not "harlequin-productions").
      Lowercase letters / numbers / dashes only.
    </span>
    {#if errs.slug}<p class="field-error">{errs.slug}</p>{/if}
  </label>

  <div class="field">
    <span class="label">Area <span class="req">*</span></span>
    <div class="chip-row">
      {#each data.areas as a (a.id)}
        <label class="chip" class:on={pickedAreaId === a.id}>
          <input
            type="radio"
            name="area_id"
            value={a.id}
            checked={pickedAreaId === a.id}
            onchange={() => (pickedAreaId = a.id)}
            required
          />
          <span>{a.name}</span>
        </label>
      {/each}
    </div>
    {#if errs.area_id}<p class="field-error">{errs.area_id}</p>{/if}
  </div>

  <label class="field">
    <span>Homepage URL</span>
    <input
      name="homepage_url"
      type="url"
      value={v.homepage_url ?? ""}
      placeholder="https://..."
    />
    <span class="hint">Their main public site. Shown on /theatres.</span>
    {#if errs.homepage_url}<p class="field-error">{errs.homepage_url}</p>{/if}
  </label>

  <label class="field">
    <span>Season list URL</span>
    <input
      name="source_url"
      type="url"
      value={v.source_url ?? ""}
      placeholder="https://example.com/season"
    />
    <span class="hint">
      Where the cron would look for upcoming shows once promoted to
      auto-pull. Optional - can be added later.
    </span>
    {#if errs.source_url}<p class="field-error">{errs.source_url}</p>{/if}
  </label>

  <label class="field">
    <span>Description</span>
    <textarea
      name="description"
      rows="3"
      maxlength="500"
      placeholder="1-2 sentence description shown on /theatres"
    >{v.description ?? ""}</textarea>
    {#if errs.description}<p class="field-error">{errs.description}</p>{/if}
  </label>

  <div class="field">
    <span class="label">Logo</span>
    <input type="hidden" name="logo_url" value={logoUrl} />
    <div class="logo-row">
      <input
        type="url"
        value={logoUrl}
        oninput={(e) => (logoUrl = (e.target as HTMLInputElement).value)}
        placeholder="Paste a URL or upload a file →"
        class="logo-url-input"
      />
      <label class="upload-btn" class:disabled={uploading}>
        {uploading ? `Uploading… ${uploadProgress}%` : "Upload"}
        <input
          type="file"
          accept="image/*"
          onchange={onLogoFileChange}
          disabled={uploading}
        />
      </label>
      {#if logoUrl}
        <div
          class="logo-preview-tile"
          style:background={LOGO_BG_OPTIONS.find((o) => o.value === logoBg)?.hex ?? "#f1ede0"}
        >
          <img class="logo-preview" src={logoUrl} alt="" />
        </div>
      {/if}
    </div>
    {#if uploading}
      <div class="progress"><div class="progress-fill" style:width="{uploadProgress}%"></div></div>
    {/if}
    <span class="hint">
      PNG with transparent background looks best. Files get auto-resized.
      {#if uploadError}<span class="upload-error"> {uploadError}</span>{/if}
    </span>
    {#if errs.logo_url}<p class="field-error">{errs.logo_url}</p>{/if}
  </div>

  <fieldset class="bg-field">
    <legend class="label">Logo background</legend>
    <p class="hint">
      Pick a tile colour that makes the logo readable. White logos need
      a dark tile (Ink or Moss); black or coloured logos usually look
      best on Paper, Cream, or White.
    </p>
    <div class="swatches">
      {#each LOGO_BG_OPTIONS as opt (opt.value)}
        <label
          class="swatch"
          class:on={logoBg === opt.value}
          style:background={opt.hex}
          title={opt.label}
        >
          <input
            type="radio"
            name="logo_bg"
            value={opt.value}
            checked={logoBg === opt.value}
            onchange={() => (logoBg = opt.value)}
          />
          <span class="swatch-label">{opt.label}</span>
        </label>
      {/each}
    </div>
    {#if errs.logo_bg}<p class="field-error">{errs.logo_bg}</p>{/if}
  </fieldset>

  <label class="field">
    <span>Internal notes</span>
    <textarea
      name="notes"
      rows="3"
      placeholder="Hints for Blake: where the schedule lives, any quirks, contact who runs it..."
    >{v.notes ?? ""}</textarea>
    <span class="hint">Admin-only. Never shown publicly.</span>
  </label>

  <div class="actions">
    <button type="submit" class="bt bt-pri">Create organization</button>
  </div>

  <p class="follow-up">
    After saving, you can upload a logo + tweak the public details from
    the <a href="/admin/organizations">organizations list</a> by clicking
    "Edit public details" on the new row.
  </p>
</form>

<style>
  .hd { display: flex; flex-direction: column; gap: 0.5rem; max-width: 720px; margin-bottom: 1.5rem; }
  .h1-display { margin: 0.5rem 0 0.25rem; }
  .lede {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 16px;
    color: var(--muted);
    margin: 0;
    max-width: 60ch;
  }
  .lede strong { color: var(--ink); font-style: normal; font-family: var(--font-mono); font-size: 13px; }
  .meta {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin: 0.5rem 0 0;
  }
  .meta a { color: var(--accent); }

  .form-error {
    background: color-mix(in oklch, var(--warn), var(--bg) 80%);
    border: 1px solid var(--warn);
    color: var(--warn);
    padding: 0.65rem 0.9rem;
    border-radius: var(--radius);
    margin: 0 0 1rem;
    max-width: 720px;
    font-size: 14px;
  }

  .form { display: flex; flex-direction: column; gap: 1rem; max-width: 720px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field > span,
  .field .label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .req { color: var(--accent); }
  .hint {
    font-family: var(--font-body) !important;
    font-size: 12px !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
    color: var(--muted);
    line-height: 1.45;
  }
  .field-error { font-size: 12px; color: var(--warn); margin: 0; }
  input, textarea {
    padding: 9px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 14px;
    background: var(--bg-raised);
    color: var(--ink);
  }
  textarea { resize: vertical; line-height: 1.5; }
  input:focus, textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }

  .chip-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chip {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 0.35rem 0.85rem;
    font-size: 13px;
    color: var(--ink-soft);
    background: transparent;
    cursor: pointer;
    user-select: none;
    transition: border-color 0.12s, background 0.12s, color 0.12s;
  }
  .chip:hover { border-color: var(--ink); color: var(--ink); }
  .chip-row .chip.on {
    background: var(--ink) !important;
    color: var(--bg);
    border-color: var(--ink);
  }
  .chip input[type="radio"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 1px;
    height: 1px;
  }

  .actions { display: flex; margin-top: 0.5rem; }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 11px 22px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
  }
  .bt-pri { background: var(--ink); color: var(--bg); }
  .bt-pri:hover { background: var(--accent); }

  .follow-up {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0.25rem 0 0;
    line-height: 1.5;
  }
  .follow-up a { color: var(--accent); }

  /* Logo upload row */
  .logo-row { display: flex; gap: 0.6rem; align-items: center; }
  .logo-url-input { flex: 1; }
  .upload-btn {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.45rem 0.85rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--ink-soft);
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
    min-width: 90px;
    text-transform: none;
    letter-spacing: 0;
    font-family: var(--font-body);
  }
  .upload-btn:hover { border-color: var(--accent); color: var(--accent); }
  .upload-btn.disabled { cursor: progress; opacity: 0.7; }
  .upload-btn input[type="file"] { display: none; }
  .logo-preview-tile {
    width: 44px;
    height: 44px;
    border: 1px solid var(--rule-soft);
    border-radius: var(--radius);
    padding: 3px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-preview { max-width: 100%; max-height: 100%; object-fit: contain; }
  .progress {
    margin-top: 0.4rem;
    width: 100%;
    height: 3px;
    background: var(--paper);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill { height: 100%; background: var(--accent); transition: width 0.15s; }
  .upload-error { color: var(--warn); }

  /* Logo background swatches */
  .bg-field { margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 6px; }
  .swatches { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; }
  .swatch {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 38px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
  }
  .swatch:hover { border-color: var(--ink); }
  .swatch.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent), transparent 70%);
  }
  .swatch input[type="radio"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .swatch-label {
    /* Hex backgrounds vary - this neutral grey + translucent white
       label box reads on every option. */
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #5e5b56;
    background: rgba(255, 255, 255, 0.85);
    padding: 1px 4px;
    border-radius: 2px;
  }
</style>
