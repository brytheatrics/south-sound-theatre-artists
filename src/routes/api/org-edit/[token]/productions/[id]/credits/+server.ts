// POST + GET /api/org-edit/[token]/productions/[id]/credits
// Org-side mirror of /api/admin/productions/[id]/credits. Validates the
// org-edit token and that the production belongs to the org.

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { validateOrgEditToken } from "$lib/server/editToken";
import {
  createProductionCredit,
  loadProductionCredits,
  parseCastList,
  isCategory,
  type ProductionCreditCategory,
} from "$lib/server/productionCredits";

async function assertProductionOwnedByToken(productionId: string, orgId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("productions")
    .select("organization_id")
    .eq("id", productionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) error(404, "Production not found.");
  if (data.organization_id !== orgId) error(403, "This edit link doesn't cover that production.");
}

async function senderEmail(token: { id: string; email: string | null }): Promise<string | null> {
  return token.email;
}

export const GET: RequestHandler = async ({ params }) => {
  const token = await validateOrgEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  await assertProductionOwnedByToken(params.id, token.target_id);
  return json(await loadProductionCredits(params.id));
};

export const POST: RequestHandler = async ({ params, request }) => {
  const token = await validateOrgEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  await assertProductionOwnedByToken(params.id, token.target_id);

  const body = (await request.json().catch(() => ({}))) as {
    display_name?: unknown;
    position?: unknown;
    category?: unknown;
    profile_id?: unknown;
    paste?: unknown;
  };
  const category = body.category;
  if (!isCategory(category)) error(400, "Invalid category.");
  const cat: ProductionCreditCategory = category;
  const submittedBy = await senderEmail(token);

  if (typeof body.paste === "string" && body.paste.trim()) {
    const lines = parseCastList(body.paste);
    for (const line of lines) {
      if (!line.name) continue;
      try {
        await createProductionCredit({
          production_id: params.id,
          profile_id: null,
          display_name: line.name,
          position: line.position || (cat === "cast" ? "Ensemble" : "TBD"),
          category: cat,
          source: "org",
          created_by_email: submittedBy,
        });
      } catch (err) {
        console.error("paste-cast (org) insert failed", err);
      }
    }
  } else {
    try {
      await createProductionCredit({
        production_id: params.id,
        profile_id: typeof body.profile_id === "string" ? body.profile_id : null,
        display_name: typeof body.display_name === "string" ? body.display_name : "",
        position: typeof body.position === "string" ? body.position : "",
        category: cat,
        source: "org",
        created_by_email: submittedBy,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create credit.";
      error(400, msg);
    }
  }

  return json(await loadProductionCredits(params.id));
};
