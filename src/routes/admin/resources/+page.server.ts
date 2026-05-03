// /admin/resources: CRUD for the resource library + categories.
// Same shape as other admin editor pages: list of cards, each card is
// a small form, plus an "add new" card at the top for both resources
// and categories.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const [catsRes, resourcesRes] = await Promise.all([
    supabaseAdmin
      .from("resource_categories")
      .select("id, name, description, sort_order")
      .order("sort_order"),
    supabaseAdmin
      .from("resources")
      .select(
        "id, title, url, description, category_ids, sort_order, published, deleted_at",
      )
      .is("deleted_at", null)
      .order("sort_order"),
  ]);
  if (catsRes.error) throw catsRes.error;
  if (resourcesRes.error) throw resourcesRes.error;
  return {
    categories: catsRes.data ?? [],
    resources: resourcesRes.data ?? [],
  };
};

function clean(v: FormDataEntryValue | null): string {
  return ((v as string) ?? "").trim();
}
function intOrDefault(v: FormDataEntryValue | null, fallback: number): number {
  const s = clean(v);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export const actions: Actions = {
  upsertCategory: async ({ request }) => {
    const data = await request.formData();
    const id = clean(data.get("id"));
    const name = clean(data.get("name"));
    const description = clean(data.get("description")) || null;
    const sort = intOrDefault(data.get("sort_order"), 100);
    if (!name) return fail(400, { error: "Name is required." });

    if (id) {
      const { error } = await supabaseAdmin
        .from("resource_categories")
        .update({ name, description, sort_order: sort })
        .eq("id", id);
      if (error) return fail(500, { error: "Could not save category." });
      return { savedCategory: id };
    }
    const { error } = await supabaseAdmin
      .from("resource_categories")
      .insert({ name, description, sort_order: sort });
    if (error) return fail(500, { error: "Could not create category." });
    return { createdCategory: true };
  },

  removeCategory: async ({ request }) => {
    const data = await request.formData();
    const id = clean(data.get("id"));
    if (!id) return fail(400, { error: "Missing id." });
    // Resources in this category get category_id set to null via the
    // ON DELETE SET NULL constraint; they survive as "Other".
    const { error } = await supabaseAdmin
      .from("resource_categories")
      .delete()
      .eq("id", id);
    if (error) return fail(500, { error: "Could not delete category." });
    return { removedCategory: true };
  },

  upsertResource: async ({ request }) => {
    const data = await request.formData();
    const id = clean(data.get("id"));
    const title = clean(data.get("title"));
    const url = clean(data.get("url"));
    const description = clean(data.get("description")) || null;
    // Multi-select: each picked category posts a separate `category_id`
    // field (the form renders one checkbox per category, all sharing
    // that field name). Empty selection = empty array = "Other" bucket
    // on the public page.
    const categoryIds = data
      .getAll("category_id")
      .map((v) => String(v).trim())
      .filter((v) => /^[0-9a-f-]{36}$/i.test(v));
    const sort = intOrDefault(data.get("sort_order"), 100);
    const published = data.get("published") === "on";

    if (!title) return fail(400, { error: "Title is required." });
    if (!url || !/^https?:\/\//i.test(url)) {
      return fail(400, { error: "URL must start with http:// or https://" });
    }

    const payload = {
      title,
      url,
      description,
      category_ids: categoryIds,
      sort_order: sort,
      published,
    };

    if (id) {
      const { error } = await supabaseAdmin
        .from("resources")
        .update(payload)
        .eq("id", id);
      if (error) return fail(500, { error: "Could not save resource." });
      return { savedResource: id };
    }
    const { error } = await supabaseAdmin.from("resources").insert(payload);
    if (error) return fail(500, { error: "Could not create resource." });
    return { createdResource: true };
  },

  removeResource: async ({ request }) => {
    const data = await request.formData();
    const id = clean(data.get("id"));
    if (!id) return fail(400, { error: "Missing id." });
    // Soft-delete; same 30-day trash retention as other admin actions.
    const { error } = await supabaseAdmin
      .from("resources")
      .update({ deleted_at: new Date().toISOString(), published: false })
      .eq("id", id);
    if (error) return fail(500, { error: "Could not delete resource." });
    return { removedResource: true };
  },
};
