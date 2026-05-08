// PATCH /api/edit/[token]/entries/[id] - update entry fields, resume
//   assignments, or sort order.
// DELETE /api/edit/[token]/entries/[id] - remove an entry. For
//   production-sourced entries, the artist sees this as "detach" in
//   the UI: the row is removed from their resume but the underlying
//   production_credit (their participation in the show) stays intact.
//   v1.1 doesn't auto-recreate, so a hard delete is fine for both
//   cases.

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { validateEditToken } from "$lib/server/editToken";
import {
  loadProfileResumes,
  normalizeEntryData,
  type ResumeEntryKind,
} from "$lib/server/resumes";

async function loadEntry(entryId: string, profileId: string) {
  const { data } = await supabaseAdmin
    .from("resume_entries")
    .select("id, profile_id, kind, source, production_credit_id")
    .eq("id", entryId)
    .maybeSingle();
  if (!data || data.profile_id !== profileId) {
    error(404, "Entry not found.");
  }
  return data;
}

export const PATCH: RequestHandler = async ({ params, request }) => {
  const token = await validateEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  const entry = await loadEntry(params.id, token.target_id);

  const body = (await request.json().catch(() => ({}))) as {
    data?: unknown;
    resume_ids?: unknown;
    sort_order?: unknown;
    detach?: unknown;
  };
  const update: Record<string, unknown> = {};

  if (body.data !== undefined) {
    // Linked entries (source='production') are not free-edited - their
    // data is denormalized from the production. Detach first if you want
    // to edit. Hand entries can change freely.
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
        .eq("profile_id", token.target_id)
        .in("id", requested);
      update.resume_ids = (owned ?? []).map((r) => r.id);
    } else {
      update.resume_ids = [];
    }
  }

  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
    update.sort_order = Math.max(0, Math.floor(body.sort_order));
  }

  // Detach: convert linked production entry to hand-source so the
  // artist can free-edit it (and so the link survives a future
  // production rename / delete without surprising the artist).
  if (body.detach === true && entry.source === "production") {
    update.source = "hand";
    update.production_credit_id = null;
  }

  if (Object.keys(update).length === 0) {
    error(400, "Nothing to update.");
  }

  const { error: updErr } = await supabaseAdmin
    .from("resume_entries")
    .update(update)
    .eq("id", params.id);
  if (updErr) error(500, "Could not update entry.");

  return json(await loadProfileResumes(token.target_id));
};

export const DELETE: RequestHandler = async ({ params }) => {
  const token = await validateEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  await loadEntry(params.id, token.target_id);

  const { error: delErr } = await supabaseAdmin
    .from("resume_entries")
    .delete()
    .eq("id", params.id);
  if (delErr) error(500, "Could not delete entry.");

  return json(await loadProfileResumes(token.target_id));
};
