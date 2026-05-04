// /admin/calendar/new: create a manual production with its performances
// in one shot. Mirrors the schedule-pattern-editor + per-row editor
// from /admin/calendar/[id]/edit so admin gets a single-page workflow
// instead of create-then-edit-twice.
//
// Manual entries set organization_id = null (so they're immune to cron),
// status = 'approved', and admin_edited_at = now() (defensive in case
// we ever add cron coverage for this org's source later).

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

// Pacific-time conversion (mirrors admin/calendar/[id]/edit + cron lib)
function pacificOffsetForDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (m > 3 && m < 11) return "-07:00";
  if (m < 3 || m > 11) return "-08:00";
  const firstOfMonth = new Date(`${y}-${String(m).padStart(2, "0")}-01T12:00:00Z`);
  const dowFirst = firstOfMonth.getUTCDay();
  if (m === 3) {
    const firstSunday = 1 + ((7 - dowFirst) % 7);
    const secondSunday = firstSunday + 7;
    return d >= secondSunday ? "-07:00" : "-08:00";
  }
  const firstSunday = 1 + ((7 - dowFirst) % 7);
  return d >= firstSunday ? "-08:00" : "-07:00";
}
function pacificWallToUtc(wallClock: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wallClock)) return null;
  const [date] = wallClock.split("T");
  return new Date(`${wallClock}:00${pacificOffsetForDate(date)}`).toISOString();
}

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

    if (!title)
      return fail(400, { error: "Title is required.", values: Object.fromEntries(fd) });
    if (!organization_name)
      return fail(400, { error: "Organization is required.", values: Object.fromEntries(fd) });

    const { data: prod, error } = await supabaseAdmin
      .from("productions")
      .insert({
        title,
        organization_name,
        run_start,
        run_end,
        detail_url,
        category_id,
        area_id,
        organization_id: null,
        status: "approved",
        admin_edited_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !prod) {
      return fail(500, { error: error?.message ?? "Could not save.", values: Object.fromEntries(fd) });
    }

    // Performances: parse JSON, convert each Pacific wall-clock to UTC
    // timestamptz, insert. Same shape as the edit page's save action.
    const perfJson = String(fd.get("performances_json") ?? "[]");
    let perfs: Array<{ wallClock: string; note: string; cancelled: boolean }>;
    try {
      const parsed = JSON.parse(perfJson);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      perfs = parsed;
    } catch {
      // Don't fail the whole create on bad JSON - the production saved;
      // admin can add performances on the edit page.
      throw redirect(303, `/admin/calendar/${prod.id}/edit?created=1`);
    }

    const rowsToInsert = [];
    for (const p of perfs) {
      const utcIso = pacificWallToUtc(p.wallClock);
      if (!utcIso) continue;
      rowsToInsert.push({
        production_id: prod.id,
        performs_at: utcIso,
        note: (p.note ?? "").trim() || null,
        cancelled: !!p.cancelled,
      });
    }
    if (rowsToInsert.length > 0) {
      await supabaseAdmin.from("performances").insert(rowsToInsert);
    }

    throw redirect(303, `/admin/calendar/${prod.id}/edit?created=1`);
  },
};
