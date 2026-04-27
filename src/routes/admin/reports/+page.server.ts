// /admin/reports: queue of open reports with resolve / dismiss actions.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async ({ url }) => {
  const status = (url.searchParams.get("status") ?? "open") as "open" | "resolved" | "dismissed";

  const { data: reports, error } = await supabaseAdmin
    .from("reports")
    .select("id, target_type, target_id, reporter_email, reason, status, admin_notes, created_at, resolved_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  // Hydrate target slugs / names
  const profileIds = (reports ?? [])
    .filter((r) => r.target_type === "profile")
    .map((r) => r.target_id);
  const targets = new Map<string, { slug: string; full_name: string }>();
  if (profileIds.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, slug, full_name")
      .in("id", profileIds);
    for (const p of profs ?? []) {
      targets.set(p.id, { slug: p.slug, full_name: p.full_name });
    }
  }

  const counts = await Promise.all(
    (["open", "resolved", "dismissed"] as const).map((s) =>
      supabaseAdmin
        .from("reports")
        .select("*", { count: "exact", head: true })
        .eq("status", s),
    ),
  );

  return {
    status,
    reports: (reports ?? []).map((r) => ({
      ...r,
      target: targets.get(r.target_id) ?? null,
    })),
    counts: {
      open: counts[0].count ?? 0,
      resolved: counts[1].count ?? 0,
      dismissed: counts[2].count ?? 0,
    },
  };
};

export const actions: Actions = {
  resolve: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    const note = ((data.get("note") as string) ?? "").trim();
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const update: Record<string, unknown> = {
      status: "resolved",
      resolved_at: new Date().toISOString(),
    };
    // Only overwrite admin_notes if a note was typed - otherwise keep
    // whatever was there.
    if (note) update.admin_notes = note;
    await supabaseAdmin.from("reports").update(update).in("id", ids);
    return { resolved: ids.length };
  },
  dismiss: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    const note = ((data.get("note") as string) ?? "").trim();
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const update: Record<string, unknown> = {
      status: "dismissed",
      resolved_at: new Date().toISOString(),
    };
    if (note) update.admin_notes = note;
    await supabaseAdmin.from("reports").update(update).in("id", ids);
    return { dismissed: ids.length };
  },
  updateNote: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    const note = ((data.get("note") as string) ?? "").trim();
    if (!id) return fail(400, { error: "Missing id." });
    const { error } = await supabaseAdmin
      .from("reports")
      .update({ admin_notes: note || null })
      .eq("id", id);
    if (error) return fail(500, { error: "Could not save note." });
    return { noteSaved: id };
  },
};
