// POST /api/edit/[token]/resumes
// Create a new named resume for the artist whose magic-link token this
// is. Live API (does NOT burn the token). Body: { name }.
//
// Returns the full { resumes, entries } snapshot so the client can sync
// without a follow-up GET.

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { validateEditToken } from "$lib/server/editToken";
import {
  loadProfileResumes,
  normalizeResumeName,
  syncLegacyResumeData,
} from "$lib/server/resumes";

const MAX_RESUMES = 8;

export const POST: RequestHandler = async ({ params, request }) => {
  const token = await validateEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = normalizeResumeName(body.name);

  const { data: existing, error: countErr } = await supabaseAdmin
    .from("resumes")
    .select("id, sort_order")
    .eq("profile_id", token.target_id)
    .order("sort_order", { ascending: false });
  if (countErr) error(500, "Could not read existing resumes.");
  if ((existing ?? []).length >= MAX_RESUMES) {
    error(400, `Limit is ${MAX_RESUMES} resumes per profile.`);
  }
  const nextOrder = (existing && existing[0] ? existing[0].sort_order : -1) + 1;

  const { error: insertErr } = await supabaseAdmin
    .from("resumes")
    .insert({
      profile_id: token.target_id,
      name,
      sort_order: nextOrder,
    });
  if (insertErr) error(500, "Could not create resume.");

  await syncLegacyResumeData(token.target_id);
  const snapshot = await loadProfileResumes(token.target_id);
  return json(snapshot);
};
