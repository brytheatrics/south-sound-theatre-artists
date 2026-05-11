// /admin/recent-edits: chronological audit log of every profile save.
// Backed by profile_edit_log (mig 108). Each row carries the diff for
// that save, rendered inline in the UI as old -> new.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  // Cap at 200 most-recent log entries. Add filter UI later if it grows.
  const { data: logs, error } = await supabaseAdmin
    .from("profile_edit_log")
    .select("id, profile_id, edited_by_kind, edited_by_email, changes, edited_at")
    .order("edited_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const profileIds = Array.from(new Set((logs ?? []).map((l) => l.profile_id)));
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, slug, full_name")
    .in("id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"]);
  const profilesById = new Map(
    (profiles ?? []).map((p) => [p.id, { slug: p.slug, full_name: p.full_name }]),
  );

  const rows = (logs ?? []).map((l) => ({
    id: l.id,
    profile_id: l.profile_id,
    profile_slug: profilesById.get(l.profile_id)?.slug ?? "?",
    profile_name: profilesById.get(l.profile_id)?.full_name ?? "Unknown",
    edited_by_kind: l.edited_by_kind as "artist" | "admin" | "org",
    edited_by_email: l.edited_by_email,
    changes: l.changes as Record<string, { old: unknown; new: unknown }>,
    edited_at: l.edited_at,
  }));

  return { rows };
};
