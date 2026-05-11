// /admin/contact: list view of contact-form submissions. Filterable
// by status. Status counts also surface on the /admin home dashboard.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async ({ url }) => {
  const filter = url.searchParams.get("status") ?? "all";

  let query = supabaseAdmin
    .from("contact_submissions")
    .select("id, category_slug, name, email, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter === "new" || filter === "in_progress" || filter === "resolved" || filter === "spam") {
    query = query.eq("status", filter);
  }
  const { data: subs, error } = await query;
  if (error) throw error;

  const { data: cats } = await supabaseAdmin
    .from("contact_categories")
    .select("slug, label");
  const labelBySlug = new Map((cats ?? []).map((c) => [c.slug, c.label]));

  // Counts per status for the filter pills.
  const { data: countsRaw } = await supabaseAdmin
    .from("contact_submissions")
    .select("status");
  const counts: Record<string, number> = { all: 0, new: 0, in_progress: 0, resolved: 0, spam: 0 };
  for (const r of countsRaw ?? []) {
    counts.all += 1;
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }

  return {
    rows: (subs ?? []).map((s) => ({
      ...s,
      category_label: labelBySlug.get(s.category_slug) ?? s.category_slug,
    })),
    filter,
    counts,
  };
};
