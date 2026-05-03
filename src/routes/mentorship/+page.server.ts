// Public /mentorship page. Surfaces the mentorship_offering /
// mentorship_seeking arrays already on every profile, in two
// side-by-side sections: "Mentors offering" + "Looking to learn."
// A profile with both fields set appears in both sections.
//
// Filter state lives in URL params (?d=acting,directing) so views
// are shareable. Filter is loose: a profile passes if any of its
// mentorship array overlaps with the picked disciplines.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export type MentorshipProfile = {
  slug: string;
  full_name: string;
  pronouns: string | null;
  geographic_area: string | null;
  city: string | null;
  headshot_url: string | null;
  is_minor: boolean;
  // Whichever of these is non-empty for a given row decides which
  // section it goes in (or both).
  mentorship_offering: string[];
  mentorship_seeking: string[];
};

export const load: PageServerLoad = async ({ url }) => {
  const params = url.searchParams;
  const discParam = params.get("d") ?? "";
  const activeDisciplines = discParam
    ? discParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const [profileRes, disciplinesRes, contentRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(
        `slug, full_name, pronouns, geographic_area, city, headshot_url,
         is_minor, mentorship_offering, mentorship_seeking`,
      )
      .eq("published", true)
      .is("deleted_at", null)
      // We only care about profiles that have something to say re:
      // mentorship - either offering or seeking. Filter at the DB
      // level via array_length to skip empty rows.
      .or(
        "mentorship_offering.not.eq.{},mentorship_seeking.not.eq.{}",
      )
      .order("full_name"),
    supabaseAdmin
      .from("disciplines")
      .select("name")
      .order("sort_order"),
    supabaseAdmin
      .from("site_content")
      .select("body_markdown")
      .eq("slug", "mentorship")
      .maybeSingle(),
  ]);
  if (profileRes.error) throw profileRes.error;

  const allRows = (profileRes.data ?? []) as MentorshipProfile[];

  // Discipline filter: a row passes if any of its mentorship arrays
  // overlap with the picked disciplines. Empty filter = show all.
  const matchesFilter = (r: MentorshipProfile) => {
    if (activeDisciplines.length === 0) return true;
    const all = [...(r.mentorship_offering ?? []), ...(r.mentorship_seeking ?? [])];
    return all.some((d) => activeDisciplines.includes(d));
  };

  const filtered = allRows.filter(matchesFilter);

  const offering = filtered.filter(
    (r) => Array.isArray(r.mentorship_offering) && r.mentorship_offering.length > 0,
  );
  const seeking = filtered.filter(
    (r) => Array.isArray(r.mentorship_seeking) && r.mentorship_seeking.length > 0,
  );

  return {
    offering,
    seeking,
    activeDisciplines,
    disciplines: (disciplinesRes.data ?? []).map((d: { name: string }) => d.name),
    lede: contentRes.data?.body_markdown ?? "",
    totalOffering: offering.length,
    totalSeeking: seeking.length,
  };
};
