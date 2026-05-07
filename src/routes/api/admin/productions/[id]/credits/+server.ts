// POST /api/admin/productions/[id]/credits - create one or many credits
//   for a production. Body shapes:
//     { display_name, position, category, profile_id? }    - single
//     { paste, category }                                  - bulk paste
//   For paste mode, each non-empty line in `paste` is run through the
//   cast-list parser; lines with empty positions are still inserted so
//   the admin can fix them in-line.
//
// GET /api/admin/productions/[id]/credits - return the current credits
//   snapshot for the production (used after mutations).

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  createProductionCredit,
  loadProductionCredits,
  parseCastList,
  isCategory,
} from "$lib/server/productionCredits";
import type { ProductionCreditCategory } from "$lib/server/productionCredits";

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  return json(await loadProductionCredits(params.id));
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
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
          source: "admin",
        });
      } catch (err) {
        console.error("paste-cast insert failed", err);
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
        source: "admin",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create credit.";
      error(400, msg);
    }
  }

  return json(await loadProductionCredits(params.id));
};
