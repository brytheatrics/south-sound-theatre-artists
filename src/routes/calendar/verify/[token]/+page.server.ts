// /calendar/verify/[token]: validates the verification link emailed at
// submission time. Mirrors the callboard verify pattern. On success:
//   - Verified-org submissions go straight to status='approved'
//   - Everyone else lands at status='pending_review' for admin queue
// Token is one-time-use. After redemption it's cleared so a stolen link
// can't be replayed.

import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { supabaseAdmin } from "$lib/server/supabase";
import { hashToken } from "$lib/server/tokens";

export const load: PageServerLoad = async ({ params }) => {
  const token = params.token;
  if (!token || token.length < 16) throw error(400, "Invalid verification link.");

  const tokenHash = hashToken(token);

  const { data: row, error: lookupErr } = await supabaseAdmin
    .from("productions")
    .select(
      `id, title, organization_name, status, verified_org_id,
       email_verification_expires_at`,
    )
    .eq("email_verification_token_hash", tokenHash)
    .maybeSingle();

  if (lookupErr || !row) throw error(404, "This verification link is invalid or already used.");

  // Already-verified case: the token gets cleared on redemption, so
  // hitting this branch means the row exists but the token is fresh -
  // i.e. status is still pending_email. Anything else means the token
  // has been redeemed.
  if (row.status !== "pending_email") {
    return {
      alreadyVerified: true,
      title: row.title,
      verifiedOrg: row.verified_org_id !== null,
    };
  }

  if (
    row.email_verification_expires_at &&
    new Date(row.email_verification_expires_at) < new Date()
  ) {
    throw error(410, "This verification link has expired. Please submit again.");
  }

  // Verified-org auto-publish: skip review.
  const newStatus = row.verified_org_id ? "approved" : "pending_review";

  await supabaseAdmin
    .from("productions")
    .update({
      status: newStatus,
      email_verification_token_hash: null,
      email_verification_expires_at: null,
      reviewed_at: newStatus === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", row.id);

  return {
    verified: true,
    title: row.title,
    verifiedOrg: row.verified_org_id !== null,
    autoApproved: newStatus === "approved",
  };
};
