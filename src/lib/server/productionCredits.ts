// Server helpers for production_credits (mig 079). A credit ties a
// person (free-text or linked profile) to a production with a position
// and category. Creating a credit with a profile_id auto-creates a
// linked resume_entries row on the artist's profile so they don't have
// to type the same info twice. Deleting / detaching reverses cleanly.

import { supabaseAdmin } from "$lib/server/supabase";
import { syncLegacyResumeData } from "$lib/server/resumes";

export type ProductionCreditCategory = "cast" | "creative" | "crew";
export type ProductionCreditSource = "org" | "artist" | "admin";

export type ProductionCreditRow = {
  id: string;
  production_id: string;
  profile_id: string | null;
  display_name: string;
  position: string;
  category: ProductionCreditCategory;
  source: ProductionCreditSource;
  sort_order: number;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const NAME_MAX = 120;
const POSITION_MAX = 120;

export function trimName(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, NAME_MAX);
}
export function trimPosition(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, POSITION_MAX);
}

const CATEGORIES: ProductionCreditCategory[] = ["cast", "creative", "crew"];
export function isCategory(v: unknown): v is ProductionCreditCategory {
  return CATEGORIES.includes(v as ProductionCreditCategory);
}

/** Fuzzy name matching: returns up to N profile candidates ordered by
 *  best score. Used by the org self-serve paste-cast parser to suggest
 *  a profile link for each pasted name. Hits on full_name (case
 *  insensitive substring + first/last token equality). */
