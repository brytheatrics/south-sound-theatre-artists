// /org-edit/[token]: landing page for an org rep using an org-edit
// magic link. Lists the organization's productions with a per-row
// "Manage credits" link. Token is validated but not burned.

import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { validateOrgEditToken } from "$lib/server/editToken";

export const load: PageServerLoad = async ({ params }) => {
  const token = await validateOrgEditToken(params.token);
  if (!token) error(404, "Edit link is invalid or expired.");
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, name, slug")
    .eq("id", token.target_id)
    .maybeSingle();
  if (!org) error(404, "Organization not found.");

  const { data: productions } = await supabaseAdmin
    .from("productions")
    .select("id, title, run_start, run_end, status")
    .eq("organization_id", org.id)
    .is("deleted_at", null)
    .order("run_start", { ascending: false });

  return { org, productions: productions ?? [] };
};
