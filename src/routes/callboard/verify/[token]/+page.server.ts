// GET /callboard/verify/<token>
// Email confirmation for callboard post submissions. Looks up the post
// by token hash, advances the status, and creates a productions row for
// audition / production posts from verified orgs that go live immediately.

import type { PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { hashToken } from "$lib/server/tokens";
import { sendEmail } from "$lib/server/email";

export type VerifyState =
  | "verified_pending"
  | "verified_live"
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

  const { data: post, error } = await supabaseAdmin
    .from("callboard_posts")
    .select(
      `id, title, organization_name, submitter_email, status,
       organization_id, post_type, location, show_dates, ticket_url,
       email_verification_expires_at`,
    )
    .eq("email_verification_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("callboard verify lookup failed", error);
    return { state: "error" satisfies VerifyState };
  }
  if (!post) return { state: "invalid" satisfies VerifyState };

  // Already past pending_email → idempotent re-click.
  if (post.status !== "pending_email") {
    return { state: "already_verified" satisfies VerifyState };
  }

  const expiresAt = post.email_verification_expires_at
    ? new Date(post.email_verification_expires_at)
    : null;
  if (!expiresAt || expiresAt < new Date()) {
    return { state: "expired" satisfies VerifyState };
  }

  // Determine if this post should go live immediately (verified org) or
  // enter the admin review queue.
  // organization_id is set at submit-time only when the submitter
  // email matched a verified org, so its presence implies "verified".
  const isVerifiedOrg = !!post.organization_id;
  const newStatus = isVerifiedOrg ? "approved" : "pending_review";
  const goesLive = isVerifiedOrg;

  const { error: updateErr } = await supabaseAdmin
    .from("callboard_posts")
    .update({
      status: newStatus,
      published: goesLive,
      reviewed_at: goesLive ? new Date().toISOString() : null,
    })
    .eq("id", post.id);

  if (updateErr) {
    console.error("callboard verify update failed", updateErr);
    return { state: "error" satisfies VerifyState };
  }

  // For approved audition / production posts, create a productions row.
  if (goesLive && (post.post_type === "audition" || post.post_type === "production")) {
    await supabaseAdmin.from("productions").insert({
      callboard_post_id: post.id,
      title: post.title,
      organization_name: post.organization_name,
      location: post.location ?? null,
      ticket_url: post.ticket_url ?? null,
    });
  }

  // Send confirmation email.
  const callboardUrl = `${PUBLIC_SITE_URL}/callboard`;
  if (goesLive) {
    await sendEmail({
      to: post.submitter_email,
      templateSlug: "callboard_approved",
      vars: {
        name: post.organization_name,
        title: post.title,
        callboard_url: callboardUrl,
      },
    });
  }

  return {
    state: goesLive
      ? ("verified_live" satisfies VerifyState)
      : ("verified_pending" satisfies VerifyState),
  };
};
