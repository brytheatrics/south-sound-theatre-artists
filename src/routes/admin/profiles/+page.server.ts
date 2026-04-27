// /admin/profiles: searchable list of live profiles with publish toggle
// + soft-delete actions. Soft-deleted rows live in /admin/profiles/trash
// for 30 days before a daily cron hard-deletes them.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").trim();
  let query = supabaseAdmin
    .from("profiles")
    .select(
      "id, slug, full_name, email, geographic_area, disciplines, published, created_at, updated_at",
      { count: "exact" },
    )
    .is("deleted_at", null);
  if (q) query = query.or(`full_name.ilike.%${q}%,slug.ilike.%${q}%,email.ilike.%${q}%`);
  query = query.order("updated_at", { ascending: false }).limit(PAGE_SIZE);
  const { data, count, error } = await query;
  if (error) throw error;

  const { count: trashCount } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .not("deleted_at", "is", null);

  return {
    profiles: data ?? [],
    total: count ?? 0,
    trashCount: trashCount ?? 0,
    q,
  };
};

export const actions: Actions = {
  togglePublish: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    const publish = data.get("publish") === "true";
    if (!id) return fail(400, { error: "Missing id." });
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ published: publish })
      .eq("id", id);
    if (error) return fail(500, { error: "Could not update visibility." });
    return { ok: true };
  },

  softDelete: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deleted_at: new Date().toISOString(), published: false })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not delete." });
    return { deleted: ids.length };
  },
};
