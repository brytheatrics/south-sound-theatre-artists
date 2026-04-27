// /admin/content: edit site_content rows (markdown bodies + titles).

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const { data, error } = await supabaseAdmin
    .from("site_content")
    .select("slug, title, body_markdown, updated_at")
    .order("slug");
  if (error) throw error;
  return { rows: data ?? [] };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const data = await request.formData();
    const slug = (data.get("slug") as string) ?? "";
    const title = ((data.get("title") as string) ?? "").trim() || null;
    const body = ((data.get("body") as string) ?? "");
    if (!slug) return fail(400, { error: "Missing slug." });
    const { error } = await supabaseAdmin
      .from("site_content")
      .update({ title, body_markdown: body })
      .eq("slug", slug);
    if (error) return fail(500, { error: "Could not save." });
    return { saved: slug };
  },
};
