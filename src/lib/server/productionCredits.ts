// Server helpers for production_credits (mig 079). A credit ties a
// person (free-text or linked profile) to a production with a position
// and category. Creating a credit with a profile_id auto-creates a
// linked resume_entries row on the artist's profile so they don't have
// to type the same info twice. Deleting / detaching reverses cleanly.

import { supabaseAdmin } from "$lib/server/supabase";

// v1.1 originally had cast / creative / crew. Simplified to cast /
// production after early feedback that the creative-vs-crew split was
// fuzzy. The 'creative' and 'crew' enum values still exist in
// production_credit_category for backwards compat (mig 084 + 085) but
// the application only writes / reads cast | production.
export type ProductionCreditCategory = "cast" | "production";
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

const CATEGORIES: ProductionCreditCategory[] = ["cast", "production"];
export function isCategory(v: unknown): v is ProductionCreditCategory {
  // Accept legacy 'creative' / 'crew' from any older clients still
  // in flight; coerce them up at the call site via coerceCategory().
  return CATEGORIES.includes(v as ProductionCreditCategory) || v === "creative" || v === "crew";
}

/** Map any category value (including legacy creative/crew) to one of
 *  the two current values. */
export function coerceCategory(v: unknown): ProductionCreditCategory {
  if (v === "cast") return "cast";
  return "production";
}

/** Fuzzy name matching: returns up to N profile candidates ordered by
 *  best score. Used by the credits editor's "Find profile" button + the
 *  paste-cast parser to suggest a link for each pasted name.
 *
 *  Strategy: tokenize the query by whitespace, require every token to
 *  appear (case-insensitive substring) in full_name. So "Blake York"
 *  matches "Blake R. York" because both tokens are present. Then score
 *  the resulting candidates so exact / startsWith / token-boundary
 *  matches sort to the top. */
export async function findProfileMatches(
  name: string,
  limit = 5,
): Promise<Array<{ id: string; slug: string; full_name: string; score: number }>> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const tokens = trimmed.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];

  // Each ilike() in the chain is AND'd together server-side, so the
  // resulting set is the intersection: every token must appear in the
  // full_name. Avoids matching "Blake Smith" when looking for "Blake
  // York" (would happen with a single substring search).
  let query = supabaseAdmin
    .from("profiles")
    .select("id, slug, full_name")
    .is("deleted_at", null)
    .eq("published", true);
  for (const t of tokens) {
    query = query.ilike("full_name", `%${t}%`);
  }
  const { data } = await query.limit(20);

  const lower = trimmed.toLowerCase();
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
 *  existing row is returned unchanged.
 *
 *  Auto-link: when profile_id is null, look up an exact name match
 *  among published profiles. If exactly one match, link to it. This
 *  way submitters who type a full name without clicking the
 *  autocomplete suggestion still get linked credits. Skipped when the
 *  name is ambiguous (multiple matches) so we don't link to the wrong
 *  artist. */
