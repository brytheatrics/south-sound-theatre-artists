// PATCH/DELETE /api/admin/profiles/[id]/entries/[eid] - admin-side
// mirror of the artist-side entry endpoint.

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import {
  loadProfileResumes,
  normalizeEntryData,
  syncLegacyResumeData,
  type ResumeEntryKind,
} from "$lib/server/resumes";

async function loadEntry(entryId: string, profileId: string) {
  const { data } = await supabaseAdmin
    .from("resume_entries")
    .select("id, profile_id, kind, source, production_credit_id")
    .eq("id", entryId)
    .maybeSingle();
  if (!data || data.profile_id !== profileId) error(404, "Entry not found.");
  return data;
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  const entry = await loadEntry(params.eid, params.id);

  const body = (await request.json().catch(() => ({}))) as {
    data?: unknown;
    resume_ids?: unknown;
    sort_order?: unknown;
    detach?: unknown;
  };
  const update: Record<string, unknown> = {};

  if (body.data !== undefined) {
    if (entry.source === "production") {
      error(400, "Detach this credit before editing its fields.");
    }
    update.data = normalizeEntryData(entry.kind as ResumeEntryKind, body.data);
  }
  if (Array.isArray(body.resume_ids)) {
    const requested = (body.resume_ids as unknown[]).filter(
      (x) => typeof x === "string",
    ) as string[];
    if (requested.length > 0) {
      const { data: owned } = await supabaseAdmin
        .from("resumes")
        .select("id")
        .eq("profile_id", params.id)
        .in("id", requested);
      update.resume_ids = (owned ?? []).map((r) => r.id);
    } else {
      update.resume_ids = [];
    }
  }
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
    update.sort_order = Math.max(0, Math.floor(body.sort_order));
  }
  if (body.detach === true && entry.source === "production") {
    update.source = "hand";
    update.production_credit_id = null;
  }
  if (Object.keys(update).length === 0) error(400, "Nothing to update.");

  const { error: updErr } = await supabaseAdmin
    .from("resume_entries")
    .update(update)
    .eq("id", params.eid);
  if (updErr) error(500, "Could not update entry.");

  await syncLegacyResumeData(params.id);
  return json(await loadProfileResumes(params.id));
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  await loadEntry(params.eid, params.id);
  const { error: delErr } = await supabaseAdmin
    .from("resume_entries")
    .delete()
    .eq("id", params.eid);
  if (delErr) error(500, "Could not delete entry.");
  await syncLegacyResumeData(params.id);
  return json(await loadProfileResumes(params.id));
};
