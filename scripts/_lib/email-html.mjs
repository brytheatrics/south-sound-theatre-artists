// Markdown→HTML + styled email wrapper for cron-script emails.
// Mirrors the in-app pipeline (src/lib/server/email.ts wrapHtmlEmail +
// src/lib/util/markdown.ts renderMarkdown) so cron emails (digests,
// launch invitations, stale cleanup) render with the same brand chrome
// as in-app sends.

const ESC_BR = String.fromCharCode(0x0007);
const ESC_NBSP = String.fromCharCode(0x0008);

function maskEscapes(s) {
  return s
    .replace(/<br\s*\/?>/gi, ESC_BR)
    .replace(/&nbsp;/g, ESC_NBSP);
}
function unmaskEscapes(s) {
  return s
    .replace(new RegExp(ESC_BR, "g"), "<br>")
    .replace(new RegExp(ESC_NBSP, "g"), "&nbsp;");
}

const SAFE_LINK_SCHEMES = new Set(["http", "https", "mailto", "tel"]);
const SAFE_IMG_SCHEMES = new Set(["http", "https"]);

function safeUrl(url, allowed) {
  const cleaned = url.replace(/[\x00-\x20\x7F]/g, "");
  if (!cleaned) return "#";
  let safe;
  if (cleaned.startsWith("/") || cleaned.startsWith("#") || cleaned.startsWith("?")) {
    safe = cleaned;
  } else {
    const colonIdx = cleaned.indexOf(":");
    if (colonIdx === -1) {
      safe = cleaned;
    } else {
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
        safe = allowed.has(scheme) ? cleaned : "#";
      }
    }
  }
  return safe.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  return s
    // [![alt](img)](link) -> linked image. Must run BEFORE plain image / link.
    .replace(
      /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g,
      (_, alt, src, href) =>
        `<a href="${safeUrl(href, SAFE_LINK_SCHEMES)}"><img src="${safeUrl(src, SAFE_IMG_SCHEMES)}" alt="${alt}" style="border:0;vertical-align:middle"/></a>`,
    )
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_, alt, src) =>
        `<img src="${safeUrl(src, SAFE_IMG_SCHEMES)}" alt="${alt}" style="border:0;vertical-align:middle;max-width:100%;height:auto"/>`,
    )
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, text, href) =>
        `<a href="${safeUrl(href, SAFE_LINK_SCHEMES)}" style="color:#3b6f4a;text-decoration:underline">${text}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// Renders the cron-template subset: paragraphs split on blank lines,
// inline images, links, bold, italic. Single newlines within a
// paragraph become <br/>. <br> and &nbsp; in the source survive the
// HTML escape pass (admin-controlled signature uses both).
export function renderMarkdownLite(markdown) {
  if (!markdown) return "";
  const masked = maskEscapes(String(markdown));
  const blocks = masked.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const escaped = escapeHtml(block.trim());
      let s = inline(escaped);
      s = s.replace(/\n/g, "<br/>");
      return `<p style="margin:0 0 14px">${s}</p>`;
    })
    .map(unmaskEscapes)
    .join("\n");
}

export function wrapHtmlEmail(bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SSTA</title>
</head>
<body style="margin:0;padding:0;background:#e0ddda;font-family:'Inter Tight','Helvetica Neue',Arial,sans-serif;color:#2a2622;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e0ddda">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fffaf0;border:1px solid #3b6f4a;border-radius:6px">
        <tr>
          <td style="padding:32px 36px 36px 36px;font-size:15px;color:#2a2622">
            <div class="email-body" style="font-size:15px;line-height:1.55">${bodyHtml}</div>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;letter-spacing:0.08em;color:#3b6f4a;text-transform:uppercase">
        South Sound Theatre Artists
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;
}