export async function createProductionCredit(input: {
  production_id: string;
  profile_id: string | null;
  display_name: string;
  position: string;
  category: ProductionCreditCategory;
  source: ProductionCreditSource;
  created_by_email?: string | null;
}): Promise<ProductionCreditRow & { resume_placement: ResumePlacement }> {
  const display_name = trimName(input.display_name);
  const position = trimPosition(input.position);
  if (!display_name) throw new Error("Name is required.");
  if (!position) throw new Error("Position is required.");
  if (!isCategory(input.category)) throw new Error("Invalid category.");

  let profile_id = input.profile_id;
  if (!profile_id) {
    const matches = await findProfileMatches(display_name, 5);
    // Tokenized AND-search already guarantees every query token is in
    // each candidate's full_name. So if exactly one candidate comes
    // back AND the query has 2+ tokens (i.e. "first last"-shaped, not
    // a single-token search like "Sarah" which is too ambiguous),
    // we're confident enough to auto-link. Catches cases like
    // "Blake York" -> "Blake R. York".
    const tokens = display_name
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    if (matches.length === 1 && tokens.length >= 2) {
      profile_id = matches[0].id;
    } else {
      const exact = matches.filter(
        (m) => m.full_name.trim().toLowerCase() === display_name.toLowerCase(),
      );
      if (exact.length === 1) {
        profile_id = exact[0].id;
      }
    }
  }

  // Idempotency check: same profile + production + position = same
  // credit. (Pasting a cast list twice should not double up.)
  if (profile_id) {
    const { data: dup } = await supabaseAdmin
      .from("production_credits")
      .select("*")
      .eq("production_id", input.production_id)
      .eq("profile_id", profile_id)
      .ilike("position", position)
      .is("deleted_at", null)
      .maybeSingle();
    if (dup) {
      return Object.assign(dup as ProductionCreditRow, {
        resume_placement: "duplicate" as ResumePlacement,
      });
    }
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
      profile_id,
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

  let resumePlacement: ResumePlacement = "skipped";
  if (credit.profile_id) {
    resumePlacement = await autoCreateLinkedResumeEntry(credit);
  }

  // Stash the placement on the returned object so callers (the artist
  // self-claim endpoint, in particular) can tell the user whether the
  // credit landed in their inbox or got merged into an existing hand
  // row. Lives in a non-DB property; consumers ignore it when they
  // don't care.
  return Object.assign(credit, { resume_placement: resumePlacement });
}

export type ResumePlacement = "promoted" | "inboxed" | "duplicate" | "skipped";

/** Auto-create a linked resume_entries row when a production credit is
 *  tagged on a real profile. Lands in the artist's inbox (unassigned)
 *  by default - they assign it to specific resumes from the editor.
 *  Dedup: if an existing hand-entered row matches title+company+year,
 *  promote it to linked instead of creating a duplicate.
 *
 *  Return value tells the caller which path fired so user-facing
 *  messaging can match: "promoted" = upgraded an existing hand row,
 *  "inboxed" = new row in the inbox, "skipped" = no profile to file
 *  against (free-text credit; no resume entry possible). */
async function autoCreateLinkedResumeEntry(
  credit: ProductionCreditRow,
): Promise<ResumePlacement> {
  if (!credit.profile_id) return "skipped";

  // Pull production data to denormalize into the resume entry.
  const { data: production } = await supabaseAdmin
    .from("productions")
    .select("id, title, run_start, organization_id")
    .eq("id", credit.production_id)
    .maybeSingle();
  if (!production) return "skipped";
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
      return "promoted";
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
  return "inboxed";
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
    }
  }
}

// Words that strongly suggest a side of the line is the role/position
// rather than a person's name. Used by orient() when the separator
// alone doesn't tell us which side is which (hyphen + colon are
// ambiguous - programs use both "Name - Role" and "Role - Name").
const ROLE_HINT = /\b(director|music director|musical director|choreographer|stage manager|assistant stage manager|asm|sound designer|lighting designer|set designer|scenic designer|costume designer|props|properties|dramaturg|dramaturgy|fight choreographer|fight director|intimacy director|cast|carpenter|technician|photography|technical director|scenic artist|visuals|interns?|orchestra|conductor|playwright|writer|producer|production manager|house manager|wardrobe|hair|makeup|board op|board operator|projection|video|chief|assistant|associate|crew|run crew|deck|deck chief|spot operator|swing|dance captain|fight captain|vocal director|hair and makeup|hair\/makeup)\b/i;

