// Public /theatres page — a directory of every theatre we track in
// event_sources, regardless of whether their performances are auto-pulled
// or manually entered. Lexi can edit the public-facing metadata
// (description / homepage / email / logo) at /admin/event-sources; the
// scrape-shaped fields (source_url, adapter, last_status) stay hidden
// from the public page.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export type TheatreRow = {
  slug: string;
  name: string;
  area_id: string | null;
  area_name: string | null;
  description: string | null;
  homepage_url: string | null;
  logo_url: string | null;
  logo_bg: string;
};

export const load: PageServerLoad = async ({ url }) => {
  const areaFilter = url.searchParams.get("area") ?? "";

  const [{ data: sources, error }, { data: areas }] = await Promise.all([
    supabaseAdmin
      .from("event_sources")
      .select(
        `org_slug, org_name, area_id, active,
         description, homepage_url, logo_url, logo_bg`,
      )
      .eq("active", true)
      .order("org_name"),
    supabaseAdmin
      .from("areas")
      .select("id, name, sort_order")
      .order("sort_order"),
  ]);
  if (error) throw error;

  const areaNameById = new Map((areas ?? []).map((a) => [a.id, a.name]));
  const areaIdByName = new Map((areas ?? []).map((a) => [a.name, a.id]));

  let rows: TheatreRow[] = (sources ?? []).map((s) => ({
    slug: s.org_slug,
    name: s.org_name,
    area_id: s.area_id,
    area_name: s.area_id ? areaNameById.get(s.area_id) ?? null : null,
    description: s.description,
    homepage_url: s.homepage_url,
    logo_url: s.logo_url,
    logo_bg: s.logo_bg ?? "paper",
  }));

  // Area filter — by name (URL-friendly) for shareability. Falls through
  // gracefully on bad input rather than 404'ing.
  if (areaFilter) {
    const wantId = areaIdByName.get(areaFilter);
    if (wantId) rows = rows.filter((r) => r.area_id === wantId);
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
  };
};