export async function findProfileMatches(
  name: string,
  limit = 5,
): Promise<Array<{ id: string; slug: string; full_name: string; score: number }>> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  // Postgres ilike for substring match. We refine in JS afterward to
  // score exact-token matches higher than partial substrings.
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, slug, full_name")
    .ilike("full_name", `%${trimmed}%`)
    .is("deleted_at", null)
    .eq("published", true)
    .limit(20);
  const lower = trimmed.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);
  const scored = (data ?? []).map((p) => {
    const fnLower = p.full_name.toLowerCase();
    let score = 0;
    if (fnLower === lower) score += 100;
    if (fnLower.startsWith(lower)) score += 30;
    for (const t of tokens) {
      if (fnLower.includes(` ${t}`) || fnLower.startsWith(`${t} `) || fnLower === t) {
        score += 10;
      } else if (fnLower.includes(t)) {
        score += 3;
      }
    }
    return { id: p.id, slug: p.slug, full_name: p.full_name, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** Insert a new credit. If profile_id is set, also auto-creates a
 *  linked resume_entries row on the artist's first resume (or unassigned
 *  inbox row if they have no resumes yet). Idempotency: if a credit
 *  already exists for (production_id, profile_id, position), the
 *  existing row is returned unchanged. */
export async function createProductionCredit(input: {
  production_id: string;
  profile_id: string | null;
  display_name: string;
  position: string;
  category: ProductionCreditCategory;
  source: ProductionCreditSource;
  created_by_email?: string | null;
}): Promise<ProductionCreditRow> {
  const display_name = trimName(input.display_name);
  const position = trimPosition(input.position);
  if (!display_name) throw new Error("Name is required.");
  if (!position) throw new Error("Position is required.");
  if (!isCategory(input.category)) throw new Error("Invalid category.");

  // Idempotency check: same profile + production + position = same
  // credit. (Pasting a cast list twice should not double up.)
  if (input.profile_id) {
    const { data: dup } = await supabaseAdmin
      .from("production_credits")
      .select("*")
      .eq("production_id", input.production_id)
      .eq("profile_id", input.profile_id)
      .ilike("position", position)
      .is("deleted_at", null)
      .maybeSingle();
    if (dup) return dup as ProductionCreditRow;
  }

  // Sort: append to the bottom of the same category section.
  const { data: maxRow } = await supabaseAdmin
    .from("production_credits")
    .select("sort_order")
    .eq("production_id", input.production_id)
    .eq("category", input.category)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sort_order = (maxRow && maxRow[0] ? maxRow[0].sort_order : -1) + 1;

  const { data, error: insertErr } = await supabaseAdmin
    .from("production_credits")
    .insert({
      production_id: input.production_id,
      profile_id: input.profile_id,
      display_name,
      position,
      category: input.category,
      source: input.source,
      sort_order,
      created_by_email: input.created_by_email ?? null,
    })
    .select("*")
    .single();
  if (insertErr || !data) {
    throw new Error("Could not create credit: " + (insertErr?.message ?? "unknown"));
  }
  const credit = data as ProductionCreditRow;

  if (credit.profile_id) {
    await autoCreateLinkedResumeEntry(credit);
  }

  return credit;
}

/** Auto-create a linked resume_entries row when a production credit is
 *  tagged on a real profile. Lands in the artist's inbox (unassigned)
 *  by default - they assign it to specific resumes from the editor.
 *  Dedup: if an existing hand-entered row matches title+company+year,
 *  promote it to linked instead of creating a duplicate. */
async function autoCreateLinkedResumeEntry(credit: ProductionCreditRow): Promise<void> {
  if (!credit.profile_id) return;

  // Pull production data to denormalize into the resume entry.
  const { data: production } = await supabaseAdmin
    .from("productions")
    .select("id, title, run_start, organization_id")
    .eq("id", credit.production_id)
    .maybeSingle();
  if (!production) return;
  let companyName = "";
  if (production.organization_id) {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", production.organization_id)
      .maybeSingle();
    companyName = org?.name ?? "";
  }
  const year = production.run_start
    ? new Date(production.run_start).getFullYear().toString()
    : "";

  const data = {
    show: production.title,
    role: credit.position,
    company: companyName,
    year,
  };

  // Dedup: if a hand row already exists for the same show+company+year,
  // promote it to linked instead of inserting a duplicate.
  const { data: existing } = await supabaseAdmin
    .from("resume_entries")
    .select("id, source, data")
    .eq("profile_id", credit.profile_id)
    .eq("kind", "credit")
    .eq("source", "hand");
  for (const row of existing ?? []) {
    const d = row.data as Record<string, string | undefined>;
    const showMatch = (d.show ?? "").trim().toLowerCase() === (data.show ?? "").trim().toLowerCase();
    const companyMatch = (d.company ?? "").trim().toLowerCase() === (data.company ?? "").trim().toLowerCase();
    const yearMatch = (d.year ?? "").trim() === (data.year ?? "").trim();
    if (showMatch && companyMatch && yearMatch) {
      await supabaseAdmin
        .from("resume_entries")
        .update({
          source: "production",
          production_credit_id: credit.id,
          data,
        })
        .eq("id", row.id);
      await syncLegacyResumeData(credit.profile_id);
      return;
    }
  }

  await supabaseAdmin.from("resume_entries").insert({
    profile_id: credit.profile_id,
    kind: "credit",
    data,
    source: "production",
    production_credit_id: credit.id,
    resume_ids: [], // inbox - artist assigns later
    sort_order: 0,
  });
  await syncLegacyResumeData(credit.profile_id);
}

/** Soft-delete a credit. The linked resume row (if any) gets converted
 *  to source='hand' so the artist keeps the credit they earned. */
export async function deleteProductionCredit(creditId: string): Promise<void> {
  const { data: credit } = await supabaseAdmin
    .from("production_credits")
    .select("id, profile_id")
    .eq("id", creditId)
    .maybeSingle();
  if (!credit) return;

  // Convert the linked resume row to hand so the artist keeps it.
  if (credit.profile_id) {
    await supabaseAdmin
      .from("resume_entries")
      .update({ source: "hand", production_credit_id: null })
      .eq("production_credit_id", creditId);
    await syncLegacyResumeData(credit.profile_id);
  }

  // Hard-delete the credit (sets the FK column on resume_entries to
  // null per ON DELETE SET NULL, which is harmless after our update).
  await supabaseAdmin
    .from("production_credits")
    .delete()
    .eq("id", creditId);
}

/** Update the position on a credit. Cascade the change into the linked
 *  resume entry's role field if any. */
export async function updateProductionCreditPosition(
  creditId: string,
  position: string,
): Promise<void> {
  const trimmed = trimPosition(position);
  if (!trimmed) throw new Error("Position is required.");
  const { data: credit } = await supabaseAdmin
    .from("production_credits")
    .select("id, profile_id")
    .eq("id", creditId)
    .maybeSingle();
  if (!credit) throw new Error("Credit not found.");
  await supabaseAdmin
    .from("production_credits")
    .update({ position: trimmed })
    .eq("id", creditId);
  // Cascade: update role on the linked resume_entries row.
  if (credit.profile_id) {
    const { data: entry } = await supabaseAdmin
      .from("resume_entries")
      .select("id, data")
      .eq("production_credit_id", creditId)
      .maybeSingle();
    if (entry) {
      const data = (entry.data as Record<string, string | undefined>) ?? {};
      await supabaseAdmin
        .from("resume_entries")
        .update({ data: { ...data, role: trimmed } })
        .eq("id", entry.id);
      await syncLegacyResumeData(credit.profile_id);
    }
  }
}

/** Parse a pasted cast list. Each line is one credit; we recognize a
 *  few common formats:
 *   - "Name as Role"
 *   - "Name - Role"
 *   - "Name: Role"
 *   - "Role: Name" (less common; only when first token looks like a role)
 *   - "Name, Role"
 *  Falls back to {name: line, position: ""} when no separator is found
 *  so the admin can still edit. */
export function parseCastList(raw: string): Array<{ name: string; position: string }> {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => {
    // " as " separator - prefers Name as Role.
    const asMatch = line.match(/^(.+?)\s+as\s+(.+)$/i);
    if (asMatch) return { name: asMatch[1].trim(), position: asMatch[2].trim() };
    // " - " or " — " separator.
    const dashMatch = line.match(/^(.+?)\s+[-—–]\s+(.+)$/);
    if (dashMatch) return { name: dashMatch[1].trim(), position: dashMatch[2].trim() };
    // ": " separator (could be either order).
    const colonMatch = line.match(/^(.+?):\s+(.+)$/);
    if (colonMatch) {
      // If the LHS looks like a role keyword, treat as Role: Name.
      const lhs = colonMatch[1].trim();
      const rhs = colonMatch[2].trim();
      if (
        /^(director|music director|choreographer|stage manager|assistant stage manager|asm|sound designer|lighting designer|set designer|costume designer|props designer|dramaturg|fight choreographer|intimacy director|cast)$/i.test(
          lhs,
        )
      ) {
        return { name: rhs, position: lhs };
      }
      return { name: lhs, position: rhs };
    }
    // ", " separator - prefers Name, Role.
    const commaMatch = line.match(/^([^,]+),\s+(.+)$/);
    if (commaMatch) return { name: commaMatch[1].trim(), position: commaMatch[2].trim() };
    return { name: line, position: "" };
  });
}

/** Load the credits for one production, grouped by category and ordered
 *  by sort_order. Used by the public detail page and the admin editor. */
export async function loadProductionCredits(productionId: string): Promise<{
  cast: ProductionCreditRow[];
  creative: ProductionCreditRow[];
  crew: ProductionCreditRow[];
}> {
  const { data } = await supabaseAdmin
    .from("production_credits")
    .select("*")
    .eq("production_id", productionId)
    .is("deleted_at", null)
    .order("category")
    .order("sort_order");
  const all = (data ?? []) as ProductionCreditRow[];
  return {
    cast: all.filter((c) => c.category === "cast"),
    creative: all.filter((c) => c.category === "creative"),
    crew: all.filter((c) => c.category === "crew"),
  };
}

/** "Currently appearing in" data for an artist profile. Returns
 *  productions where:
 *   - this artist is credited (production_credits.profile_id = id)
 *   - production is approved + not deleted
 *   - run dates include today (or are upcoming within next 60 days)
 *  Used by /artists/[slug] for the marquee badge. */
export async function loadCurrentAppearances(profileId: string): Promise<
  Array<{
    production_id: string;
    title: string;
    run_start: string;
    run_end: string | null;
    position: string;
    org_name: string | null;
  }>
> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("production_credits")
    .select(
      `id, position,
       productions:production_id ( id, title, run_start, run_end, status, deleted_at, organization_id,
                                   organizations:organization_id ( name ) )`,
    )
    .eq("profile_id", profileId)
    .is("deleted_at", null);
  return (data ?? [])
    .map((row) => {
      const p = (row as unknown as { productions: { id: string; title: string; run_start: string; run_end: string | null; status: string; deleted_at: string | null; organization_id: string | null; organizations: { name: string } | null } }).productions;
      if (!p) return null;
      if (p.status !== "approved" || p.deleted_at) return null;
      // Active window: run_start <= today + 60 days AND
      // (run_end is null OR run_end >= today).
      const start = p.run_start;
      const end = p.run_end ?? p.run_start;
      const sixty = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      if (start > sixty) return null;
      if (end < today) return null;
      return {
        production_id: p.id,
        title: p.title,
        run_start: p.run_start,
        run_end: p.run_end,
        position: (row as { position: string }).position,
        org_name: p.organizations?.name ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
