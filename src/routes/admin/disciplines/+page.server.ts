// /admin/disciplines: add / remove / reorder canonical disciplines.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const [discRes, catsRes] = await Promise.all([
    supabaseAdmin
      .from("disciplines")
      .select("id, name, category, sort_order")
      .order("category")
      .order("sort_order"),
    supabaseAdmin
      .from("discipline_categories")
      .select("name, sort_order")
      .order("sort_order"),
  ]);
  if (discRes.error) throw discRes.error;
  if (catsRes.error) throw catsRes.error;
  return {
    disciplines: discRes.data ?? [],
    categories: catsRes.data ?? [],
  };
};

export const actions: Actions = {
  add: async ({ request }) => {
    const data = await request.formData();
    const name = ((data.get("name") as string) ?? "").trim();
    const category = ((data.get("category") as string) ?? "").trim();
    const sortStr = ((data.get("sort_order") as string) ?? "").trim();
    const sort_order = sortStr ? Number(sortStr) : 0;
    if (!name) return fail(400, { error: "Name required." });
    if (!category) return fail(400, { error: "Category required." });
    const { error } = await supabaseAdmin
      .from("disciplines")
      .insert({ name, category, sort_order });
    if (error) {
      if (error.code === "23505") return fail(400, { error: "Already exists." });
      return fail(500, { error: "Could not add." });
    }
    return { added: name };
  },
  remove: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    if (!id) return fail(400, { error: "Missing id." });
    await supabaseAdmin.from("disciplines").delete().eq("id", id);
    return { removed: true };
  },
  reorder: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    const sortStr = ((data.get("sort_order") as string) ?? "").trim();
    const sort_order = sortStr ? Number(sortStr) : 0;
    if (!id) return fail(400, { error: "Missing id." });
    const { error } = await supabaseAdmin
      .from("disciplines")
      .update({ sort_order })
      .eq("id", id);
    if (error) return fail(500, { error: "Could not reorder." });
    return { reordered: true };
  },
};
