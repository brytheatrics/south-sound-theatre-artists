// /admin/banner: edit the announcement banner. Multiple rows allowed so
// admin can stage future banners; only the enabled+in-window row renders
// publicly.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const { data, error } = await supabaseAdmin
    .from("announcement_banner")
    .select("id, body_markdown, enabled, starts_at, ends_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return { banners: data ?? [] };
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

    if (!body) return fail(400, { error: "Banner text is required." });

    if (id) {
      const { error } = await supabaseAdmin
        .from("announcement_banner")
        .update({ body_markdown: body, enabled, starts_at: startsAt, ends_at: endsAt })
        .eq("id", id);
      if (error) return fail(500, { error: "Could not save." });
      return { saved: id };
    }

    const { error } = await supabaseAdmin.from("announcement_banner").insert({
      body_markdown: body,
      enabled,
      starts_at: startsAt,
      ends_at: endsAt,
    });
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
