// /calendar/[id]: public production detail page. Shows the production
// metadata + cast / production credits, with each linked artist
// hyperlinked to their /artists/[slug] profile.
//
// Public read: anyone can view if the production is approved + not
// deleted. Admins also see hidden / pending drafts.

import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { loadProductionCredits } from "$lib/server/productionCredits";

export const load: PageServerLoad = async ({ params, locals }) => {
  const isAdmin = !!locals.admin;
  let query = supabaseAdmin
    .from("productions")
    .select(
      `id, title, description, run_start, run_end, show_dates, detail_url, cover_url, status,
       category_id,
       organizations:organization_id ( id, name, slug, homepage_url, logo_url )`,
    )
    .eq("id", params.id)
    .is("deleted_at", null);
  if (!isAdmin) query = query.eq("status", "approved");
  const { data, error: err } = await query.maybeSingle();
  if (err) throw err;
  if (!data) error(404, "Production not found");

  const credits = await loadProductionCredits(params.id);

  // Pull the category name for nicer rendering.
  let categoryName: string | null = null;
  if (data.category_id) {
    const { data: cat } = await supabaseAdmin
      .from("event_categories")
      .select("name")
      .eq("id", data.category_id)
      .maybeSingle();
    categoryName = cat?.name ?? null;
  }

  // For each linked credit, pull the artist's slug + headshot for
  // hyperlinking + a small avatar.
  const linkedProfileIds = [
    ...credits.cast,
    ...credits.production,
  ]
    .map((c) => c.profile_id)
    .filter((id): id is string => !!id);
  const profileMap = new Map<string, { slug: string; headshot_url: string | null; full_name: string }>();
  if (linkedProfileIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, slug, headshot_url, full_name, is_minor, published")
      .in("id", linkedProfileIds)
      .is("deleted_at", null);
    for (const p of profiles ?? []) {
      // Don't expose minor profile headshots, and don't link to
      // unpublished profiles (admin sees them via the admin path).
      if (!p.published) continue;
      profileMap.set(p.id, {
        slug: p.slug,
        headshot_url: p.is_minor ? null : p.headshot_url,
        full_name: p.full_name,
      });
    }
  }

  return {
    production: { ...data, category_name: categoryName },
    credits,
    profileMap: Object.fromEntries(profileMap),
  };
};
