// /admin/banner: edit the announcement banner. Multiple rows allowed so
// admin can stage future banners; only the enabled+in-window row renders
// publicly.
//
// Each banner row can also include callboard posts as additional rotating
// items - either an explicit checkbox-picked list, or "cycle through all
// open callboard posts" via the include_all_callboard flag.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const [bannersRes, postsRes] = await Promise.all([
    supabaseAdmin
      .from("announcement_banner")
      .select(
        `id, body_markdown, enabled, starts_at, ends_at,
         include_all_callboard, include_callboard_post_ids, updated_at`,
      )
      .order("updated_at", { ascending: false }),
    // Approved + published callboard posts the admin can pick from.
    supabaseAdmin
      .from("callboard_posts")
      .select("id, title, organization_name, post_type, deadline_text, expires_at")
      .eq("status", "approved")
      .eq("published", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (bannersRes.error) throw bannersRes.error;
  if (postsRes.error) throw postsRes.error;

  return {
    banners: bannersRes.data ?? [],
    callboardPosts: postsRes.data ?? [],
  };
};

function toIsoOrNull(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export const actions: Actions = {
  upsert: async ({ request }) => {
    const data = await request.formData();
    const id = ((data.get("id") as string) ?? "").trim();
    const body = ((data.get("body") as string) ?? "").trim();
    const enabled = data.get("enabled") === "on";
    const startsAt = toIsoOrNull(((data.get("starts_at") as string) ?? "").trim() || null);
    const endsAt = toIsoOrNull(((data.get("ends_at") as string) ?? "").trim() || null);
    const includeAllCallboard = data.get("include_all_callboard") === "on";
    // Picked posts come through as repeated post_id form fields. Filter to
    // looks-like-uuid so a user can't smuggle bogus values in.
    const pickedIds = data
      .getAll("post_id")
      .map(String)
      .filter((s) => /^[0-9a-f-]{36}$/i.test(s));

    if (!body) return fail(400, { error: "Banner text is required." });

    const payload = {
      body_markdown: body,
      enabled,
      starts_at: startsAt,
      ends_at: endsAt,
      include_all_callboard: includeAllCallboard,
      // If "cycle all" is on, the explicit picks are ignored - clear them
      // so the row's state stays internally consistent.
      include_callboard_post_ids: includeAllCallboard ? [] : pickedIds,
    };

    if (id) {
      const { error } = await supabaseAdmin
        .from("announcement_banner")
        .update(payload)
        .eq("id", id);
      if (error) return fail(500, { error: "Could not save." });
      return { saved: id };
    }

    const { error } = await supabaseAdmin
      .from("announcement_banner")
      .insert(payload);
    if (error) return fail(500, { error: "Could not create." });
    return { created: true };
  },
  remove: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    if (!id) return fail(400, { error: "Missing id." });
    await supabaseAdmin.from("announcement_banner").delete().eq("id", id);
    return { removed: true };
  },
};
