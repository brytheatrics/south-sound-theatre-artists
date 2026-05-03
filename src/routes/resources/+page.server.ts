// /resources: public-readable curated link library, grouped by
// category. Admin manages from /admin/resources.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export type Resource = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category_id: string | null;
};

export const load: PageServerLoad = async () => {
  const [catsRes, resourcesRes, contentRes] = await Promise.all([
    supabaseAdmin
      .from("resource_categories")
      .select("id, name, description, sort_order")
      .order("sort_order"),
    supabaseAdmin
      .from("resources")
      .select("id, title, url, description, category_id, sort_order")
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

  // Group resources under their category in display order. Resources
  // without a category fall under an "Other" bucket inserted last.
  const grouped = categories.map((c) => ({
    ...c,
    resources: resources.filter((r) => r.category_id === c.id),
  }));
  const orphans = resources.filter((r) => !r.category_id);
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
