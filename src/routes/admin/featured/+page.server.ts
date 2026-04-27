// /admin/featured: curate the homepage spotlight rotation. When this list
// is non-empty, the homepage rotates through it; otherwise it falls back
// to a date-seeded shuffle of all published profiles.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const { data: featured } = await supabaseAdmin
    .from("featured_profiles")
    .select("id, profile_id, active, sort_order, created_at, profiles(slug, full_name, disciplines, geographic_area)")
    .order("sort_order");

  const { data: candidates } = await supabaseAdmin
    .from("profiles")
    .select("id, slug, full_name, disciplines, geographic_area")
    .eq("published", true)
    .is("deleted_at", null)
    .order("full_name");

  return {
    featured: featured ?? [],
    candidates: candidates ?? [],
  };
};

export const actions: Actions = {
  add: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("profile_id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Pick at least one." });
    const rows = ids.map((id, i) => ({
      profile_id: id,
      active: true,
      sort_order: (i + 1) * 10,
    }));
    const { error } = await supabaseAdmin.from("featured_profiles").insert(rows);
    if (error && error.code !== "23505") return fail(500, { error: "Could not add." });
    return { added: ids.length };
  },
  remove: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    if (!id) return fail(400, { error: "Missing id." });
    await supabaseAdmin.from("featured_profiles").delete().eq("id", id);
    return { removed: true };
  },
  toggle: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    const active = data.get("active") === "true";
    if (!id) return fail(400, { error: "Missing id." });
    await supabaseAdmin.from("featured_profiles").update({ active }).eq("id", id);
    return { toggled: true };
  },
};
