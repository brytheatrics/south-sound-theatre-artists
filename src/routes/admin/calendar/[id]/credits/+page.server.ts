// /admin/calendar/[id]/credits: dedicated admin page for tagging the
// cast / production on a production. Uses the live API endpoints
// at /api/admin/productions/[id]/credits/* via ProductionCreditsEditor.

import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { loadProductionCredits } from "$lib/server/productionCredits";

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  const { data: production } = await supabaseAdmin
    .from("productions")
    .select(
      `id, title, run_start, run_end, status,
       organizations:organization_id ( name, slug )`,
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!production) error(404, "Production not found.");
  const credits = await loadProductionCredits(params.id);
  return { production, credits };
};
