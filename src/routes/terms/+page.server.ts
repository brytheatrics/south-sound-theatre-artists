import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const { data, error: err } = await supabaseAdmin
    .from("site_content")
    .select("title, body_markdown")
    .eq("slug", "terms")
    .maybeSingle();
  if (err || !data) error(500, "Could not load page content.");
  return { content: data };
};
