// Shared validator for edit-profile magic-link tokens. Used by the
// /edit/[token] page actions and the /api/edit/[token]/* endpoints
// that the new multi-resume builder calls live as the artist works.
//
// Crucially: validation does NOT burn the token. The token is only
// burned by the main /edit/[token] form submit (single-use commits).
// Live API calls re-validate the same token N times.

import { supabaseAdmin } from "$lib/server/supabase";
import { hashToken } from "$lib/server/tokens";

export type EditTokenRecord = {
  id: string;
  email: string | null;
  target_id: string;
  expires_at: string;
};

export async function validateEditToken(rawToken: string): Promise<EditTokenRecord | null> {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = hashToken(rawToken);
  const { data } = await supabaseAdmin
    .from("magic_link_tokens")
    .select("id, email, target_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .eq("purpose", "edit_profile")
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
