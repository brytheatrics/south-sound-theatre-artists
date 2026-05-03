// /admin/templates: edit email_templates (subject + markdown body).

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select("slug, subject, body_markdown, description, audience, updated_at")
    .order("slug");
  if (error) throw error;
  return { rows: data ?? [] };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const data = await request.formData();
    const slug = (data.get("slug") as string) ?? "";
    const subject = ((data.get("subject") as string) ?? "").trim();
    const body = ((data.get("body") as string) ?? "");
    if (!slug) return fail(400, { error: "Missing slug." });
    if (!subject) return fail(400, { error: "Subject is required." });
    const { error } = await supabaseAdmin
      .from("email_templates")
      .update({ subject, body_markdown: body })
      .eq("slug", slug);
    if (error) return fail(500, { error: "Could not save." });
    return { saved: slug };
  },
};
