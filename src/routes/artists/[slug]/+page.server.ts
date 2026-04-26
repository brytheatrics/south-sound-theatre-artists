// Stub: profile pages ship in step 11. For now, look up the profile so
// linking from the homepage works, render a minimal placeholder card.

import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async ({ params }) => {
  const { data, error: err } = await supabaseAdmin
    .from("profiles")
    .select(
      "slug, full_name, pronouns, bio, disciplines, geographic_area, headshot_url",
    )
    .eq("slug", params.slug)
    .eq("published", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (err) throw err;
  if (!data) error(404, "Profile not found");
  return { profile: data };
};
