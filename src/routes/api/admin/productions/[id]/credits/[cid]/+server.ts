// PATCH /api/admin/productions/[id]/credits/[cid] - update one credit
//   (position, sort, link/unlink to a profile, change category).
// DELETE /api/admin/productions/[id]/credits/[cid] - delete the credit
//   (soft-by-hand-delete, since the linked resume row gets converted
//   to source='hand' before the row is removed).

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import {
  deleteProductionCredit,
  loadProductionCredits,
  trimName,
  trimPosition,
  isCategory,
  updateProductionCreditPosition,
} from "$lib/server/productionCredits";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  const body = (await request.json().catch(() => ({}))) as {
    display_name?: unknown;
    position?: unknown;
    category?: unknown;
    profile_id?: unknown;
    sort_order?: unknown;
  };
  const update: Record<string, unknown> = {};
  if (typeof body.display_name === "string") update.display_name = trimName(body.display_name);
  if (typeof body.category === "string" && isCategory(body.category)) {
    update.category = body.category;
  }
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
    update.sort_order = Math.max(0, Math.floor(body.sort_order));
  }
  if (body.profile_id === null || typeof body.profile_id === "string") {
    update.profile_id = (body.profile_id as string | null) || null;
  }

  // Position changes are special - they cascade into the linked
  // resume_entries row's role. Run them through the dedicated helper
  // so the cascade happens.
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

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  await deleteProductionCredit(params.cid);
  return json(await loadProductionCredits(params.id));
};
