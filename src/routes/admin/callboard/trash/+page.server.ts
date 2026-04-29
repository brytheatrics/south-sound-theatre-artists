// /admin/callboard/trash: 30-day recovery for soft-deleted callboard posts.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const [trashRes, typesRes] = await Promise.all([
    supabaseAdmin
      .from("callboard_posts")
      .select("id, post_type, title, organization_name, submitter_email, deleted_at, status")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabaseAdmin.from("callboard_post_types").select("slug, label"),
  ]);
  if (trashRes.error) throw trashRes.error;
  return {
    trashed: trashRes.data ?? [],
    postTypes: typesRes.data ?? [],
  };
};

export const actions: Actions = {
  restore: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("callboard_posts")
      .update({ deleted_at: null })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not restore." });
    return { restored: ids.length };
  },

  hardDelete: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("callboard_posts")
      .delete()
      .in("id", ids);
    if (error) return fail(500, { error: "Could not permanently delete." });
    return { hardDeleted: ids.length };
  },
};
