// POST /api/edit/[token]/entries
// Create a new resume entry (credit / training / skill). Body shape:
// { kind, data, resume_ids? }. Returns the full snapshot.
//
// Live API (does NOT burn the token).

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { validateEditToken } from "$lib/server/editToken";
import {
  loadProfileResumes,
  normalizeEntryData,
  type ResumeEntryKind,
} from "$lib/server/resumes";

const MAX_ENTRIES_PER_KIND = 200;

const KINDS: ResumeEntryKind[] = ["credit", "training", "skill"];

export const POST: RequestHandler = async ({ params, request }) => {
  const token = await validateEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");

  const body = (await request.json().catch(() => ({}))) as {
    kind?: unknown;
    data?: unknown;
    resume_ids?: unknown;
  };
  const kind = body.kind as ResumeEntryKind;
  if (!KINDS.includes(kind)) error(400, "Invalid kind.");
  const data = normalizeEntryData(kind, body.data);

  // Cap entries per kind to keep one profile from blowing up the table.
  const { count } = await supabaseAdmin
    .from("resume_entries")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", token.target_id)
    .eq("kind", kind);
  if ((count ?? 0) >= MAX_ENTRIES_PER_KIND) {
    error(400, `Limit is ${MAX_ENTRIES_PER_KIND} ${kind} entries.`);
  }

  // Restrict resume_ids to ones the artist actually owns.
  const requestedIds = Array.isArray(body.resume_ids)
    ? (body.resume_ids as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  let resumeIds: string[] = [];
  if (requestedIds.length > 0) {
    const { data: owned } = await supabaseAdmin
      .from("resumes")
      .select("id")
      .eq("profile_id", token.target_id)
      .in("id", requestedIds);
    resumeIds = (owned ?? []).map((r) => r.id);
  }

  // Sort: append after the highest existing entry of the same kind.
  const { data: maxRow } = await supabaseAdmin
    .from("resume_entries")
    .select("sort_order")
    .eq("profile_id", token.target_id)
    .eq("kind", kind)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (maxRow && maxRow[0] ? maxRow[0].sort_order : -1) + 1;

  const { error: insertErr } = await supabaseAdmin
    .from("resume_entries")
    .insert({
      profile_id: token.target_id,
      kind,
      data,
      source: "hand",
      resume_ids: resumeIds,
      sort_order: nextOrder,
    });
  if (insertErr) error(500, "Could not create entry.");

  return json(await loadProfileResumes(token.target_id));
};
