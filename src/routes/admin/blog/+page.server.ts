// /admin/blog: list view of all blog posts (published + drafts).
// Sub-routes /admin/blog/new and /admin/blog/[id]/edit handle CRUD.

import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  const { data } = await supabaseAdmin
    .from("blog_posts")
    .select("id, slug, title, published, published_at, updated_at, deleted_at")
    .order("updated_at", { ascending: false });
  return {
    posts: (data ?? []).filter((p) => !p.deleted_at),
    trash: (data ?? []).filter((p) => p.deleted_at),
  };
};

export const actions: Actions = {
  softDelete: async ({ request, locals }) => {
    if (!locals.admin) error(401, "Admin only.");
    const fd = await request.formData();
    const id = String(fd.get("id") ?? "");
    if (!id) return fail(400, { error: "Missing id." });
    await supabaseAdmin
      .from("blog_posts")
      .update({ deleted_at: new Date().toISOString(), published: false })
      .eq("id", id);
    return { deleted: 1 };
  },
  restore: async ({ request, locals }) => {
    if (!locals.admin) error(401, "Admin only.");
    const fd = await request.formData();
    const id = String(fd.get("id") ?? "");
    if (!id) return fail(400, { error: "Missing id." });
    await supabaseAdmin
      .from("blog_posts")
      .update({ deleted_at: null })
      .eq("id", id);
    return { restored: 1 };
  },
};
