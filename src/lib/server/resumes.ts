// Server helpers for the multi-resume builder (mig 078). One profile
// can have N named resumes; each resume_entry (credit / training /
// skill) lives in its own row and carries a `resume_ids[]` array
// pointing at which resumes it appears on. Empty array = "inbox"
// (unassigned, surfaced to the artist as a pile to triage).
//
// All mutating helpers expect a `profile_id` so the caller can enforce
// ownership (magic-link target, admin override, etc.). They never call
// supabaseAdmin directly to authorize - that's the route's job.

import { supabaseAdmin } from "$lib/server/supabase";
import type { ResumeData } from "$lib/server/resume";

export type ResumeEntryKind = "credit" | "training" | "skill";
export type ResumeEntrySource = "hand" | "production" | "admin";

// Per-kind shapes (used during normalization). Consumers read entries
// with bracket notation since the union is a hassle to narrow in
// templates.
export type ResumeEntryData = Record<string, string | undefined>;

export type ResumeRow = {
  id: string;
  profile_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ResumeEntryRow = {
  id: string;
  profile_id: string;
  kind: ResumeEntryKind;
  data: ResumeEntryData;
  source: ResumeEntrySource;
  production_credit_id: string | null;
  resume_ids: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const FIELD_MAX = 200;
const NOTES_MAX = 400;
const NAME_MAX = 80;

function trim(v: unknown, max = FIELD_MAX): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function trimOptional(v: unknown, max = FIELD_MAX): string | undefined {
  const t = trim(v, max);
  return t.length > 0 ? t : undefined;
}

/** Validate + normalize an entry data payload by kind. Drops empty strings
 *  for optional fields. Throws if a required field is missing. */
export function normalizeEntryData(
  kind: ResumeEntryKind,
  raw: unknown,
): ResumeEntryData {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (kind === "credit") {
    return {
      show: trim(o.show),
      role: trim(o.role),
      company: trim(o.company),
      director: trimOptional(o.director),
      year: trimOptional(o.year, 60),
      notes: trimOptional(o.notes, NOTES_MAX),
    };
  }
  if (kind === "training") {
    return {
      title: trim(o.title),
      institution: trim(o.institution),
      year: trimOptional(o.year, 60),
      notes: trimOptional(o.notes, NOTES_MAX),
    };
  }
  return {
    category: trim(o.category),
    items: trim(o.items, NOTES_MAX),
  };
}

/** True if the entry has no visible content (all fields empty). Used to
 *  decide whether a row is worth keeping. */
export function entryIsEmpty(kind: ResumeEntryKind, data: ResumeEntryData): boolean {
  if (kind === "credit") {
    const c = data as { show: string; role: string; company: string; director?: string; year?: string; notes?: string };
    return !(c.show || c.role || c.company || c.director || c.year || c.notes);
  }
  if (kind === "training") {
    const t = data as { title: string; institution: string; year?: string; notes?: string };
    return !(t.title || t.institution || t.year || t.notes);
  }
  const s = data as { category: string; items: string };
  return !(s.category || s.items);
}

export function normalizeResumeName(raw: unknown): string {
  const t = trim(raw, NAME_MAX);
  return t || "Resume";
}

/** Fetch all resumes + entries for a profile. Used by the edit page,
 *  the admin profile edit page, and the public profile page. */
export async function loadProfileResumes(profileId: string): Promise<{
  resumes: ResumeRow[];
  entries: ResumeEntryRow[];
}> {
  const [resumesRes, entriesRes] = await Promise.all([
    supabaseAdmin
      .from("resumes")
      .select("*")
      .eq("profile_id", profileId)
      .order("sort_order"),
    supabaseAdmin
      .from("resume_entries")
      .select("*")
      .eq("profile_id", profileId)
      .order("kind")
      .order("sort_order"),
  ]);
  return {
    resumes: (resumesRes.data ?? []) as ResumeRow[],
    entries: (entriesRes.data ?? []) as ResumeEntryRow[],
  };
}

/** Ensure a profile has at least one resume. Used after profile
 *  creation and as a defensive call before the editor renders. */
export async function ensureDefaultResume(profileId: string): Promise<ResumeRow> {
  const { data: existing } = await supabaseAdmin
    .from("resumes")
    .select("*")
    .eq("profile_id", profileId)
    .order("sort_order")
    .limit(1);
  if (existing && existing.length > 0) return existing[0] as ResumeRow;
  const { data, error } = await supabaseAdmin
    .from("resumes")
    .insert({ profile_id: profileId, name: "Resume", sort_order: 0 })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Could not create default resume: " + (error?.message ?? "unknown"));
  }
  return data as ResumeRow;
}

/** Expand a legacy ResumeData (jsonb shape from the submit form or
 *  pending_submissions) into resume_entries rows assigned to a
 *  freshly-created default resume. Used when /admin/profiles/new
 *  promotes a pending submission into a real profile. */
export async function expandLegacyResumeData(
  profileId: string,
  data: ResumeData | null | undefined,
): Promise<void> {
  const resume = await ensureDefaultResume(profileId);
  if (!data) return;
  const rows: Array<Omit<ResumeEntryRow, "id" | "created_at" | "updated_at" | "production_credit_id">> = [];
  (data.credits ?? []).forEach((c, i) => {
    const norm = normalizeEntryData("credit", c);
    if (!entryIsEmpty("credit", norm)) {
      rows.push({
        profile_id: profileId,
        kind: "credit",
        data: norm,
        source: "hand",
        resume_ids: [resume.id],
        sort_order: i,
      });
    }
  });
  (data.training ?? []).forEach((t, i) => {
    const norm = normalizeEntryData("training", t);
    if (!entryIsEmpty("training", norm)) {
      rows.push({
        profile_id: profileId,
        kind: "training",
        data: norm,
        source: "hand",
        resume_ids: [resume.id],
        sort_order: i,
      });
    }
  });
  (data.skills ?? []).forEach((s, i) => {
    const norm = normalizeEntryData("skill", s);
    if (!entryIsEmpty("skill", norm)) {
      rows.push({
        profile_id: profileId,
        kind: "skill",
        data: norm,
        source: "hand",
        resume_ids: [resume.id],
        sort_order: i,
      });
    }
  });
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from("resume_entries").insert(rows);
  if (error) {
    console.error("expandLegacyResumeData insert failed", error);
  }
}

/** Public-side: pick the default resume to show first. Returns the
 *  resume with the most entries, falling back to sort_order=0. */
export function pickDefaultResume(
  resumes: ResumeRow[],
  entries: ResumeEntryRow[],
): ResumeRow | null {
  if (resumes.length === 0) return null;
  if (resumes.length === 1) return resumes[0];
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const rid of e.resume_ids) {
      counts.set(rid, (counts.get(rid) ?? 0) + 1);
    }
  }
  let best = resumes[0];
  let bestCount = counts.get(best.id) ?? 0;
  for (const r of resumes.slice(1)) {
    const c = counts.get(r.id) ?? 0;
    if (c > bestCount) {
      best = r;
      bestCount = c;
    }
  }
  return best;
}

/** Filter entries to those visible on a given resume (or unassigned
 *  when resumeId is null - the inbox). */
export function entriesForResume(
  entries: ResumeEntryRow[],
  resumeId: string | null,
  kind?: ResumeEntryKind,
): ResumeEntryRow[] {
  return entries
    .filter((e) => {
      if (kind && e.kind !== kind) return false;
      if (resumeId === null) return e.resume_ids.length === 0;
      return e.resume_ids.includes(resumeId);
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

// syncLegacyResumeData() was removed in mig 087. The new relational
// resumes / resume_entries tables are the only source of truth now;
// the profiles.resume_data jsonb column was dropped.
