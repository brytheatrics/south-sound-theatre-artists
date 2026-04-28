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

export const load: PageServerLoad = async ({ params }) => {
  const { data, error: err } = await supabaseAdmin
    .from("profiles")
    .select(
      `slug, full_name, pronouns, bio, disciplines, geographic_area, city,
       playable_age_min, playable_age_max, languages, unions, ethnicities,
       headshot_url, instagram_handle, facebook_url, tiktok_handle,
       linkedin_url, twitter_handle, youtube_url, website_url, member_since,
       updated_at`,
    )
    .eq("slug", params.slug)
    .eq("published", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (err) throw err;
  if (!data) error(404, "Profile not found");
  return { profile: data };
};

export const actions: Actions = {
  contact: async ({ params, request }) => {
    const data = await request.formData();
    if ((data.get("website_url_extra") as string)?.trim()) {
      // Honeypot: pretend success.
      return { sent: true };
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
