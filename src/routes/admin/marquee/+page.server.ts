// /admin/marquee: controls the scrolling ticker at the bottom of the
// homepage hero. Single-row settings table - admin can either cycle
// through every approved + published callboard post, or hand-pick a
// subset via checkboxes.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const [settingsRes, postsRes] = await Promise.all([
    supabaseAdmin
      .from("marquee_settings")
      .select("enabled, include_all_callboard, include_callboard_post_ids")
      .eq("id", 1)
      .maybeSingle(),
    supabaseAdmin
      .from("callboard_posts")
      .select("id, title, organization_name, post_type, deadline_text, expires_at")
      .eq("status", "approved")
      .eq("published", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (postsRes.error) throw postsRes.error;

  return {
    settings: settingsRes.data ?? {
      enabled: true,
      include_all_callboard: true,
      include_callboard_post_ids: [],
    },
    callboardPosts: postsRes.data ?? [],
  };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const data = await request.formData();
    const enabled = data.get("enabled") === "on";
    const cycleAll = data.get("include_all_callboard") === "on";
    const pickedIds = data
      .getAll("post_id")
      .map(String)
      .filter((s) => /^[0-9a-f-]{36}$/i.test(s));

    const { error } = await supabaseAdmin
      .from("marquee_settings")
      .update({
        enabled,
        include_all_callboard: cycleAll,
        // Cycle-all takes precedence; clear picks so state stays consistent.
        include_callboard_post_ids: cycleAll ? [] : pickedIds,
      })
      .eq("id", 1);
    if (error) return fail(500, { error: "Could not save." });
    return { saved: true };
  },
};
