// PATCH /api/edit/[token]/resumes/[id] - rename or reorder a resume
// DELETE /api/edit/[token]/resumes/[id] - delete a resume; entries are
//   not deleted but lose this id from their resume_ids array (move to
//   inbox if they had no other assignments).
//
// Both validate the magic-link token (not burned) and the resume's
// ownership before mutating. Returns the full { resumes, entries }
// snapshot.

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { validateEditToken } from "$lib/server/editToken";
import {
  loadProfileResumes,
  normalizeResumeName,
} from "$lib/server/resumes";

async function requireOwnership(
  resumeId: string,
  profileId: string,
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("resumes")
    .select("id, profile_id")
    .eq("id", resumeId)
    .maybeSingle();
  if (!data || data.profile_id !== profileId) {
    error(404, "Resume not found.");
  }
}

export const PATCH: RequestHandler = async ({ params, request }) => {
  const token = await validateEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  await requireOwnership(params.id, token.target_id);

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    sort_order?: unknown;
  };
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    update.name = normalizeResumeName(body.name);
  }
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
    update.sort_order = Math.max(0, Math.floor(body.sort_order));
  }
  if (Object.keys(update).length === 0) {
    error(400, "Nothing to update.");
  }

  const { error: updateErr } = await supabaseAdmin
    .from("resumes")
    .update(update)
    .eq("id", params.id);
  if (updateErr) error(500, "Could not update resume.");

  return json(await loadProfileResumes(token.target_id));
};

export const DELETE: RequestHandler = async ({ params }) => {
  const token = await validateEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  await requireOwnership(params.id, token.target_id);

  // Strip this resume's id from every entry's resume_ids array. Entries
  // that had only this id end up in the inbox, so the artist can
  // reassign them somewhere else if they want.
  const { data: entries } = await supabaseAdmin
    .from("resume_entries")
    .select("id, resume_ids")
    .eq("profile_id", token.target_id)
    .contains("resume_ids", [params.id]);
  if (entries) {
    for (const e of entries) {
      const next = (e.resume_ids as string[]).filter((id) => id !== params.id);
      await supabaseAdmin
        .from("resume_entries")
        .update({ resume_ids: next })
        .eq("id", e.id);
    }
  }

  const { error: deleteErr } = await supabaseAdmin
    .from("resumes")
    .delete()
    .eq("id", params.id);
  if (deleteErr) error(500, "Could not delete resume.");

  return json(await loadProfileResumes(token.target_id));
};
