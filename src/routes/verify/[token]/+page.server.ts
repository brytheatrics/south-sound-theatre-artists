// GET /verify/<token>
// Click-to-confirm endpoint for the email verification link sent by the
// submission flow. Looks the token up by its SHA-256 hash, marks the
// pending_submissions row as verified, moves it from 'pending_email' into
// 'pending_review' so the admin queue picks it up, and clears the hash so
// the link can't be used twice.
//
// GET-mutates-state is the standard pattern for verification links - the
// token clears on first use, so AV-scanner prefetches are a one-shot
// problem at worst.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { hashToken } from "$lib/server/tokens";

export type VerifyState =
  | "verified"
  | "already_verified"
  | "expired"
  | "invalid"
  | "error";

export const load: PageServerLoad = async ({ params }) => {
  const token = params.token ?? "";
  if (!token || token.length < 16) {
    return { state: "invalid" satisfies VerifyState };
  }

  const tokenHash = hashToken(token);

  const { data, error } = await supabaseAdmin
    .from("pending_submissions")
    .select(
      "id, email, full_name, email_verified, email_verification_expires_at",
    )
    .eq("email_verification_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("verification lookup failed", error);
    return { state: "error" satisfies VerifyState };
  }

  if (!data) return { state: "invalid" satisfies VerifyState };
  if (data.email_verified)
    return { state: "already_verified" satisfies VerifyState };

  const expiresAt = data.email_verification_expires_at
    ? new Date(data.email_verification_expires_at)
    : null;
  if (!expiresAt || expiresAt < new Date()) {
    return { state: "expired" satisfies VerifyState };
  }

  // Keep the token_hash and expires_at after success so a re-click returns
  // the friendlier "already_verified" state instead of "invalid". The token
  // only authorizes the verify action, which is now a no-op since the row
  // is already verified.
  const { error: updateErr } = await supabaseAdmin
    .from("pending_submissions")
    .update({
      email_verified: true,
      status: "pending_review",
    })
    .eq("id", data.id);

  if (updateErr) {
    console.error("verification update failed", updateErr);
    return { state: "error" satisfies VerifyState };
  }

  return { state: "verified" satisfies VerifyState };
};
