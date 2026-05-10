// /admin (pending queue): lists email-verified submissions that are
// waiting for admin review. Approve copies the row into profiles + emails
// the artist a welcome message with a single-use edit link. Reject takes
// a typed reason and emails the artist with it.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { generateToken, hashToken } from "$lib/server/tokens";
import { expandLegacyResumeData } from "$lib/server/resumes";

const EDIT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async () => {
  const [submissionsRes, awaitingRes, dismissedRes, callboardCountRes, orgsCountRes] =
    await Promise.all([
      supabaseAdmin
        .from("pending_submissions")
        .select(
          `id, email, full_name, pronouns, bio, disciplines, headshot_url,
           headshot_consent, geographic_area, city, resumes, resume_data,
           mentorship_offering, mentorship_seeking,
           playable_age_min, playable_age_max, languages, unions,
           instagram_handle, facebook_url, tiktok_handle, linkedin_url,
           twitter_handle, youtube_url, website_url, desired_slug, ethnicities,
           is_minor, guardian_email, guardian_name, created_at`,
        )
        .eq("status", "pending_review")
        .eq("email_verified", true)
        .order("created_at", { ascending: true }),
      // Floating submissions: submitted but never clicked the email
      // verification link. Surface them so Lexi can resend the
      // verification email if the original got eaten by spam.
      // Dismissed rows hide from this list and live in dismissedRes
      // below until they're either restored or hard-deleted.
      supabaseAdmin
        .from("pending_submissions")
        .select(
          "id, email, full_name, disciplines, geographic_area, created_at, email_verification_expires_at",
        )
        .eq("status", "pending_email")
        .is("dismissed_at", null)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("pending_submissions")
        .select(
          "id, email, full_name, disciplines, geographic_area, created_at, dismissed_at",
        )
        .eq("status", "pending_email")
        .not("dismissed_at", "is", null)
        .order("dismissed_at", { ascending: false }),
      supabaseAdmin
        .from("callboard_posts")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_review")
        .is("deleted_at", null),
      // Pending verification = orgs that applied via apply-verified
      // (contact_email set) but haven't been verified yet. Filtering on
      // contact_email NOT null keeps imported calendar-source rows out
      // of the count.
      supabaseAdmin
        .from("organizations")
        .select("*", { count: "exact", head: true })
        .eq("verified", false)
        .not("contact_email", "is", null)
        .is("deleted_at", null),
    ]);
  if (submissionsRes.error) throw submissionsRes.error;
  if (awaitingRes.error) throw awaitingRes.error;
  if (dismissedRes.error) throw dismissedRes.error;
  return {
    submissions: submissionsRes.data ?? [],
    awaitingVerification: awaitingRes.data ?? [],
    dismissedAwaiting: dismissedRes.data ?? [],
    callboardPendingCount: callboardCountRes.count ?? 0,
    orgsPendingCount: orgsCountRes.count ?? 0,
  };
};

export const actions: Actions = {
  approve: async ({ request }) => {
    const data = await request.formData();
    // APIs accept arrays from day one - even when called with one ID.
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });

    const results: Array<{ id: string; ok: boolean; reason?: string }> = [];
    for (const id of ids) {
      const result = await approveOne(id);
      results.push(result);
    }
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      return fail(500, {
        error: `${failed.length} of ${results.length} approvals failed: ${failed
          .map((f) => f.reason)
          .join("; ")}`,
      });
    }
    return { approved: results.length };
  },

  reject: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    const reason = ((data.get("reason") as string) ?? "").trim();
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    if (!reason) {
      return fail(400, { error: "Tell the submitter why - this goes in the email." });
    }

    for (const id of ids) {
      await rejectOne(id, reason);
    }
    return { rejected: ids.length };
  },

  // Resend the email-verification link for a 'pending_email' submission.
  // Mints a fresh 24h verification token, overwrites the row's existing
  // hash + expiry (the old link becomes invalid), and re-fires the
  // email_verification template so it lands in the artist's inbox.
  // Useful when the original verification email got eaten by spam, the
  // artist's address had a typo, or they just took longer than 24h.
  resendVerification: async ({ request }) => {
    const data = await request.formData();
    const id = ((data.get("id") as string) ?? "").trim();
    if (!id) return fail(400, { error: "Missing id." });

    const { data: sub } = await supabaseAdmin
      .from("pending_submissions")
      .select("id, email, full_name, status")
      .eq("id", id)
      .maybeSingle();
    if (!sub) return fail(404, { error: "Submission not found." });
    if (sub.status !== "pending_email") {
      return fail(400, {
        error: `Already past the verification stage (status=${sub.status}).`,
      });
    }

    const newToken = generateToken();
    const newHash = hashToken(newToken);
    const newExpires = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from("pending_submissions")
      .update({
        email_verification_token_hash: newHash,
        email_verification_expires_at: newExpires,
      })
      .eq("id", id);
    if (updateErr) {
      return fail(500, { error: "Could not refresh the verification token." });
    }

    const verifyUrl = `${PUBLIC_SITE_URL}/verify/${newToken}`;
    const sendResult = await sendEmail({
      to: sub.email,
      templateSlug: "email_verification",
      vars: { name: sub.full_name, verify_url: verifyUrl },
    });
    if (!sendResult.ok) {
      console.error(
        `resendVerification email failed for ${sub.email}: ${sendResult.reason}`,
      );
      return fail(500, {
        error:
          "Refreshed the token but the email didn't send. Check the email log.",
      });
    }
    return { resentTo: sub.email };
  },

  // Hide one or more pending_email rows from the main awaiting list.
  // Stamps dismissed_at; the row still exists and can be restored from
  // the Dismissed sub-panel, or hard-deleted from there if it's spam.
  dismissAwaiting: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("pending_submissions")
      .update({ dismissed_at: new Date().toISOString() })
      .in("id", ids)
      .eq("status", "pending_email");
    if (error) return fail(500, { error: "Could not dismiss." });
    return { dismissed: ids.length };
  },

  // Move a dismissed row back onto the main awaiting list.
  restoreAwaiting: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("pending_submissions")
      .update({ dismissed_at: null })
      .in("id", ids)
      .eq("status", "pending_email");
    if (error) return fail(500, { error: "Could not restore." });
    return { restored: ids.length };
  },

  // Hard-delete pending_email rows. For obvious spam - the row is gone,
  // not soft-deleted, since the goal is to keep the table clean. The
  // submitter never verified their email, so there's no risk of orphaned
  // tokens or downstream references.
  deleteAwaiting: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("pending_submissions")
      .delete()
      .in("id", ids)
      .eq("status", "pending_email");
    if (error) return fail(500, { error: "Could not delete." });
    return { deleted: ids.length };
  },
};

