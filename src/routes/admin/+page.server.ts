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

const EDIT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async () => {
  const { data, error } = await supabaseAdmin
    .from("pending_submissions")
    .select(
      `id, email, full_name, pronouns, bio, disciplines, headshot_url,
       headshot_consent, geographic_area, city, playable_age_min,
       playable_age_max, languages, unions, instagram_handle, facebook_url,
       tiktok_handle, linkedin_url, twitter_handle, youtube_url,
       website_url, desired_slug, ethnicities, created_at`,
    )
    .eq("status", "pending_review")
    .eq("email_verified", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return { submissions: data ?? [] };
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
      published: true,
    })
    .select("id, slug")
    .single();
  if (insertErr || !profile) {
    console.error("approve: profile insert failed", insertErr);
    return { id, ok: false, reason: "insert_failed" };
  }

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
