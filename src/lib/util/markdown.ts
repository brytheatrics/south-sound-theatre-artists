// Tiny markdown subset shared between the admin live preview and the
// public site_content pages. Handles paragraphs, # / ## headings,
// **bold**, *italic*, [link](url), ![alt](url) images, - lists.
//
// Not a full CommonMark renderer. Sufficient for editable copy and
// keeps render output identical between the editor preview and the
// served HTML.

export function renderMarkdown(md: string): string {
  if (!md) return "";
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = escape(md).split(/\r?\n/);

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
  return html;
}

function inline(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
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
  return inline(escape(md.trim()));
}
