// Phone-number normalisation. Mirrors the normalizeUrl pattern: applied
// at write-time (submit / edit / admin save actions, bulk import) and
// as a defensive shim at render-time so older rows with weird formats
// still tap-to-call cleanly.
//
// We deliberately don't enforce strict format - artists might type
// "(253) 555-0142", "253-555-0142", "+1 253 555 0142", or just
// "2535550142", and we want all of them to work without a confusing
// validation error. The renderer's job is to keep them legible; the
// matcher's job (digits-only) is to make duplicate detection robust.

/**
 * Returns the input with surrounding whitespace stripped. Pass-through
 * for empty values. Used as a write-time normaliser - we keep the
 * artist's preferred formatting (parens, dashes, spaces, country code)
 * because that's what they'll recognise on their own profile.
 */
export function normalizePhone(input: string | null | undefined): string {
  return (input ?? "").trim();
}

/**
 * Strips everything that isn't a digit. Used for duplicate-detection
 * and any future eq() comparisons - "(253) 555-0142" and "253-555-0142"
 * both reduce to "2535550142".
 */
export function phoneDigits(input: string | null | undefined): string {
  return (input ?? "").replace(/\D/g, "");
}

/**
 * Lightweight format check. Accepts anything with at least 7 digits
 * (so a US number with or without area code, or an international
 * number, all pass) and at most 16 (E.164 maximum). Used on form
 * submit so a typo like "n/a" or stray text gets rejected without
 * forcing artists to use a specific format.
 *
 * Empty input returns true - phone is always optional.
 */
export function isValidPhone(input: string | null | undefined): boolean {
  const v = (input ?? "").trim();
  if (!v) return true;
  const digits = phoneDigits(v);
  return digits.length >= 7 && digits.length <= 16;
}

/**
 * Render-time helper: produces a `tel:` URL from any of our accepted
 * formats. Strips formatting characters and keeps a leading "+" if
 * present (E.164 international). Returns "" for empty input so the
 * caller can `{#if telUrl}` rather than emitting a broken link.
 */
export function telHref(input: string | null | undefined): string {
  const v = (input ?? "").trim();
  if (!v) return "";
  const digits = phoneDigits(v);
  if (!digits) return "";
  return v.startsWith("+") ? `tel:+${digits}` : `tel:${digits}`;
}

/**
 * Display-time formatter. Standardises the look of phones rendered to
 * admin so a list of back-filled numbers doesn't read as a parade of
 * mixed punctuation - "(253) 555-0142" / "253.555.0142" / "2535550142"
 * all render as "(253) 555-0142".
 *
 * Scope-limited to clearly US numbers (10 digits, or 11 digits with a
 * leading 1). Anything else - international with a "+", weird digit
 * counts, malformed - is returned as-typed so we don't mangle a
 * legitimate non-US number with a US-centric mask.
 *
 * Stored value is never rewritten by this function. Pure display.
 */
export function formatPhoneDisplay(input: string | null | undefined): string {
  const v = (input ?? "").trim();
  if (!v) return "";
  // Anything starting with "+" is international - leave as-is.
  if (v.startsWith("+")) return v;
  const digits = phoneDigits(v);
  // 10-digit US: NNN-NNN-NNNN structure.
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // 11-digit US with a leading 1.
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  // Anything else - too short, too long, mixed text - render literally.
  return v;
}
