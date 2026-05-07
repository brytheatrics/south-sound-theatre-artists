// Shared validators for magic-link tokens. Used by the /edit/[token] +
// /org-edit/[token] page actions and the matching /api/* endpoints
// that the multi-resume builder + production credits editors call as
// the user works.
//
// Crucially: validation does NOT burn the token. The token is only
// burned by an explicit "I'm done editing" event (e.g. the main
// /edit/[token] form submit). Live API calls re-validate the same
// token N times.

import { supabaseAdmin } from "$lib/server/supabase";
import { hashToken } from "$lib/server/tokens";

export type EditTokenRecord = {
  id: string;
  email: string | null;
  target_id: string;
  expires_at: string;
};

async function validate(rawToken: string, purpose: string): Promise<EditTokenRecord | null> {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = hashToken(rawToken);
  const { data } = await supabaseAdmin
    .from("magic_link_tokens")
    .select("id, email, target_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .eq("purpose", purpose)
    .maybeSingle();
  if (!data) return null;
  if (data.used_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  if (!data.target_id) return null;
  return {
    id: data.id,
    email: data.email,
    target_id: data.target_id,
    expires_at: data.expires_at,
  };
}

export function validateEditToken(rawToken: string): Promise<EditTokenRecord | null> {
  return validate(rawToken, "edit_profile");
}

/** Org-edit tokens grant a verified org rep the ability to manage
 *  cast / creative / crew credits on the productions belonging to a
 *  specific organization (target_id = organization.id). Issued from
 *  /admin/organizations by Lexi and shared with the rep out of band. */
export function validateOrgEditToken(rawToken: string): Promise<EditTokenRecord | null> {
  return validate(rawToken, "org_edit");
}
