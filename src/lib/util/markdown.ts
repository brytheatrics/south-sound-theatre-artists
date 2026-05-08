// Tiny markdown subset shared between the admin live preview and the
// public site_content pages. Handles paragraphs, # / ## headings,
// **bold**, *italic*, [link](url), ![alt](url) images, - lists.
//
// Backslash escapes are supported for the special characters above:
// `\-`, `\*`, `\[`, `\]`, `\!`, `\\`. Useful when you want to start a
// line with a literal dash without it becoming a list, or write
// "5*5" without the asterisks turning into italic.
//
// Not a full CommonMark renderer. Sufficient for editable copy and
// keeps render output identical between the editor preview and the
// served HTML.

// Mask escapes BEFORE the HTML escape pass and BEFORE any regex rules.
// Each `\X` becomes a private-use unicode placeholder so the existing
// regexes can't see the escaped character. We swap the placeholders
// back to the literal character at the very end. `\\` is processed
// first so a double-backslash doesn't chain into another escape rule.
// Built at runtime via fromCharCode so the source file doesn't depend
// on raw control bytes (0x0001-0x0008) surviving editor round-trips.
// None of these codepoints collide with anything Lexi would type.
const ESC_BS = String.fromCharCode(0x0001);
const ESC_DASH = String.fromCharCode(0x0002);
const ESC_STAR = String.fromCharCode(0x0003);
const ESC_LBRACK = String.fromCharCode(0x0004);
const ESC_RBRACK = String.fromCharCode(0x0005);
const ESC_BANG = String.fromCharCode(0x0006);
// HTML passthrough: <br> and &nbsp; survive the html-escape pass so
// markdown authors can stack lines tightly (line<br>line<br>line) and
// drop non-breaking spaces between adjacent images. Anything else
// stays escaped per the original "no raw HTML" policy.
const ESC_BR = String.fromCharCode(0x0007);
const ESC_NBSP = String.fromCharCode(0x0008);

function maskEscapes(s: string): string {
  return s
    .replace(/\\\\/g, ESC_BS)
    .replace(/\\-/g, ESC_DASH)
    .replace(/\\\*/g, ESC_STAR)
    .replace(/\\\[/g, ESC_LBRACK)
    .replace(/\\\]/g, ESC_RBRACK)
    .replace(/\\!/g, ESC_BANG)
    .replace(/<br\s*\/?>/gi, ESC_BR)
    .replace(/&nbsp;/g, ESC_NBSP);
}
function unmaskEscapes(s: string): string {
  return s
    .replace(new RegExp(ESC_DASH, "g"), "-")
    .replace(new RegExp(ESC_STAR, "g"), "*")
    .replace(new RegExp(ESC_LBRACK, "g"), "[")
    .replace(new RegExp(ESC_RBRACK, "g"), "]")
    .replace(new RegExp(ESC_BANG, "g"), "!")
    .replace(new RegExp(ESC_BS, "g"), "\\")
    .replace(new RegExp(ESC_BR, "g"), "<br>")
    .replace(new RegExp(ESC_NBSP, "g"), "&nbsp;");
}

// Allowlist of URL schemes the markdown link / image renderer will pass
// through. Anything else (`javascript:`, `data:`, `vbscript:`, custom
// app schemes) is replaced with `#`. The threat model is a rogue or
// compromised co-admin (multi-admin shipped) writing a stored-XSS
// payload into a blog post, site_content lede, or resource description
// that gets rendered to public visitors via {@html ...}.
const SAFE_LINK_SCHEMES = new Set(["http", "https", "mailto", "tel"]);
const SAFE_IMG_SCHEMES = new Set(["http", "https"]);

function safeUrl(url: string, allowedSchemes: Set<string>): string {
  // Strip ASCII control chars + whitespace before the scheme check.
  // Browsers strip these from URLs at parse time, so a hidden \x00 in
  // "java\x00script:" would become a live `javascript:` URL after
  // parsing if we only checked the literal characters.
  const cleaned = url.replace(/[\x00-\x20\x7F]/g, "");
  if (!cleaned) return "#";
  let safe: string;
  if (cleaned.startsWith("/") || cleaned.startsWith("#") || cleaned.startsWith("?")) {
    safe = cleaned;
  } else {
    const colonIdx = cleaned.indexOf(":");
    if (colonIdx === -1) {
      safe = cleaned;
    } else {
      // A `:` further along than the first `/`, `?`, or `#` is part of
      // the path/query/fragment, not a scheme separator (`foo/bar:baz`).
      const firstPathChar = Math.min(
        ...["/", "?", "#"].map((c) => {
          const i = cleaned.indexOf(c);
          return i === -1 ? Infinity : i;
        }),
      );
      if (colonIdx > firstPathChar) {
        safe = cleaned;
      } else {
        const scheme = cleaned.slice(0, colonIdx).toLowerCase();
        safe = allowedSchemes.has(scheme) ? cleaned : "#";
      }
    }
  }
  // Belt-and-suspenders attribute-breakout defense. The outer escape()
  // pass only handles `&`, `<`, `>` — a literal `"` in the URL would
  // close the href attribute and let the rest become injected attrs
  // (`http://x" onmouseover="alert(1)`).
  return safe.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderMarkdown(md: string): string {
  if (!md) return "";
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = escape(maskEscapes(md)).split(/\r?\n/);

  let html = "";
  let inList = false;
  // Each non-empty body line becomes its own paragraph. Blank lines
  // are visual padding only (skipped). This matches what Word /
  // Google Docs users expect from hitting Enter: one Enter = new
  // paragraph. We deliberately diverge from CommonMark here, where
  // a single newline is a soft wrap inside a paragraph - that
  // behavior assumes terminal-edited markdown files where lines
  // are hard-wrapped at 80 cols. Our editor is a soft-wrap
  // textarea, so single-Enter-as-soft-wrap has no use case.
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }
    if (line.startsWith("# ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h1>${inline(line.slice(2))}</h1>`;
      continue;
    }
    if (line.startsWith("## ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h2>${inline(line.slice(3))}</h2>`;
      continue;
    }
    if (line.startsWith("### ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3>${inline(line.slice(4))}</h3>`;
      continue;
    }
    if (line.startsWith("- ")) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(line.slice(2))}</li>`;
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return unmaskEscapes(html);
}

function inline(s: string): string {
  return s
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_, alt: string, src: string) =>
        `<img src="${safeUrl(src, SAFE_IMG_SCHEMES)}" alt="${alt}" />`,
    )
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, text: string, href: string) =>
        `<a href="${safeUrl(href, SAFE_LINK_SCHEMES)}">${text}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/**
 * Render inline markdown only (no block wrappers like <p>). Use when
 * the host element already provides the surrounding tag and you just
 * want **bold**, *italic*, and [link]() applied to the text.
 */
export function renderMarkdownInline(md: string): string {
  if (!md) return "";
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return unmaskEscapes(inline(escape(maskEscapes(md.trim()))));
}
