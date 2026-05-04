// Public callboard submission form. All post types in one form with
// conditional fields by type. Unverified individuals go through email
// verify + admin review. Posts from verified orgs (matched by email)
// go live immediately after email verify with no admin review.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { generateToken, hashToken } from "$lib/server/tokens";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

type PostType = string;

const VALID_COMP_TYPES = ["paid", "stipend", "volunteer", "none"] as const;

export const load: PageServerLoad = async () => {
  // Provide areas for the location field hint, plus the active
  // callboard post types for the radio picker.
  const [areasRes, typesRes] = await Promise.all([
    supabaseAdmin.from("areas").select("name").order("sort_order"),
    supabaseAdmin
      .from("callboard_post_types")
      .select("slug, label, plural_label, description, sort_order")
      .eq("active", true)
      .order("sort_order"),
  ]);
  return {
    areas: (areasRes.data ?? []).map((a: { name: string }) => a.name),
    postTypes: typesRes.data ?? [],
  };
};

type KeyDate = [string, string];

type Values = {
  postType: PostType;
  title: string;
  organizationName: string;
  location: string;
  description: string;
  roles: string;
  compensationType: string;
  compensation: string;
  contactInfo: string;
  keyDates: KeyDate[];
  deadlineText: string;
  expiresAt: string;
  ticketUrl: string;
  submitterName: string;
  submitterEmail: string;
};

function parseKeyDates(raw: unknown): KeyDate[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is [string, string] =>
          Array.isArray(row) &&
          row.length === 2 &&
          typeof row[0] === "string" &&
          typeof row[1] === "string",
      )
      .map(([k, v]) => [k.trim().slice(0, 80), v.trim().slice(0, 80)] as KeyDate)
      .filter(([k, v]) => k.length > 0 && v.length > 0)
      .slice(0, 10);
  } catch {
    return [];
  }
}

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

    // Honeypot: bots fill this, humans don't see it.
    if ((data.get("website_url_extra") as string)?.trim()) {
      throw redirect(303, "/callboard/submit/thanks");
    }

    const postType = ((data.get("post_type") as string) ?? "").trim() as PostType;

    const values: Values = {
      postType,
      title: ((data.get("title") as string) ?? "").trim(),
      organizationName: ((data.get("organization_name") as string) ?? "").trim(),
      location: ((data.get("location") as string) ?? "").trim(),
      description: ((data.get("description") as string) ?? "").trim(),
      roles: ((data.get("roles") as string) ?? "").trim(),
      compensationType: ((data.get("compensation_type") as string) ?? "").trim(),
      compensation: ((data.get("compensation") as string) ?? "").trim(),
      contactInfo: ((data.get("contact_info") as string) ?? "").trim(),
      keyDates: parseKeyDates(data.get("key_dates")),
      deadlineText: ((data.get("deadline_text") as string) ?? "").trim(),
      expiresAt: ((data.get("expires_at") as string) ?? "").trim(),
      ticketUrl: ((data.get("ticket_url") as string) ?? "").trim(),
      submitterName: ((data.get("submitter_name") as string) ?? "").trim(),
      submitterEmail: ((data.get("submitter_email") as string) ?? "").trim().toLowerCase(),
    };

    const errors: Record<string, string> = {};

    // Validate post_type against the active callboard_post_types table
    // (since the CHECK constraint was dropped in mig 036). Inactive or
    // unknown slugs get rejected.
    const { data: typeRow } = await supabaseAdmin
      .from("callboard_post_types")
      .select("slug")
      .eq("slug", postType)
      .eq("active", true)
      .maybeSingle();
    if (!typeRow) errors.post_type = "Choose a post type.";
    if (!values.title) errors.title = "Required.";
    if (!values.organizationName) errors.organization_name = "Required.";
    if (!values.submitterName) errors.submitter_name = "Required.";
    if (!isValidEmail(values.submitterEmail)) errors.submitter_email = "Enter a valid email address.";
    if (!values.description) errors.description = "Required.";

    if (values.compensationType && !VALID_COMP_TYPES.includes(values.compensationType as typeof VALID_COMP_TYPES[number])) {
      errors.compensation_type = "Invalid compensation type.";
    }

    if (values.ticketUrl && !isValidUrl(values.ticketUrl)) {
      errors.ticket_url = "Must be a valid URL.";
    }

    let expiresAtIso: string | null = null;
    if (values.expiresAt) {
      const d = new Date(values.expiresAt);
      if (isNaN(d.getTime())) {
        errors.expires_at = "Enter a valid date.";
      } else if (d < new Date()) {
        errors.expires_at = "Expiration date must be in the future.";
      } else {
        expiresAtIso = d.toISOString();
      }
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, values });
    }

    // Parse roles: newline or comma-separated list.
    const roles = values.roles
      ? values.roles
          .split(/[\n,]/)
          .map((r) => r.trim())
          .filter(Boolean)
          .slice(0, 20)
      : [];

    // Check if submitter email belongs to a verified org.
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .eq("contact_email", values.submitterEmail)
      .eq("verified", true)
      .is("deleted_at", null)
      .maybeSingle();

    const organizationId = org?.id ?? null;

    const verificationToken = generateToken();
    const tokenHash = hashToken(verificationToken);
    const tokenExpires = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();

    const { data: post, error: insertErr } = await supabaseAdmin
      .from("callboard_posts")
      .insert({
        post_type: values.postType,
        title: values.title,
        organization_name: values.organizationName,
        location: values.location || null,
        description: values.description,
        roles,
        compensation_type: values.compensationType || null,
        compensation: values.compensation || null,
        contact_info: values.contactInfo || null,
        key_dates: values.keyDates,
        deadline_text: values.deadlineText || null,
        expires_at: expiresAtIso,
        ticket_url: values.ticketUrl || null,
        submitter_email: values.submitterEmail,
        organization_id: organizationId,
        email_verification_token_hash: tokenHash,
        email_verification_expires_at: tokenExpires,
        status: "pending_email",
        published: false,
      })
      .select("id")
      .single();

    if (insertErr || !post) {
      console.error("callboard insert failed", insertErr);
      return fail(500, {
        errors: { _form: "Could not save your submission. Please try again." } as Record<string, string>,
        values,
      });
    }

    const verifyUrl = `${PUBLIC_SITE_URL}/callboard/verify/${verificationToken}`;
    const sendResult = await sendEmail({
      to: values.submitterEmail,
      templateSlug: "callboard_verify",
      vars: {
        name: values.submitterName,
        verify_url: verifyUrl,
      },
    });
    if (!sendResult.ok) {
      console.error(
        `callboard verify email failed for post ${post.id}: ${sendResult.reason}`,
      );
    }

    throw redirect(303, "/callboard/submit/thanks");
  },
};
