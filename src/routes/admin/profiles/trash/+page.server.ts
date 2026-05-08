// /admin/profiles/trash: 30-day recovery view of soft-deleted profiles.
// Restore puts them back live (still unpublished). Permanent delete is
// final.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, slug, full_name, email, deleted_at, archived_stale")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return { trashed: data ?? [] };
};

export const actions: Actions = {
  restore: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deleted_at: null })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not restore." });
    return { restored: ids.length };
  },

  hardDelete: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin.from("profiles").delete().in("id", ids);
    if (error) return fail(500, { error: "Could not delete permanently." });
    return { hardDeleted: ids.length };
  },
};
