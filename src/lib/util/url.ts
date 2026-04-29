// Normalises user-typed URLs so they always carry a protocol.
//
// Without this, a value like "harryturpin.com" gets used directly as
// the `href` of an <a>, and the browser interprets it as a path
// relative to the current page (e.g. /artists/harryturpin.com).
//
// Used both at write-time (submit / edit / admin save actions, bulk
// import) and as a defensive shim at render-time so older rows with
// bare domains still link out correctly without a data backfill.

const PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Returns the input prefixed with "https://" when it has no scheme.
 * Pass-through for empty values, mailto:, tel:, javascript:, etc.
 *
 * - "" / null / undefined -> ""
 * - "mailto:x@y.z"        -> "mailto:x@y.z"
 * - "https://example.com" -> "https://example.com"
 * - "example.com"         -> "https://example.com"
 * - "//example.com"       -> "https://example.com"
 * - "/local/path"         -> "/local/path" (treat as same-origin)
 */
export function normalizeUrl(input: string | null | undefined): string {
  const v = (input ?? "").trim();
  if (!v) return "";

  // Same-origin paths pass through untouched.
  if (v.startsWith("/") && !v.startsWith("//")) return v;

  // Already has a scheme.
  if (PROTOCOL_RE.test(v)) return v;

  // Protocol-relative ("//example.com") - upgrade to https.
  if (v.startsWith("//")) return "https:" + v;

  // Bare domain or path - prepend https://.
  return "https://" + v;
}
