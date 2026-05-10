// Single source of truth for "is this profile complete enough to be
// listed publicly?" Used by:
//   - The launch-grace cron sweep (auto-hide profiles still missing
//     required fields after their 30-day grace period)
//   - The artist /edit/[token] save handler (auto-republish when the
//     artist fills in the missing fields)
//   - The /admin/profiles/[id]/edit save handler (same auto-republish)
//   - The banner on /edit/[token] (tell the artist exactly what's
//     missing)
//
// Required fields mirror the public /submit form's required validations
// so the bar is identical for "submitted online" and "completed after
// being bulk-imported."

export type ProfileCompletenessInput = {
  full_name?: string | null;
  bio?: string | null;
  headshot_url?: string | null;
  headshot_consent?: boolean | null;
  disciplines?: string[] | null;
  geographic_area?: string | null;
};

/** Plain-English labels for each required field, indexed by the same
 *  keys the helper functions return. Used in the warning email + the
 *  auto-hide admin_note + the /edit/[token] banner. */
export const REQUIRED_FIELD_LABELS: Record<string, string> = {
  full_name: "Full name",
  bio: "Bio",
  headshot: "Headshot photo + rights confirmation",
  disciplines: "At least one discipline",
  geographic_area: "Geographic area",
};

export function missingRequiredFields(p: ProfileCompletenessInput): string[] {
  const missing: string[] = [];
  if (!p.full_name || !p.full_name.trim()) missing.push("full_name");
  if (!p.bio || !p.bio.trim()) missing.push("bio");
  if (!p.headshot_url || !p.headshot_url.trim() || !p.headshot_consent) {
    missing.push("headshot");
  }
  if (!p.disciplines || p.disciplines.length === 0) missing.push("disciplines");
  if (!p.geographic_area || !p.geographic_area.trim()) {
    missing.push("geographic_area");
  }
  return missing;
}

export function isProfileIncomplete(p: ProfileCompletenessInput): boolean {
  return missingRequiredFields(p).length > 0;
}

/** Pretty list for human-readable copy. Returns e.g.
 *  "Bio, At least one discipline, Geographic area". */
export function formatMissingFields(missing: string[]): string {
  return missing.map((k) => REQUIRED_FIELD_LABELS[k] ?? k).join(", ");
}
