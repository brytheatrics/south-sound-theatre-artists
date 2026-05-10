// /report?profile=<slug>: anyone can submit a report on a profile.
// No auth needed; the submitter's email is optional. Honeypot guard.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { checkSubmitRateLimit, RATE_LIMIT_MESSAGE } from "$lib/server/rate-limit";

export const load: PageServerLoad = async ({ url }) => {
  const slug = url.searchParams.get("profile") ?? "";
  if (!slug) return { profile: null };
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, slug, full_name")
    .eq("slug", slug)
    .eq("published", true)
    .is("deleted_at", null)
    .maybeSingle();
  return { profile: data ?? null };
};

export const actions: Actions = {
  default: async ({ request, url, getClientAddress }) => {
    const data = await request.formData();
    if ((data.get("website_url_extra") as string)?.trim()) {
      throw redirect(303, "/report/done");
    }

    const rl = await checkSubmitRateLimit(getClientAddress(), "report");
    if (!rl.ok) {
      return fail(429, {
        errors: { _form: RATE_LIMIT_MESSAGE },
        values: { reason: "", reporterEmail: "" },
      });
    }

    const slug = url.searchParams.get("profile") ?? "";
    const reason = ((data.get("reason") as string) ?? "").trim();
    const reporterEmail = ((data.get("reporter_email") as string) ?? "")
      .trim()
      .toLowerCase();

    const errors: Record<string, string> = {};
    if (!slug) errors._form = "Missing profile reference.";
    if (reason.length < 10) errors.reason = "Tell us what's wrong (10+ chars).";
    if (reason.length > 5000) errors.reason = "Too long.";
    if (
      reporterEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)
    ) {
      errors.reporter_email = "Email is not valid.";
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, values: { reason, reporterEmail } });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!profile) {
      return fail(404, { errors: { _form: "Profile not found." } });
    }

    await supabaseAdmin.from("reports").insert({
      target_type: "profile",
      target_id: profile.id,
      reporter_email: reporterEmail || null,
      reason,
      status: "open",
    });

    throw redirect(303, "/report/done");
  },
};
