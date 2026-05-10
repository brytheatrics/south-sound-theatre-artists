// /still-active/[token]
//
// One-click "yes, I'm still here" landing for the stale-profile ping
// email. Validates the same edit_profile token used by /edit/[token],
// clears stale_pinged_at on the profile, and bumps updated_at so the
// next cron run sees movement and skips the artist. Does NOT burn the
// token - the artist might also want to actually edit their profile
// from the same email, and we only burn on real mutations elsewhere.
//
// Idempotent: clicking twice is fine (the second click just re-stamps
// updated_at, which is harmless).

import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { validateEditToken } from "$lib/server/editToken";

export const load: PageServerLoad = async ({ params }) => {
  const token = await validateEditToken(params.token);
  if (!token) {
    throw error(404, "This link is invalid or has expired.");
  }

  // Clear the stale flag + bump updated_at. The cron looks at both:
  // updated_at moving past stale_pinged_at unconditionally clears the
  // pending soft-delete window; we set stale_pinged_at to null too as
  // a belt-and-suspenders so the row is unambiguously back to "active."
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .update({
      stale_pinged_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", token.target_id)
    .select("full_name, slug")
    .maybeSingle();

  if (!profile) {
    throw error(404, "Profile not found.");
  }

  return { name: profile.full_name, slug: profile.slug };
};