async function approveOne(
  id: string,
): Promise<{ id: string; ok: boolean; reason?: string }> {
  const { data: sub, error: subErr } = await supabaseAdmin
    .from("pending_submissions")
    .select("*")
    .eq("id", id)
    .eq("status", "pending_review")
    .maybeSingle();
  if (subErr || !sub) return { id, ok: false, reason: "submission_not_found" };

  // Final slug collision check at approval time (state may have changed
  // since submission).
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("slug")
    .eq("slug", sub.desired_slug)
    .maybeSingle();
  if (existing) {
    return { id, ok: false, reason: `slug "${sub.desired_slug}" is already taken` };
  }

  const { data: profile, error: insertErr } = await supabaseAdmin
    .from("profiles")
    .insert({
      slug: sub.desired_slug,
      full_name: sub.full_name,
      bio: sub.bio,
      disciplines: sub.disciplines,
      headshot_url: sub.headshot_url,
      headshot_consent: sub.headshot_consent,
      geographic_area: sub.geographic_area,
      city: sub.city,
      resumes: sub.resumes ?? [],
      mentorship_offering: sub.mentorship_offering ?? [],
      mentorship_seeking: sub.mentorship_seeking ?? [],
      playable_age_min: sub.playable_age_min,
      playable_age_max: sub.playable_age_max,
      languages: sub.languages,
      unions: sub.unions,
      instagram_handle: sub.instagram_handle,
      facebook_url: sub.facebook_url,
      tiktok_handle: sub.tiktok_handle,
      linkedin_url: sub.linkedin_url,
      twitter_handle: sub.twitter_handle,
      youtube_url: sub.youtube_url,
      website_url: sub.website_url,
      pronouns: sub.pronouns,
      ethnicities: sub.ethnicities,
      email: sub.email,
      // Phone is private (never rendered publicly) and optional. Carries
      // through the submit -> verify -> approve pipeline via this column
      // so artists who entered one don't have to re-enter on first edit.
      phone: sub.phone ?? null,
      // Carry the minor / guardian flags through so the profile renders
      // correctly (suppressed headshot, contact-form notice, admin badge).
      is_minor: sub.is_minor ?? false,
      guardian_email: sub.guardian_email ?? null,
      guardian_name: sub.guardian_name ?? null,
      published: true,
    })
    .select("id, slug")
    .single();
  if (insertErr || !profile) {
    console.error("approve: profile insert failed", insertErr);
    return { id, ok: false, reason: "insert_failed" };
  }

  // Expand the submission's legacy resume_data jsonb into the new
  // relational tables (mig 078). pending_submissions still uses jsonb;
  // profiles now use resumes + resume_entries.
  await expandLegacyResumeData(profile.id, sub.resume_data);

  await supabaseAdmin
    .from("pending_submissions")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", id);

  // Single-use edit link.
  const editToken = generateToken();
  const editHash = hashToken(editToken);
  const editExpires = new Date(Date.now() + EDIT_TOKEN_TTL_MS).toISOString();
  await supabaseAdmin.from("magic_link_tokens").insert({
    token_hash: editHash,
    email: sub.email.toLowerCase(),
    purpose: "edit_profile",
    target_id: profile.id,
    expires_at: editExpires,
  });

  const profileUrl = `${PUBLIC_SITE_URL}/artists/${profile.slug}`;
  const editUrl = `${PUBLIC_SITE_URL}/edit/${editToken}`;
  const sendResult = await sendEmail({
    to: sub.email,
    templateSlug: "welcome",
    vars: { name: sub.full_name, profile_url: profileUrl, edit_url: editUrl },
  });
  if (!sendResult.ok) {
    console.error(
      `approve email failed for ${sub.email}: ${sendResult.reason}`,
    );
  }

  return { id, ok: true };
}

async function rejectOne(id: string, reason: string): Promise<void> {
  const { data: sub } = await supabaseAdmin
    .from("pending_submissions")
    .select("email, full_name")
    .eq("id", id)
    .maybeSingle();
  if (!sub) return;

  await supabaseAdmin
    .from("pending_submissions")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  await sendEmail({
    to: sub.email,
    templateSlug: "rejection",
    vars: { name: sub.full_name, reason },
  });
}
