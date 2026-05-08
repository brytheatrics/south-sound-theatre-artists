// /resources: public-readable curated link library. Flat list with
// category-chip filtering. Admin manages from /admin/resources.
//
// Filter model:
//   - No chips active = show every published resource (flat list)
//   - One or more chips active = show only resources whose category_ids
//     intersect the active set
// Each resource row shows badges for ALL its categories so the user
// can see the resource's full scope regardless of which chips they
// picked. A resource never appears more than once even if multi-tagged.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export type Resource = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category_ids: string[];
  category_names: string[];
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
};

export const load: PageServerLoad = async ({ url }) => {
  const params = url.searchParams;
  const activeCatIds = params.getAll("cat").filter(Boolean);

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

  const categories = (catsRes.data ?? []) as Category[];
  const allResources = (resourcesRes.data ?? []) as Omit<Resource, "category_names">[];
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  // Annotate every resource with the names of its categories so the
  // svelte side can render badges without a second lookup.
  const annotated: Resource[] = allResources.map((r) => ({
    ...r,
    category_names: (r.category_ids ?? [])
      .map((id) => categoryNameById.get(id))
      .filter((n): n is string => !!n),
  }));

  // Filter: if any chips are active, keep resources whose category_ids
  // intersect the active set. Otherwise show everything.
  const activeSet = new Set(activeCatIds.filter((id) => categoryNameById.has(id)));
  const filtered =
    activeSet.size === 0
      ? annotated
      : annotated.filter(
          (r) =>
            Array.isArray(r.category_ids) &&
            r.category_ids.some((id) => activeSet.has(id)),
        );

  return {
    categories,
    activeCatIds: Array.from(activeSet),
    resources: filtered,
    totalCount: annotated.length,
    lede: contentRes.data?.body_markdown ?? "",
  };
};
