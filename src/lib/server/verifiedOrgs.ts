// Tiny helper for callboard / admin pages that need to know which
// organizations are flagged `verified=true`. The "verified company"
// badge on callboard posts gates on this set, NOT on whether the post
// has an `organization_id` set - those two are different things now
// that admin-authored posts can link to a non-verified producing
// theatre via organization_id without earning the badge.

import { supabaseAdmin } from "$lib/server/supabase";

export async function loadVerifiedOrgIds(): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("verified", true)
    .is("deleted_at", null);
  return new Set((data ?? []).map((r) => r.id as string));
}
