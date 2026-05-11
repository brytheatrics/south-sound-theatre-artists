// Append-only audit log for profile edits. Called from every save path
// (artist /edit/[token], admin /admin/profiles/[id]/edit, org-edit when
// applicable). Reads + display happen in /admin/recent-edits.
//
// The diff is shallow: each tracked field compares old vs new and only
// changed ones get stored. Arrays and jsonb objects are compared by
// JSON stringify since pg-driver returns them as plain JS values. Order
// matters for arrays (disciplines deliberately orders them).

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileEditKind = "artist" | "admin" | "org";

// Fields we audit. These are the ones a save can mutate from any of
// the three editor surfaces. updated_at / created_at / id are excluded
// (system-managed). published + auto_hidden_incomplete + admin_note are
// admin-only fields included so we capture admin-driven state changes.
const TRACKED_FIELDS = [
  "full_name",
  "slug",
  "email",
  "pronouns",
  "phone",
  "bio",
  "headshot_url",
  "headshot_consent",
  "geographic_area",
  "city",
  "playable_age_min",
  "playable_age_max",
  "languages",
  "disciplines",
  "unions",
  "ethnicities",
  "instagram_handle",
  "facebook_url",
  "tiktok_handle",
  "linkedin_url",
  "twitter_handle",
  "youtube_url",
  "website_url",
  "resumes",
  "mentorship_offering",
  "mentorship_seeking",
  "is_minor",
  "guardian_email",
  "guardian_name",
  "published",
  "auto_hidden_incomplete",
  "admin_note",
] as const;

type Row = Record<string, unknown>;

function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  // Treat null and "" as the same for editable string fields - blank
  // input from a form posts as "" which routes round-trip to null in DB,
  // and we don't want spurious diffs on every save where the user left
  // an empty field empty.
  if ((a === null || a === "") && (b === null || b === "")) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => eq(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

export function computeProfileDiff(before: Row, after: Row): Record<string, { old: unknown; new: unknown }> {
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  for (const f of TRACKED_FIELDS) {
    if (!eq(before[f], after[f])) {
      diff[f] = { old: before[f] ?? null, new: after[f] ?? null };
    }
  }
  return diff;
}

// Inserts a row to profile_edit_log iff there's a non-empty diff.
// Failures are logged but don't propagate - we don't want to fail a
// successful save because the audit insert errored.
export async function logProfileEdit(
  supabase: SupabaseClient,
  args: {
    profileId: string;
    before: Row;
    after: Row;
    kind: ProfileEditKind;
    editorEmail?: string | null;
  },
): Promise<void> {
  const changes = computeProfileDiff(args.before, args.after);
  if (Object.keys(changes).length === 0) return;
  const { error } = await supabase.from("profile_edit_log").insert({
    profile_id: args.profileId,
    edited_by_kind: args.kind,
    edited_by_email: args.editorEmail ?? null,
    changes,
  });
  if (error) console.error("profile_edit_log insert failed", error);
}
