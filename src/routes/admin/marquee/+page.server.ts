// /admin/marquee: controls the scrolling ticker at the bottom of the
// homepage hero. Single-row settings table - admin can either cycle
// through every approved + published callboard post, or hand-pick a
// subset via checkboxes.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const [settingsRes, postsRes, typesRes, productionsRes] = await Promise.all([
    supabaseAdmin
      .from("marquee_settings")
      .select(
        `enabled, include_all_callboard, include_callboard_post_ids,
         include_all_calendar, include_calendar_production_ids`,
      )
      .eq("id", 1)
      .maybeSingle(),
    supabaseAdmin
      .from("callboard_posts")
      .select("id, title, organization_name, post_type, deadline_text, expires_at")
      .eq("status", "approved")
      .eq("published", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("callboard_post_types").select("slug, label"),
    // Only "still upcoming or open" productions are valid marquee picks.
    supabaseAdmin
      .from("productions")
      .select("id, title, organization_name, run_start, run_end")
      .eq("status", "approved")
      .is("deleted_at", null)
      .or(`run_end.is.null,run_end.gte.${today}`)
      .order("run_start", { ascending: true, nullsFirst: false }),
  ]);
  if (postsRes.error) throw postsRes.error;
  if (productionsRes.error) throw productionsRes.error;

  return {
    settings: settingsRes.data ?? {
      enabled: true,
      include_all_callboard: true,
      include_callboard_post_ids: [],
      include_all_calendar: true,
      include_calendar_production_ids: [],
    },
    callboardPosts: postsRes.data ?? [],
    postTypes: typesRes.data ?? [],
    productions: productionsRes.data ?? [],
  };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const data = await request.formData();
    const enabled = data.get("enabled") === "on";
    const cycleAllCallboard = data.get("include_all_callboard") === "on";
    const cycleAllCalendar = data.get("include_all_calendar") === "on";
    const pickedPostIds = data
      .getAll("post_id")
      .map(String)
      .filter((s) => /^[0-9a-f-]{36}$/i.test(s));
    const pickedProductionIds = data
      .getAll("production_id")
      .map(String)
      .filter((s) => /^[0-9a-f-]{36}$/i.test(s));

    const { error } = await supabaseAdmin
      .from("marquee_settings")
      .update({
        enabled,
        include_all_callboard: cycleAllCallboard,
        // Cycle-all takes precedence; clear picks so state stays consistent.
        include_callboard_post_ids: cycleAllCallboard ? [] : pickedPostIds,
        include_all_calendar: cycleAllCalendar,
        include_calendar_production_ids: cycleAllCalendar ? [] : pickedProductionIds,
      })
      .eq("id", 1);
    if (error) return fail(500, { error: "Could not save." });
    return { saved: true };
  },
};
