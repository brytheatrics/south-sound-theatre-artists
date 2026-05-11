// Public site-wide contact form. Routes to per-category recipients in
// contact_categories. Submissions land in contact_submissions for the
// admin queue at /admin/contact, and a notification email goes to the
// category's primary + cc list.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { checkSubmitRateLimit, RATE_LIMIT_MESSAGE } from "$lib/server/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const load: PageServerLoad = async () => {
  const { data: categories, error } = await supabaseAdmin
    .from("contact_categories")
    .select("slug, label, description")
    .order("sort_order");
  if (error) throw error;
  return { categories: categories ?? [] };
};

export const actions: Actions = {
  default: async ({ request, getClientAddress }) => {
    const data = await request.formData();

    if ((data.get("website_url_extra") as string)?.trim()) {
      throw redirect(303, "/contact/thanks");
    }

    const rl = await checkSubmitRateLimit(getClientAddress(), "contact");
    if (!rl.ok) {
      return fail(429, { error: RATE_LIMIT_MESSAGE });
    }

    const category = ((data.get("category") as string) ?? "").trim();
    const name = ((data.get("name") as string) ?? "").trim();
    const email = ((data.get("email") as string) ?? "").trim().toLowerCase();
    const message = ((data.get("message") as string) ?? "").trim();

    const values = { category, name, email, message };
    const errors: Record<string, string> = {};
    if (!category) errors.category = "Pick a category.";
    if (!name) errors.name = "Required.";
    if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email.";
    if (!message || message.length < 5) errors.message = "Add a few words about what you need.";
    if (message.length > 5000) errors.message = "Keep it under 5000 characters.";

    let cat:
      | { slug: string; label: string; primary_email: string; cc_emails: string[] }
      | null = null;
    if (category && !errors.category) {
      const { data: row } = await supabaseAdmin
        .from("contact_categories")
        .select("slug, label, primary_email, cc_emails")
        .eq("slug", category)
        .maybeSingle();
      if (!row) errors.category = "That category isn't available.";
      else cat = row;
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, values });
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("contact_submissions")
      .insert({
        category_slug: category,
        name,
        email,
        message,
        status: "new",
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      console.error("contact_submissions insert failed", insErr);
      return fail(500, {
        errors: { _form: "Couldn't save your message. Please try again." },
        values,
      });
    }

    if (cat) {
      const adminUrl = `${PUBLIC_SITE_URL}/admin/contact/${inserted.id}`;
      const submittedAt = new Date().toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
      });
      const recipients = [cat.primary_email, ...(cat.cc_emails ?? [])].filter(Boolean);
      for (const to of recipients) {
        await sendEmail({
          to,
          replyTo: email,
          templateSlug: "contact_submission",
          vars: {
            category_label: cat.label,
            name,
            email,
            submitted_at: submittedAt,
            message,
            admin_url: adminUrl,
          },
        });
      }
    }

    throw redirect(303, "/contact/thanks");
  },
};
