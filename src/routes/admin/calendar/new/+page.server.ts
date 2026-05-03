// /admin/calendar/new: create a manual production. After save, redirects
// to the edit page where the admin can add per-date performances.
//
// Manual entries set source_id = null (so they're immune to cron) and
// status = 'approved' (Lexi is creating it; no review needed).

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const { data: cats } = await supabaseAdmin
    .from("event_categories")
    .select("id, name, slug, sort_order")
    .order("sort_order");
  const { data: areas } = await supabaseAdmin
    .from("areas")
    .select("id, name, sort_order")
    .order("sort_order");
  return {
    categories: cats ?? [],
    areas: areas ?? [],
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const fd = await request.formData();
    const title = String(fd.get("title") ?? "").trim().toUpperCase();
    const organization_name = String(fd.get("organization_name") ?? "").trim();
    const run_start = String(fd.get("run_start") ?? "").trim() || null;
    const run_end = String(fd.get("run_end") ?? "").trim() || null;
    const detail_url = String(fd.get("detail_url") ?? "").trim() || null;
    const category_id = String(fd.get("category_id") ?? "").trim() || null;
    const area_id = String(fd.get("area_id") ?? "").trim() || null;

    if (!title) return fail(400, { error: "Title is required.", values: Object.fromEntries(fd) });
    if (!organization_name) return fail(400, { error: "Organization is required.", values: Object.fromEntries(fd) });

    const { data, error } = await supabaseAdmin
      .from("productions")
      .insert({
        title,
        organization_name,
        run_start,
        run_end,
        detail_url,
        category_id,
        area_id,
        source_id: null,
        status: "approved",
      })
      .select("id")
      .single();

    if (error) return fail(500, { error: error.message, values: Object.fromEntries(fd) });

    throw redirect(303, `/admin/calendar/${data.id}/edit?created=1`);
  },
};
