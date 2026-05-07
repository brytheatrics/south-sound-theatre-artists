// POST /api/edit/[token]/claim-credit
// Body: { production_id, position, category }
// Creates a production_credits row (source='artist') for the
// magic-link's profile, plus an auto-linked resume_entries row in the
// artist's inbox.
//
// GET  /api/edit/[token]/claim-credit?q=<query>
// Returns up to 10 productions matching the query string by title.

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { validateEditToken } from "$lib/server/editToken";
import {
  createProductionCredit,
  isCategory,
  type ProductionCreditCategory,
} from "$lib/server/productionCredits";

export const GET: RequestHandler = async ({ params, url }) => {
  const token = await validateEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return json({ matches: [] });
  const { data } = await supabaseAdmin
    .from("productions")
    .select(
      `id, title, run_start, run_end,
       organizations:organization_id ( name )`,
    )
    .ilike("title", `%${q}%`)
    .eq("status", "approved")
    .is("deleted_at", null)
    .order("run_start", { ascending: false })
    .limit(10);
  const matches = (data ?? []).map((p) => {
    const orgs = p.organizations as { name: string } | { name: string }[] | null;
    const orgName = Array.isArray(orgs) ? orgs[0]?.name ?? null : orgs?.name ?? null;
    return {
      id: p.id,
      title: p.title,
      run_start: p.run_start,
      run_end: p.run_end,
      org_name: orgName,
    };
  });
  return json({ matches });
};

export const POST: RequestHandler = async ({ params, request }) => {
  const token = await validateEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  const body = (await request.json().catch(() => ({}))) as {
    production_id?: unknown;
    position?: unknown;
    category?: unknown;
  };

  const productionId = typeof body.production_id === "string" ? body.production_id : "";
  const position = typeof body.position === "string" ? body.position : "";
  const category = body.category;
  if (!productionId) error(400, "Pick a production.");
  if (!position.trim()) error(400, "Tell us your role / position.");
  if (!isCategory(category)) error(400, "Invalid category.");
  const cat: ProductionCreditCategory = category;

  // Get the artist's display name from their profile.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", token.target_id)
    .maybeSingle();
  if (!profile) error(404, "Profile not found.");

  try {
    const credit = await createProductionCredit({
      production_id: productionId,
      profile_id: profile.id,
      display_name: profile.full_name,
      position,
      category: cat,
      source: "artist",
      created_by_email: profile.email,
    });
    return json({ ok: true, credit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not claim credit.";
    error(400, msg);
  }
};
