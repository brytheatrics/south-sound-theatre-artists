// /admin/calendar/[id]/edit: full editor for a single production. Lets
// admin tweak metadata (title / org / run dates / category / area /
// detail URL / description) and manage individual performances (add /
// edit / remove / mark cancelled).
//
// Performance times are entered as Pacific wall-clock and stored as
// timestamptz (UTC). Same DST-aware offset logic the cron uses.

import { fail, error, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

// ---- Pacific time conversion (mirrors scripts/_lib/calendar-sync.mjs)
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
  // wallClock format: "YYYY-MM-DDTHH:MM"
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wallClock)) return null;
  const [date] = wallClock.split("T");
  const offset = pacificOffsetForDate(date);
  return new Date(`${wallClock}:00${offset}`).toISOString();
}

function utcToPacificWall(utcIso: string): string {
  // Render UTC timestamp as Pacific local "YYYY-MM-DDTHH:MM" for
  // datetime-local inputs.
  const d = new Date(utcIso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // Note: hour can come back as "24" at midnight; normalise.
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

export const load: PageServerLoad = async ({ params }) => {
  const { data: prod, error: prodErr } = await supabaseAdmin
    .from("productions")
    .select(
      `id, title, organization_name, run_start, run_end, detail_url,
       description, category_id, area_id, source_id, status,
       rejection_reason, deleted_at, created_at, updated_at`,
    )
    .eq("id", params.id)
    .maybeSingle();

  if (prodErr || !prod) throw error(404, "Production not found");

  const { data: perfs } = await supabaseAdmin
    .from("performances")
    .select("id, performs_at, note, cancelled")
    .eq("production_id", params.id)
    .order("performs_at");

  const { data: cats } = await supabaseAdmin
    .from("event_categories")
    .select("id, name, slug, sort_order")
    .order("sort_order");
  const { data: areas } = await supabaseAdmin
    .from("areas")
    .select("id, name, sort_order")
    .order("sort_order");

  // Source info if auto-pop'd
  let sourceInfo = null;
  if (prod.source_id) {
    const { data: src } = await supabaseAdmin
      .from("event_sources")
      .select("org_slug, org_name, source_url, last_checked_at")
      .eq("id", prod.source_id)
      .maybeSingle();
    sourceInfo = src;
  }

  return {
    production: prod,
    performances: (perfs ?? []).map((p) => ({
      id: p.id,
      wallClock: utcToPacificWall(p.performs_at),
      note: p.note ?? "",
      cancelled: p.cancelled,
    })),
    categories: cats ?? [],
    areas: areas ?? [],
    sourceInfo,
  };
};

export const actions: Actions = {
  save: async ({ request, params }) => {
    const fd = await request.formData();
    const title = String(fd.get("title") ?? "").trim().toUpperCase();
    const organization_name = String(fd.get("organization_name") ?? "").trim();
    const run_start = String(fd.get("run_start") ?? "").trim() || null;
    const run_end = String(fd.get("run_end") ?? "").trim() || null;
    const detail_url = String(fd.get("detail_url") ?? "").trim() || null;
    const description = String(fd.get("description") ?? "").trim() || null;
    const category_id = String(fd.get("category_id") ?? "").trim() || null;
    const area_id = String(fd.get("area_id") ?? "").trim() || null;
    const status = String(fd.get("status") ?? "").trim();

    if (!title) return fail(400, { error: "Title is required." });
    if (!organization_name) return fail(400, { error: "Organization is required." });
    if (!["pending_review", "approved", "rejected"].includes(status)) {
      return fail(400, { error: "Invalid status." });
    }

    const { error: updErr } = await supabaseAdmin
      .from("productions")
      .update({
        title,
        organization_name,
        run_start,
        run_end,
        detail_url,
        description,
        category_id,
        area_id,
        status,
      })
      .eq("id", params.id);

    if (updErr) return fail(500, { error: updErr.message });

    // Performances: parse the JSON-encoded array from the form. Atomic
    // replace - delete all then insert. Performances cascade-delete with
    // their parent so this is safe.
    const perfJson = String(fd.get("performances_json") ?? "[]");
    let perfs: Array<{ wallClock: string; note: string; cancelled: boolean }>;
    try {
      perfs = JSON.parse(perfJson);
      if (!Array.isArray(perfs)) throw new Error("not an array");
    } catch {
      return fail(400, { error: "Invalid performances data." });
    }

    await supabaseAdmin.from("performances").delete().eq("production_id", params.id);

    const rowsToInsert = [];
    for (const p of perfs) {
      const utcIso = pacificWallToUtc(p.wallClock);
      if (!utcIso) continue; // skip blank or malformed
      rowsToInsert.push({
        production_id: params.id,
        performs_at: utcIso,
        note: p.note?.trim() || null,
        cancelled: !!p.cancelled,
      });
    }
    if (rowsToInsert.length > 0) {
      const { error: insErr } = await supabaseAdmin.from("performances").insert(rowsToInsert);
      if (insErr) return fail(500, { error: insErr.message });
    }

    return { saved: true, performanceCount: rowsToInsert.length };
  },

  softDelete: async ({ params }) => {
    await supabaseAdmin
      .from("productions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id);
    throw redirect(303, "/admin/calendar?deleted=1");
  },
};
