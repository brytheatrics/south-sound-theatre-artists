// Public /theatres page — a directory of every theatre we track in
// organizations, regardless of whether their performances are auto-pulled
// or manually entered. Lexi can edit the public-facing metadata
// (description / homepage / email / logo) at /admin/organizations; the
// scrape-shaped fields (source_url, adapter, last_status) stay hidden
// from the public page.
//
// Category badges (post mig 105) let one org carry multiple programming
// chips - Theatre + Educational Theatre, etc. /theatres?category=<slug>
// filters the page to orgs whose categories array contains that slug.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { CATEGORY_LABELS, KNOWN_CATEGORY_SLUGS } from "$lib/server/orgCategories";

export type TheatreRow = {
  slug: string;
  name: string;
  area_id: string | null;
  area_name: string | null;
  description: string | null;
  homepage_url: string | null;
  logo_url: string | null;
  logo_bg: string;
  categories: string[];
};

export const load: PageServerLoad = async ({ url }) => {
  const areaFilter = url.searchParams.get("area") ?? "";
  const categoryFilter = url.searchParams.get("category") ?? "";

  const [{ data: sources, error }, { data: areas }, { data: contentRow }] = await Promise.all([
    supabaseAdmin
      .from("organizations")
      .select(
        `slug, name, area_id, active,
         description, homepage_url, logo_url, logo_bg, categories`,
      )
      .eq("active", true)
      .is("deleted_at", null)
      .order("name"),
    supabaseAdmin
      .from("areas")
      .select("id, name, sort_order")
      .order("sort_order"),
    supabaseAdmin
      .from("site_content")
      .select("body_markdown")
      .eq("slug", "theatres")
      .maybeSingle(),
  ]);
  if (error) throw error;

  const areaNameById = new Map((areas ?? []).map((a) => [a.id, a.name]));
  const areaIdByName = new Map((areas ?? []).map((a) => [a.name, a.id]));

  let rows: TheatreRow[] = (sources ?? []).map((s) => ({
    slug: s.slug,
    name: s.name,
    area_id: s.area_id,
    area_name: s.area_id ? areaNameById.get(s.area_id) ?? null : null,
    description: s.description,
    homepage_url: s.homepage_url,
    logo_url: s.logo_url,
    logo_bg: s.logo_bg ?? "paper",
    categories: Array.isArray(s.categories) ? s.categories : [],
  }));

  // Build category chip options dynamically: only show chips for
  // categories that actually have at least one org. Avoids "Opera (0)"
  // chips before any opera companies exist. Sort: known canonical slugs
  // first in their canonical order, then any unrecognised slug at the
  // end alphabetically.
  const counts = new Map<string, number>();
  for (const r of rows) for (const c of r.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  const knownSet = new Set<string>(KNOWN_CATEGORY_SLUGS as readonly string[]);
  const known = (KNOWN_CATEGORY_SLUGS as readonly string[]).filter((s) => counts.has(s));
  const extra = [...counts.keys()].filter((s) => !knownSet.has(s)).sort();
  const categoryOptions = [...known, ...extra].map((slug) => ({
    slug,
    label: CATEGORY_LABELS[slug] ?? slug,
    count: counts.get(slug) ?? 0,
  }));

  // Area filter — by name (URL-friendly) for shareability.
  if (areaFilter) {
    const wantId = areaIdByName.get(areaFilter);
    if (wantId) rows = rows.filter((r) => r.area_id === wantId);
  }
  // Category filter — by slug. Multi-badge orgs match if ANY of their
  // categories matches the requested slug.
  if (categoryFilter) {
    rows = rows.filter((r) => r.categories.includes(categoryFilter));
  }

  // Group by area for the cards, preserving the canonical sort_order so
  // the regional grouping reads top -> south -> north.
  const byArea = new Map<string, TheatreRow[]>();
  for (const a of areas ?? []) byArea.set(a.name, []);
  for (const r of rows) {
    const key = r.area_name ?? "Other";
    if (!byArea.has(key)) byArea.set(key, []);
    byArea.get(key)!.push(r);
  }
  const grouped = Array.from(byArea.entries())
    .filter(([, list]) => list.length > 0)
    .map(([area, list]) => ({ area, list }));

  return {
    grouped,
    total: rows.length,
    areaOptions: (areas ?? []).map((a) => a.name),
    activeArea: areaFilter,
    categoryOptions,
    activeCategory: categoryFilter,
    categoryLabels: CATEGORY_LABELS,
    lede: contentRow?.body_markdown ?? "",
  };
};
