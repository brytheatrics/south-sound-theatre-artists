// Public directory: filterable + searchable list of published profiles.
// Filter state lives in URL search params so the views are shareable.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

// 60 fits 2/3/4/5/6-column grids cleanly and means most current users
// see everyone on one page (~27 profiles in the launch batch). Headshots
// lazy-load so DOM size is the main cost; tractable up to a few hundred.
const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ url }) => {
  const params = url.searchParams;
  const q = (params.get("q") ?? "").trim();
  const disciplines = params.getAll("d").filter(Boolean);
  const unions = params.getAll("u").filter(Boolean);
  const areas = params.getAll("area").filter(Boolean);
  const language = (params.get("lang") ?? "").trim();
  const hasHeadshot = params.get("headshot") === "1";
  const mentoring = params.get("mentoring") === "1";
  const learning = params.get("learning") === "1";
  const ageMinStr = params.get("ageMin") ?? "";
  const ageMaxStr = params.get("ageMax") ?? "";
  const sortParam = (params.get("sort") ?? "").trim();
  const sort: "newest" | "name" | "updated" =
    sortParam === "name" || sortParam === "updated" ? sortParam : "newest";
  const ageMin = ageMinStr && /^\d+$/.test(ageMinStr) ? Number(ageMinStr) : null;
  const ageMax = ageMaxStr && /^\d+$/.test(ageMaxStr) ? Number(ageMaxStr) : null;
  const pageParam = params.get("page") ?? "";
  const page = /^\d+$/.test(pageParam) && Number(pageParam) > 0 ? Number(pageParam) : 1;

  // Build a base query with every filter EXCEPT age - shared between the
  // main grid query and the "no-age-set" count below the grid.
  const buildBase = () => {
    let q2 = supabaseAdmin
      .from("profiles")
      .select(
        `slug, full_name, pronouns, disciplines, geographic_area, city,
         playable_age_min, playable_age_max, headshot_url, member_since,
         mentorship_offering, mentorship_seeking`,
        { count: "exact" },
      )
      .eq("published", true)
      .is("deleted_at", null);
    if (q) {
      // ilike against the name. Slug match too so direct URLs find each other.
      q2 = q2.or(`full_name.ilike.%${q}%,slug.ilike.%${q}%`);
    }
    // Discipline picker doubles as a mentorship lens: when a mentorship
    // chip is on, the picker narrows by the matching mentorship array
    // instead of the artist's own disciplines. Both chips together OR
    // the two arrays so "anyone interested in mentorship around X" works.
    if (disciplines.length > 0) {
      if (mentoring && learning) {
        // Postgrest .or() takes a comma-separated string. Use cs (contains
        // any) per array.
        const offer = `mentorship_offering.ov.{${disciplines.map((d) => `"${d.replace(/"/g, '\\"')}"`).join(",")}}`;
        const seek = `mentorship_seeking.ov.{${disciplines.map((d) => `"${d.replace(/"/g, '\\"')}"`).join(",")}}`;
        q2 = q2.or(`${offer},${seek}`);
      } else if (mentoring) {
        q2 = q2.overlaps("mentorship_offering", disciplines);
      } else if (learning) {
        q2 = q2.overlaps("mentorship_seeking", disciplines);
      } else {
        q2 = q2.overlaps("disciplines", disciplines);
      }
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
    // Mentorship filters: array_length > 0. PostgREST has no direct
    // array-length operator, but `not.eq.{}` excludes the empty array
    // sentinel that the column defaults to.
    if (mentoring) {
      q2 = q2.not("mentorship_offering", "eq", "{}");
    }
    if (learning) {
      q2 = q2.not("mentorship_seeking", "eq", "{}");
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
    query = query.order("last_name", { ascending: true });
  } else if (sort === "updated") {
    query = query.order("updated_at", { ascending: false });
  } else {
    // member_since is a date (day-resolution), so multiple profiles
    // created on the same day tie. created_at is a timestamptz and breaks
    // the tie by exact creation time - the just-approved profile lands
    // at the top instead of floating somewhere inside today's batch.
    query = query
      .order("member_since", { ascending: false })
      .order("created_at", { ascending: false });
  }
  const offset = (page - 1) * PAGE_SIZE;
  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

  const [areasRes, disciplinesRes, categoriesRes, unionsRes, contentRes] = await Promise.all([
    supabaseAdmin.from("areas").select("name, description").order("sort_order"),
    supabaseAdmin
      .from("disciplines")
      .select("name, category")
      .order("sort_order"),
    supabaseAdmin
      .from("discipline_categories")
      .select("name")
      .order("sort_order"),
    supabaseAdmin.from("unions").select("name").order("sort_order"),
    supabaseAdmin
      .from("site_content")
      .select("body_markdown")
      .eq("slug", "directory")
      .maybeSingle(),
  ]);

  return {
    lede: contentRes.data?.body_markdown ?? "",
    profiles: data ?? [],
    total,
    page,
    totalPages,
    noAgeCount,
    pageSize: PAGE_SIZE,
    filters: {
      q,
      disciplines,
      unions,
      areas,
      language,
      hasHeadshot,
      mentoring,
      learning,
      ageMin: ageMinStr,
      ageMax: ageMaxStr,
      sort,
    },
    options: {
      areas: (areasRes.data ?? []) as Array<{ name: string; description: string | null }>,
      disciplines: disciplinesRes.data ?? [],
      disciplineCategories: (categoriesRes.data ?? []).map(
        (c: { name: string }) => c.name,
      ),
      unions: (unionsRes.data ?? []).map((u: { name: string }) => u.name),
    },
  };
};
