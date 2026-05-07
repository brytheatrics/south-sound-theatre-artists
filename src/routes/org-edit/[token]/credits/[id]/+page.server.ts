// /org-edit/[token]/credits/[id]: per-production credits editor for
// an org rep. Validates the token, ensures the production belongs to
// the org the token was issued for, then renders ProductionCreditsEditor.

import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { validateOrgEditToken } from "$lib/server/editToken";
import { loadProductionCredits } from "$lib/server/productionCredits";

export const load: PageServerLoad = async ({ params }) => {
  const token = await validateOrgEditToken(params.token);
  if (!token) error(404, "Edit link is invalid or expired.");
  const { data: production } = await supabaseAdmin
    .from("productions")
    .select("id, title, run_start, run_end, organization_id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!production) error(404, "Production not found.");
  if (production.organization_id !== token.target_id) {
    error(403, "This edit link doesn't cover that production.");
  }
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("name")
    .eq("id", token.target_id)
    .maybeSingle();
  const credits = await loadProductionCredits(params.id);
  return { production, org, credits };
};
