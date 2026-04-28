// Apply for verified theatre organization status. Creates a row in
// verified_orgs with verified=false; admin approves at /admin/orgs.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();

    // Honeypot
    if ((data.get("website_url_extra") as string)?.trim()) {
      throw redirect(303, "/callboard/apply-verified/thanks");
    }

    const name = ((data.get("name") as string) ?? "").trim();
    const contactName = ((data.get("contact_name") as string) ?? "").trim();
    const contactEmail = ((data.get("contact_email") as string) ?? "").trim().toLowerCase();
    const websiteUrl = ((data.get("website_url") as string) ?? "").trim();
    const description = ((data.get("description") as string) ?? "").trim();

    const errors: Record<string, string> = {};
    if (!name) errors.name = "Required.";
    if (!contactName) errors.contact_name = "Required.";
    if (!isValidEmail(contactEmail)) errors.contact_email = "Enter a valid email address.";
    if (websiteUrl && !isValidUrl(websiteUrl)) errors.website_url = "Must be a valid URL.";

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, values: { name, contactName, contactEmail, websiteUrl, description } });
    }

    const { error: insertErr } = await supabaseAdmin.from("verified_orgs").insert({
      name,
      contact_email: contactEmail,
      website_url: websiteUrl || null,
      description: description || null,
      verified: false,
    });

    if (insertErr) {
      console.error("verified_orgs insert failed", insertErr);
      return fail(500, {
        errors: { _form: "Could not save your application. Please try again." } as Record<string, string>,
        values: { name, contactName, contactEmail, websiteUrl, description },
      });
    }

    await sendEmail({
      to: contactEmail,
      templateSlug: "org_application_received",
      vars: { name: contactName },
    });

    throw redirect(303, "/callboard/apply-verified/thanks");
  },
};
