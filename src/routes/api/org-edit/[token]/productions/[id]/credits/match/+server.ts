// POST /api/org-edit/[token]/productions/[id]/credits/match
// Org-side fuzzy name matcher for the credits editor "Find profile" button.

import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { validateOrgEditToken } from "$lib/server/editToken";
import { findProfileMatches } from "$lib/server/productionCredits";

export const POST: RequestHandler = async ({ params, request }) => {
  const token = await validateOrgEditToken(params.token);
  if (!token) error(401, "Edit link is invalid or expired.");
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name : "";
  return json({ matches: await findProfileMatches(name, 5) });
};
