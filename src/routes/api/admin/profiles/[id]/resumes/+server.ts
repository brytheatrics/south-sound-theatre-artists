// POST /api/admin/profiles/[id]/resumes - admin-side mirror of the
// artist-side endpoint. Used by MultiResumeBuilder when an admin is
// editing a profile from /admin/profiles/[id]/edit. Auth via the
// admin session cookie.

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import {
  loadProfileResumes,
  normalizeResumeName,
} from "$lib/server/resumes";

const MAX_RESUMES = 8;

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = normalizeResumeName(body.name);
  const { data: existing } = await supabaseAdmin
    .from("resumes")
    .select("id, sort_order")
    .eq("profile_id", params.id)
    .order("sort_order", { ascending: false });
  if ((existing ?? []).length >= MAX_RESUMES) {
    error(400, `Limit is ${MAX_RESUMES} resumes per profile.`);
  }
  const nextOrder = (existing && existing[0] ? existing[0].sort_order : -1) + 1;
  const { error: insertErr } = await supabaseAdmin
    .from("resumes")
    .insert({ profile_id: params.id, name, sort_order: nextOrder });
  if (insertErr) error(500, "Could not create resume.");
  return json(await loadProfileResumes(params.id));
};
