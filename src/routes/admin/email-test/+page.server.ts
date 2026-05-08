// TEMPORARY (delete before launch). /admin/email-test - admin-only
// page that lists every email_templates row and lets the admin
// trigger a real send through sendEmail() with sensible test vars +
// real tokens for click-through validation. Recipient is hard-coded
// to TEST_RECIPIENT in src/lib/server/test-email.ts.

import { fail, error } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendTestEmail, TEST_RECIPIENT } from "$lib/server/test-email";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.admin) error(401, "Admin only.");

  const { data: templates } = await supabaseAdmin
    .from("email_templates")
    .select("slug, audience, subject")
    .order("slug");

  return {
    templates: templates ?? [],
    recipient: TEST_RECIPIENT,
  };
};

export const actions: Actions = {
  send: async ({ request, locals }) => {
    if (!locals.admin) error(401, "Admin only.");
    const fd = await request.formData();
    const slug = String(fd.get("slug") ?? "").trim();
    if (!slug) return fail(400, { error: "Missing slug." });

    const result = await sendTestEmail(slug);
    if (!result.ok) {
      return fail(500, { error: `${slug}: ${result.reason}` });
    }
    return { sent: slug };
  },
};
