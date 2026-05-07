// PATCH/DELETE /api/admin/profiles/[id]/resumes/[rid] - admin-side
// mirror of the artist-side resume endpoint. Auth via admin session.

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import {
  loadProfileResumes,
  normalizeResumeName,
  syncLegacyResumeData,
} from "$lib/server/resumes";

async function requireOwnership(rid: string, profileId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("resumes")
    .select("profile_id")
    .eq("id", rid)
    .maybeSingle();
  if (!data || data.profile_id !== profileId) error(404, "Resume not found.");
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  await requireOwnership(params.rid, params.id);
  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    sort_order?: unknown;
  };
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = normalizeResumeName(body.name);
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
    update.sort_order = Math.max(0, Math.floor(body.sort_order));
  }
  if (Object.keys(update).length === 0) error(400, "Nothing to update.");
  const { error: updErr } = await supabaseAdmin
    .from("resumes")
    .update(update)
    .eq("id", params.rid);
  if (updErr) error(500, "Could not update resume.");
  await syncLegacyResumeData(params.id);
  return json(await loadProfileResumes(params.id));
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  await requireOwnership(params.rid, params.id);
  const { data: entries } = await supabaseAdmin
    .from("resume_entries")
    .select("id, resume_ids")
    .eq("profile_id", params.id)
    .contains("resume_ids", [params.rid]);
  if (entries) {
    for (const e of entries) {
      const next = (e.resume_ids as string[]).filter((id) => id !== params.rid);
      await supabaseAdmin
        .from("resume_entries")
        .update({ resume_ids: next })
        .eq("id", e.id);
    }
  }
  const { error: delErr } = await supabaseAdmin
    .from("resumes")
    .delete()
    .eq("id", params.rid);
  if (delErr) error(500, "Could not delete resume.");
  await syncLegacyResumeData(params.id);
  return json(await loadProfileResumes(params.id));
};
