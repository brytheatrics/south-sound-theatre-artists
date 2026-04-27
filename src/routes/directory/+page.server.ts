// Public directory: filterable + searchable list of published profiles.
// Filter state lives in URL search params so the views are shareable.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

const PAGE_SIZE = 48;

export const load: PageServerLoad = async ({ url }) => {
  const params = url.searchParams;
  const q = (params.get("q") ?? "").trim();
  const disciplines = params.getAll("d").filter(Boolean);
  const unions = params.getAll("u").filter(Boolean);
  const areas = params.getAll("area").filter(Boolean);
  const language = (params.get("lang") ?? "").trim();
  const ageMinStr = params.get("ageMin") ?? "";
  const ageMaxStr = params.get("ageMax") ?? "";
  const ageMin = ageMinStr && /^\d+$/.test(ageMinStr) ? Number(ageMinStr) : null;
  const ageMax = ageMaxStr && /^\d+$/.test(ageMaxStr) ? Number(ageMaxStr) : null;

  let query = supabaseAdmin
    .from("profiles")
    .select(
      `slug, full_name, pronouns, disciplines, geographic_area,
       playable_age_min, playable_age_max, headshot_url, member_since`,
      { count: "exact" },
    )
    .eq("published", true)
    .is("deleted_at", null);

  if (q) {
    // ilike against the name. Slug match too so direct URLs find each other.
    query = query.or(`full_name.ilike.%${q}%,slug.ilike.%${q}%`);
  }
  if (disciplines.length > 0) {
    // Match if profile.disciplines overlaps any selected discipline.
    query = query.overlaps("disciplines", disciplines);
  }
  if (unions.length > 0) {
    query = query.overlaps("unions", unions);
  }
  if (areas.length > 0) {
    query = query.in("geographic_area", areas);
  }
  if (language) {
    query = query.contains("languages", [language]);
  }
  if (ageMin !== null) {
    // Profile's playable max should be >= the requested min (artist can play that age)
    query = query.or(`playable_age_max.gte.${ageMin},playable_age_max.is.null`);
  }
  if (ageMax !== null) {
    query = query.or(`playable_age_min.lte.${ageMax},playable_age_min.is.null`);
  }

  query = query.order("member_since", { ascending: false }).limit(PAGE_SIZE);

  const { data, count, error } = await query;
  if (error) throw error;

  const [areasRes, disciplinesRes, categoriesRes, unionsRes] = await Promise.all([
    supabaseAdmin.from("areas").select("name").order("sort_order"),
    supabaseAdmin
      .from("disciplines")
      .select("name, category")
      .order("sort_order"),
    supabaseAdmin
      .from("discipline_categories")
      .select("name")
      .order("sort_order"),
    supabaseAdmin.from("unions").select("name").order("sort_order"),
  ]);

  return {
    profiles: data ?? [],
    total: count ?? 0,
    pageSize: PAGE_SIZE,
    filters: {
      q,
      disciplines,
      unions,
      areas,
      language,
      ageMin: ageMinStr,
      ageMax: ageMaxStr,
    },
    options: {
      areas: (areasRes.data ?? []).map((a: { name: string }) => a.name),
      disciplines: disciplinesRes.data ?? [],
      disciplineCategories: (categoriesRes.data ?? []).map(
        (c: { name: string }) => c.name,
      ),
      unions: (unionsRes.data ?? []).map((u: { name: string }) => u.name),
    },
  };
};
