// /artists/[slug]: public profile page + contact form action.
//
// The artist's real email is never returned to the browser. The contact
// form posts to a server action, which checks email_blocklist (silent
// success on a block) and routes the message via the Resend wrapper using
// the contact_routed template.

import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { checkSubmitRateLimit, RATE_LIMIT_MESSAGE } from "$lib/server/rate-limit";
import { loadProfileResumes } from "$lib/server/resumes";
import { loadCurrentAppearances } from "$lib/server/productionCredits";
import { buildOgCardUrl } from "$lib/server/cloudinary";
import { CACHE_MEDIUM } from "$lib/server/cache-headers";

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
  const isAdmin = !!locals.admin;
  // Cache for public visitors only - admins see extra fields (incomplete
  // profile pre-publish, admin note) and should always get a fresh render.
  if (!isAdmin) setHeaders({ "cache-control": CACHE_MEDIUM });
  let query = supabaseAdmin
    .from("profiles")
    .select(
      `id, slug, full_name, pronouns, bio, disciplines, geographic_area, city,
       resumes, mentorship_offering, mentorship_seeking,
       playable_age_min, playable_age_max, languages, unions, ethnicities,
       headshot_url, instagram_handle, facebook_url, tiktok_handle,
       linkedin_url, twitter_handle, youtube_url, website_url, member_since,
       updated_at, published, is_minor, guardian_name`,
    )
    .eq("slug", params.slug)
    .is("deleted_at", null);
  // Public visitors only see published profiles. Admins see hidden
  // drafts too, so they can preview + edit a row that hasn't gone
  // live yet from the same URL the visitor would eventually use.
  if (!isAdmin) query = query.eq("published", true);
  const { data, error: err } = await query.maybeSingle();
  if (err) throw err;
  if (!data) error(404, "Profile not found");

  const [resumeSnapshot, currentAppearances] = await Promise.all([
    loadProfileResumes(data.id),
    loadCurrentAppearances(data.id),
  ]);
  // Per-profile OG / social-share card. Falls back to null when the
  // headshot isn't Cloudinary-hosted; the page renders the generic
  // og:image (or none) in that case.
  const ogCardUrl = data.is_minor
    ? null // never expose a minor's headshot, even via OG card
    : buildOgCardUrl({
        headshotUrl: data.headshot_url,
        name: data.full_name,
        primaryDiscipline: data.disciplines?.[0] ?? null,
      });
  return { profile: data, resumeSnapshot, currentAppearances, ogCardUrl };
};

export const actions: Actions = {
  contact: async ({ params, request, getClientAddress }) => {
    const data = await request.formData();
    if ((data.get("website_url_extra") as string)?.trim()) {
      // Honeypot: pretend success.
      return { sent: true };
    }

    // Per-IP cooldown. Limits a single bad actor flooding contact-form
    // messages to artists; honest senders are far below the threshold.
    const rl = await checkSubmitRateLimit(
      getClientAddress(),
      "contact_artist",
    );
    if (!rl.ok) {
      return fail(429, { error: RATE_LIMIT_MESSAGE });
    }

    const senderName = ((data.get("sender_name") as string) ?? "").trim();
    const senderEmail = ((data.get("sender_email") as string) ?? "")
      .trim()
      .toLowerCase();
    const message = ((data.get("message") as string) ?? "").trim();

    const errors: Record<string, string> = {};
    if (!senderName) errors.sender_name = "Required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail))
      errors.sender_email = "Enter a valid email.";
    if (message.length < 10)
      errors.message = "Message is too short - tell them what you're after.";
    if (message.length > 5000)
      errors.message = "Message is too long.";

    if (Object.keys(errors).length > 0) {
      return fail(400, {
        errors,
        values: { senderName, senderEmail, message },
      });
    }

    // Blocklist: silent success.
    const { data: blocked } = await supabaseAdmin
      .from("email_blocklist")
      .select("email")
      .eq("email", senderEmail)
      .maybeSingle();
    if (blocked) return { sent: true };

    // Look up the artist's actual email + name.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("slug", params.slug)
      .eq("published", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (!profile) return fail(404, { errors: { _form: "Profile not found." } });

    const result = await sendEmail({
      to: profile.email,
      replyTo: senderEmail,
      templateSlug: "contact_routed",
      vars: {
        recipient_name: profile.full_name,
        sender_name: senderName,
        sender_email: senderEmail,
        message,
      },
    });

    if (!result.ok) {
      console.error("contact email failed", result.reason);
      return fail(500, {
        errors: { _form: "Could not deliver the message. Try again later." },
      });
    }
    return { sent: true };
  },
};
