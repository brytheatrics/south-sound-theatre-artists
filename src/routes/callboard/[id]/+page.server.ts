// Individual callboard post detail page. Redirects to /callboard if
// the post is not found, not published, or soft-deleted.

import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async ({ params }) => {
  const { data, error: err } = await supabaseAdmin
    .from("callboard_posts")
    .select(
      `id, post_type, title, organization_name, location, description,
       roles, compensation_type, compensation, contact_info,
       key_dates, deadline_text, expires_at, ticket_url,
       organization_id, is_ssta_event, created_at, updated_at`,
    )
    .eq("id", params.id)
    .eq("published", true)
    .eq("status", "approved")
    .is("deleted_at", null)
    .maybeSingle();

  if (err) throw error(500, "Something went wrong.");
  if (!data) throw error(404, "Post not found.");

  // Fetch verified org name if applicable.
  let orgName: string | null = null;
  if (data.organization_id) {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", data.organization_id)
      .maybeSingle();
    orgName = org?.name ?? null;
  }

  // Look up the type's display label from callboard_post_types so the
  // detail page shows whatever Lexi configured (e.g. "Workshop" rather
  // than the raw "workshop" slug).
  const { data: typeRow } = await supabaseAdmin
    .from("callboard_post_types")
    .select("label")
    .eq("slug", data.post_type)
    .maybeSingle();

  return {
    post: data,
    verifiedOrgName: orgName,
    typeLabel: typeRow?.label ?? data.post_type,
  };
};
