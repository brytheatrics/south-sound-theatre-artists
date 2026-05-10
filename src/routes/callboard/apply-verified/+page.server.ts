// Apply for verified theatre organization status. Creates a row in
// organizations with verified=false; admin approves at /admin/organizations.
//
// Captures area + categories at submit time so a fresh applicant lands
// cleanly on /theatres - their card groups under the right area and
// surfaces with the right badges + chip filter membership without
// admin needing to fill those in by hand after the fact.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { checkSubmitRateLimit, RATE_LIMIT_MESSAGE } from "$lib/server/rate-limit";
import { KNOWN_CATEGORY_SLUGS, CATEGORY_LABELS } from "$lib/server/orgCategories";

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

export const load: PageServerLoad = async () => {
  const { data: areas } = await supabaseAdmin
    .from("areas")
    .select("id, name, sort_order")
    .order("sort_order");
  return {
    areas: areas ?? [],
    categoryOptions: KNOWN_CATEGORY_SLUGS.map((slug) => ({
      slug,
      label: CATEGORY_LABELS[slug],
    })),
  };
};

export const actions: Actions = {
  default: async ({ request, getClientAddress }) => {
    const data = await request.formData();

    // Honeypot
    if ((data.get("website_url_extra") as string)?.trim()) {
      throw redirect(303, "/callboard/apply-verified/thanks");
    }

    const rl = await checkSubmitRateLimit(getClientAddress(), "apply_verified");
    if (!rl.ok) {
      return fail(429, {
        errors: { _form: RATE_LIMIT_MESSAGE } as Record<string, string>,
        values: { name: "", contactName: "", contactEmail: "", websiteUrl: "", description: "", areaId: "", categories: [] as string[] },
      });
    }

    const name = ((data.get("name") as string) ?? "").trim();
    const contactName = ((data.get("contact_name") as string) ?? "").trim();
    const contactEmail = ((data.get("contact_email") as string) ?? "").trim().toLowerCase();
    const websiteUrl = ((data.get("website_url") as string) ?? "").trim();
    const description = ((data.get("description") as string) ?? "").trim();
    const areaId = ((data.get("area_id") as string) ?? "").trim();
    // Filter to known slugs so a tampered form can't poison the
    // categories array. KNOWN_CATEGORY_SLUGS is the single source of
    // truth - adding a new badge there auto-surfaces it on this form.
    const categories = data
      .getAll("categories")
      .map(String)
      .filter((s) => (KNOWN_CATEGORY_SLUGS as readonly string[]).includes(s));

    const errors: Record<string, string> = {};
    if (!name) errors.name = "Required.";
    if (!contactName) errors.contact_name = "Required.";
    if (!isValidEmail(contactEmail)) errors.contact_email = "Enter a valid email address.";
    if (websiteUrl && !isValidUrl(websiteUrl)) errors.website_url = "Must be a valid URL.";
    if (!areaId) {
      errors.area_id = "Pick the area where your organization is based.";
    } else {
      const { data: areaRow } = await supabaseAdmin
        .from("areas")
        .select("id")
        .eq("id", areaId)
        .maybeSingle();
      if (!areaRow) errors.area_id = "That area isn't recognised.";
    }
    if (categories.length === 0) {
      errors.categories = "Pick at least one category that describes your organization.";
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, {
        errors,
        values: { name, contactName, contactEmail, websiteUrl, description, areaId, categories },
      });
    }

    // Generate a slug from the name. Lowercase, ascii-only, dash-separated,
    // truncated to 60. organizations.slug is unique - on collision we suffix
    // with a 4-char random tail; the apply-verified flow doesn't expose the
    // slug to the user so collision-suffixing is fine here.
    const baseSlug =
      name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 60) || "org";
    let slug = baseSlug;
    const { data: clash } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", baseSlug)
      .maybeSingle();
    if (clash) {
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const { error: insertErr } = await supabaseAdmin.from("organizations").insert({
      slug,
      name,
      contact_email: contactEmail,
      homepage_url: websiteUrl || null,
      description: description || null,
      area_id: areaId,
      categories,
      verified: false,
      // Applied orgs default to manual entry; admin can switch them to
      // ai-generic later if their site supports automated pulls.
      adapter: "manual",
      active: true,
    });

    if (insertErr) {
      console.error("organizations insert failed", insertErr);
      return fail(500, {
        errors: { _form: "Could not save your application. Please try again." } as Record<string, string>,
        values: { name, contactName, contactEmail, websiteUrl, description, areaId, categories },
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
