// POST /api/admin/productions/[id]/credits/match
// Body: { name }
// Returns up to 5 best-match published artist profiles for the given
// name. Used by the admin credits editor + paste-cast UI to surface a
// "did you mean ___?" link suggestion for each unmatched display name.

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { findProfileMatches } from "$lib/server/productionCredits";

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name : "";
  return json({ matches: await findProfileMatches(name, 5) });
};
