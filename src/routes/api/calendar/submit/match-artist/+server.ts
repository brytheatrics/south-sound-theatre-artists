// GET /api/calendar/submit/match-artist?q=<query>
//
// Public artist-name autocomplete for the cast/creative section of
// the calendar submit form. Returns up to 5 matching published
// profiles. Same fuzzy-match scoring as the admin "Find profile"
// button (production credits editor).
//
// Public endpoint by design: the artist directory is public anyway,
// so exposing fuzzy match doesn't leak anything new. Rate-limit is
// implicit via the upstream submit form's per-IP cooldown.

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { findProfileMatches } from "$lib/server/productionCredits";

export const GET: RequestHandler = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return json({ matches: [] });
  const matches = await findProfileMatches(q, 5);
  return json({
    matches: matches.map((m) => ({
      id: m.id,
      slug: m.slug,
      full_name: m.full_name,
    })),
  });
};
