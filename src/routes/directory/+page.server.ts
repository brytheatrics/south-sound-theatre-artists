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
  const hasHeadshot = params.get("headshot") === "1";
  const ageMinStr = params.get("ageMin") ?? "";
  const ageMaxStr = params.get("ageMax") ?? "";
  const sortParam = (params.get("sort") ?? "").trim();
  const sort: "newest" | "name" | "updated" =
    sortParam === "name" || sortParam === "updated" ? sortParam : "newest";
  const ageMin = ageMinStr && /^\d+$/.test(ageMinStr) ? Number(ageMinStr) : null;
  const ageMax = ageMaxStr && /^\d+$/.test(ageMaxStr) ? Number(ageMaxStr) : null;

  // Build a base query with every filter EXCEPT age - shared between the
  // main grid query and the "no-age-set" count below the grid.
  const buildBase = () => {
    let q2 = supabaseAdmin
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
      q2 = q2.or(`full_name.ilike.%${q}%,slug.ilike.%${q}%`);
    }
    if (disciplines.length > 0) {
      q2 = q2.overlaps("disciplines", disciplines);
    }
    if (unions.length > 0) {
      q2 = q2.overlaps("unions", unions);
    }
    if (areas.length > 0) {
      q2 = q2.in("geographic_area", areas);
    }
    if (language) {
      q2 = q2.contains("languages", [language]);
    }
    if (hasHeadshot) {
      q2 = q2.not("headshot_url", "is", null);
    }
    return q2;
  };

  let query = buildBase();
  const ageFilterActive = ageMin !== null || ageMax !== null;
  if (ageMin !== null) {
    // Strict: artist must have set their range AND their max must be >= the
    // requested min. Profiles with no range set are surfaced separately.
    query = query.gte("playable_age_max", ageMin);
  }
  if (ageMax !== null) {
    query = query.lte("playable_age_min", ageMax);
  }

  if (sort === "name") {
    query = query.order("full_name", { ascending: true });
  } else if (sort === "updated") {
    query = query.order("updated_at", { ascending: false });
  } else {
    query = query.order("member_since", { ascending: false });
  }
  query = query.limit(PAGE_SIZE);

  const { data, count, error } = await query;
  if (error) throw error;

  // Count "no age set" profiles that match every other active filter, so the
  // UI can tell the searcher how many artists were excluded by their age
  // filter for not specifying a range.
  let noAgeCount = 0;
  if (ageFilterActive) {
    const noAgeQuery = buildBase()
      .is("playable_age_min", null)
      .limit(0);
    const { count: nac, error: nacErr } = await noAgeQuery;
    if (nacErr) throw nacErr;
    noAgeCount = nac ?? 0;
  }

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
    noAgeCount,
    pageSize: PAGE_SIZE,
    filters: {
      q,
      disciplines,
      unions,
      areas,
      language,
      hasHeadshot,
      ageMin: ageMinStr,
      ageMax: ageMaxStr,
      sort,
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
