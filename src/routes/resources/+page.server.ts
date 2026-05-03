// /resources: public-readable curated link library, grouped by
// category. Admin manages from /admin/resources.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export type Resource = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category_ids: string[];
};

export const load: PageServerLoad = async () => {
  const [catsRes, resourcesRes, contentRes] = await Promise.all([
    supabaseAdmin
      .from("resource_categories")
      .select("id, name, description, sort_order")
      .order("sort_order"),
    supabaseAdmin
      .from("resources")
      .select("id, title, url, description, category_ids, sort_order")
      .eq("published", true)
      .is("deleted_at", null)
      .order("sort_order"),
    supabaseAdmin
      .from("site_content")
      .select("body_markdown")
      .eq("slug", "resources")
      .maybeSingle(),
  ]);

  const categories = catsRes.data ?? [];
  const resources = (resourcesRes.data ?? []) as Resource[];

  // Group resources under their category in display order. A resource
  // tagged with multiple categories appears under each one (intentional:
  // a grant database that's useful for both producers and artists is
  // worth surfacing on both lines, not duplicated as separate rows).
  // Resources with no categories fall under an "Other" bucket last.
  const grouped = categories.map((c) => ({
    ...c,
    resources: resources.filter(
      (r) => Array.isArray(r.category_ids) && r.category_ids.includes(c.id),
    ),
  }));
  const orphans = resources.filter(
    (r) => !Array.isArray(r.category_ids) || r.category_ids.length === 0,
  );
  if (orphans.length > 0) {
    grouped.push({
      id: "_orphans",
      name: "Other",
      description: null,
      sort_order: 999,
      resources: orphans,
    });
  }

  return {
    groups: grouped.filter((g) => g.resources.length > 0),
    lede: contentRes.data?.body_markdown ?? "",
  };
};