// "Density" of role-keyword matches in `s`: number of regex hits
// across the whole string divided by the token count. Counting
// matches against the whole string (rather than per-token) lets
// multi-word roles like "Stage Manager" register without each
// token having to match alone. Splits on whitespace, slashes, and
// ampersands so multi-role positions tokenize cleanly.
const ROLE_HINT_GLOBAL = new RegExp(ROLE_HINT.source, "gi");
function roleDensity(s: string): number {
  const tokens = s.split(/[\s/&]+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return 0;
  const matches = s.match(ROLE_HINT_GLOBAL);
  return (matches ? matches.length : 0) / tokens.length;
}

// Choose which of two halves is the name vs the position by comparing
// role density. Side with the higher fraction of role keywords is the
// position; the other side is the name. Ties fall back to "name first"
// (the more common program convention).
function orient(a: string, b: string): { name: string; position: string } {
  const da = roleDensity(a);
  const db = roleDensity(b);
  if (da > db) return { name: b, position: a };
  if (db > da) return { name: a, position: b };
  return { name: a, position: b };
}

// Split a "name" segment into multiple names when it contains
// "and"/"&" / "," / ampersand-style separators. Returns one entry
// per detected name. Used so a line like "Interns - Nova and Savannah"
// becomes two credits.
function splitNames(name: string): string[] {
  const parts = name
    .split(/\s*(?:,|&|\sand\s)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [name];
}

/** Parse a pasted cast list. Each line is normally one credit; lines
 *  with multiple names ("Nova and Savannah") expand to multiple
 *  credits sharing the same position.
 *
 *  Recognised line formats:
 *   - "Name as Role"                   (oriented: name first)
 *   - "Name, Role"                     (oriented: name first)
 *   - "Name - Role" / "Role - Name"    (orientation by role keyword)
 *   - "Name: Role" / "Role: Name"      (orientation by role keyword)
 *   - "Name-Role" / "Role-Name"        (no spaces around hyphen)
 *  Falls back to {name: line, position: ""} when no separator is
 *  found so the admin can still edit. */
export function parseCastList(raw: string): Array<{ name: string; position: string }> {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Array<{ name: string; position: string }> = [];
  for (const line of lines) {
    let parsed: { name: string; position: string } | null = null;

    // " as " - unambiguous name-first convention.
    const asMatch = line.match(/^(.+?)\s+as\s+(.+)$/i);
    if (asMatch) {
      parsed = { name: asMatch[1].trim(), position: asMatch[2].trim() };
    }
    // Hyphen / em-dash / en-dash. Try with-spaces first so a hyphenated
    // name like "Layla Tobar-Thompson - Stage Manager" splits at the
    // outer hyphen, not the one inside the surname. Fall back to the
    // no-space variant for "Director-Name" style entries.
    if (!parsed) {
      let dashMatch = line.match(/^(.+?)\s+[-—–]\s+(.+)$/);
      if (!dashMatch) dashMatch = line.match(/^(.+?)\s*[-—–]\s*(.+)$/);
      if (dashMatch) parsed = orient(dashMatch[1].trim(), dashMatch[2].trim());
    }
    // ":" - orientation by role keyword.
    if (!parsed) {
      const colonMatch = line.match(/^(.+?):\s*(.+)$/);
      if (colonMatch) parsed = orient(colonMatch[1].trim(), colonMatch[2].trim());
    }
    // ", " - prefers name first.
    if (!parsed) {
      const commaMatch = line.match(/^([^,]+),\s+(.+)$/);
      if (commaMatch) {
        parsed = { name: commaMatch[1].trim(), position: commaMatch[2].trim() };
      }
    }
    if (!parsed) {
      out.push({ name: line, position: "" });
      continue;
    }

    // Expand "Name1 and Name2" into multiple credits sharing position.
    for (const n of splitNames(parsed.name)) {
      out.push({ name: n, position: parsed.position });
    }
  }
  return out;
}

/** Load the credits for one production, grouped by category and ordered
 *  by sort_order. Used by the public detail page and the admin editor.
 *  Legacy 'creative' / 'crew' rows are normalized into 'production' for
 *  the consumer. */
export async function loadProductionCredits(productionId: string): Promise<{
  cast: ProductionCreditRow[];
  production: ProductionCreditRow[];
}> {
  const { data } = await supabaseAdmin
    .from("production_credits")
    .select("*")
    .eq("production_id", productionId)
    .is("deleted_at", null)
    .order("category")
    .order("sort_order");
  const all = ((data ?? []) as ProductionCreditRow[]).map((c) => ({
    ...c,
    category: coerceCategory(c.category) as ProductionCreditCategory,
  }));
  return {
    cast: all.filter((c) => c.category === "cast"),
    production: all.filter((c) => c.category === "production"),
  };
}

/** "Currently appearing in" / "currently working on" data for an
 *  artist profile. Returns productions where:
 *   - this artist is credited (production_credits.profile_id = id)
 *   - production is approved + not deleted
 *   - run dates include today (or are upcoming within next 60 days)
 *  Each row carries the credit's category so the artist profile can
 *  render cast credits as "Currently appearing in" and production-team
 *  credits as "Currently working on". */
/** Marquee feeder: every credit whose production is currently in
 *  run window AND whose linked artist profile is published + not a
 *  minor. Returns one row per credit; the homepage's marquee builder
 *  projects each into a ticker item with a link to the artist profile. */
export async function loadCurrentAppearancesForMarquee(): Promise<
  Array<{
    profile_slug: string;
    profile_name: string;
    production_title: string;
    org_name: string | null;
    position: string;
    category: ProductionCreditCategory;
    run_start: string;
  }>
> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("production_credits")
    .select(
      `id, position, category, profile_id,
       productions:production_id ( id, title, run_start, run_end, status,
                                   deleted_at, hidden_at, organization_id,
                                   organizations:organization_id ( name ) ),
       profiles:profile_id ( slug, full_name, published, is_minor, deleted_at )`,
    )
    .is("deleted_at", null)
    .not("profile_id", "is", null)
    .limit(500);

  type Row = {
    position: string;
    category: string;
    productions: {
      title: string;
      run_start: string;
      run_end: string | null;
      status: string;
      deleted_at: string | null;
      hidden_at: string | null;
      organizations: { name: string } | null;
    } | null;
    profiles: {
      slug: string;
      full_name: string;
      published: boolean;
      is_minor: boolean;
      deleted_at: string | null;
    } | null;
  };

  return (data ?? [])
    .map((row) => {
      const r = row as unknown as Row;
      const p = r.productions;
      const a = r.profiles;
      if (!p || !a) return null;
      if (p.status !== "approved" || p.deleted_at || p.hidden_at) return null;
      if (!a.published || a.is_minor || a.deleted_at) return null;
      const start = p.run_start;
      const end = p.run_end ?? p.run_start;
      // Strict in-run-window: today between start and end (inclusive).
      // Upcoming-but-not-yet-running shows aren't surfaced here - those
      // already get visibility via the calendar block of the marquee.
      if (start > today) return null;
      if (end < today) return null;
      return {
        profile_slug: a.slug,
        profile_name: a.full_name,
        production_title: p.title,
        org_name: p.organizations?.name ?? null,
        position: r.position,
        category: coerceCategory(r.category),
        run_start: p.run_start,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export async function loadCurrentAppearances(profileId: string): Promise<
  Array<{
    production_id: string;
    title: string;
    run_start: string;
    run_end: string | null;
    position: string;
    category: ProductionCreditCategory;
    org_name: string | null;
  }>
> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("production_credits")
    .select(
      `id, position, category,
       productions:production_id ( id, title, run_start, run_end, status, deleted_at, organization_id,
                                   organizations:organization_id ( name ) )`,
    )
    .eq("profile_id", profileId)
    .is("deleted_at", null);
  return (data ?? [])
    .map((row) => {
      const r = row as unknown as {
        position: string;
        category: string;
        productions: { id: string; title: string; run_start: string; run_end: string | null; status: string; deleted_at: string | null; organization_id: string | null; organizations: { name: string } | null };
      };
      const p = r.productions;
      if (!p) return null;
      if (p.status !== "approved" || p.deleted_at) return null;
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
        position: r.position,
        category: coerceCategory(r.category),
        org_name: p.organizations?.name ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
