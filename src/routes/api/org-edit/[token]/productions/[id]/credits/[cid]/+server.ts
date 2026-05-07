// PATCH/DELETE /api/org-edit/[token]/productions/[id]/credits/[cid]

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { validateOrgEditToken } from "$lib/server/editToken";
import {
  deleteProductionCredit,
  loadProductionCredits,
  trimName,
  isCategory,
  updateProductionCreditPosition,
} from "$lib/server/productionCredits";

async function assertOwnership(productionId: string, orgId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("productions")
    .select("organization_id")
    .eq("id", productionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) error(404, "Production not found.");
  if (data.organization_id !== orgId) error(403, "Not your production.");
}

export const PATCH: RequestHandler = async ({ params, request }) => {
  const token = await validateOrgEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  await assertOwnership(params.id, token.target_id);

  const body = (await request.json().catch(() => ({}))) as {
    display_name?: unknown;
    position?: unknown;
    category?: unknown;
    profile_id?: unknown;
    sort_order?: unknown;
  };
  const update: Record<string, unknown> = {};
  if (typeof body.display_name === "string") update.display_name = trimName(body.display_name);
  if (typeof body.category === "string" && isCategory(body.category)) update.category = body.category;
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
    update.sort_order = Math.max(0, Math.floor(body.sort_order));
  }
  if (body.profile_id === null || typeof body.profile_id === "string") {
    update.profile_id = (body.profile_id as string | null) || null;
  }

  if (typeof body.position === "string") {
    try {
      await updateProductionCreditPosition(params.cid, body.position);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update position.";
      error(400, msg);
    }
  }
  if (Object.keys(update).length > 0) {
    const { error: updErr } = await supabaseAdmin
      .from("production_credits")
      .update(update)
      .eq("id", params.cid)
      .eq("production_id", params.id);
    if (updErr) error(500, "Could not update credit.");
  }
  return json(await loadProductionCredits(params.id));
};

export const DELETE: RequestHandler = async ({ params }) => {
  const token = await validateOrgEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  await assertOwnership(params.id, token.target_id);
  await deleteProductionCredit(params.cid);
  return json(await loadProductionCredits(params.id));
};
