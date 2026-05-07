// POST /api/admin/profiles/[id]/entries - admin-side mirror of artist
// entry-create endpoint. Auth via admin session.

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import {
  loadProfileResumes,
  normalizeEntryData,
  syncLegacyResumeData,
  type ResumeEntryKind,
} from "$lib/server/resumes";

const MAX_ENTRIES_PER_KIND = 200;
const KINDS: ResumeEntryKind[] = ["credit", "training", "skill"];

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  const body = (await request.json().catch(() => ({}))) as {
    kind?: unknown;
    data?: unknown;
    resume_ids?: unknown;
  };
  const kind = body.kind as ResumeEntryKind;
  if (!KINDS.includes(kind)) error(400, "Invalid kind.");
  const data = normalizeEntryData(kind, body.data);

  const { count } = await supabaseAdmin
    .from("resume_entries")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", params.id)
    .eq("kind", kind);
  if ((count ?? 0) >= MAX_ENTRIES_PER_KIND) {
    error(400, `Limit is ${MAX_ENTRIES_PER_KIND} ${kind} entries.`);
  }

  const requestedIds = Array.isArray(body.resume_ids)
    ? (body.resume_ids as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  let resumeIds: string[] = [];
  if (requestedIds.length > 0) {
    const { data: owned } = await supabaseAdmin
      .from("resumes")
      .select("id")
      .eq("profile_id", params.id)
      .in("id", requestedIds);
    resumeIds = (owned ?? []).map((r) => r.id);
  }

  const { data: maxRow } = await supabaseAdmin
    .from("resume_entries")
    .select("sort_order")
    .eq("profile_id", params.id)
    .eq("kind", kind)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (maxRow && maxRow[0] ? maxRow[0].sort_order : -1) + 1;

  const { error: insertErr } = await supabaseAdmin
    .from("resume_entries")
    .insert({
      profile_id: params.id,
      kind,
      data,
      source: "admin",
      resume_ids: resumeIds,
      sort_order: nextOrder,
    });
  if (insertErr) error(500, "Could not create entry.");

  await syncLegacyResumeData(params.id);
  return json(await loadProfileResumes(params.id));
};
