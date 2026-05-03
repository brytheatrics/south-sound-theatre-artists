// Public /calendar/submit: anyone can submit a performance. Mirrors the
// /callboard/submit pattern (email-verify gate + verified-org skip).
//
// Flow:
//   1. User fills form, submits
//   2. Row inserted with status='pending_email' + verification token
//   3. Verify email sent
//   4. User clicks link -> token validated, status flips to:
//      - 'approved' if submitter email matches a verified_org
//      - 'pending_review' otherwise (admin approves in /admin/calendar)
//   5. Approved entries appear on /calendar
//
// Performances: submitter can list specific datetimes inline (mirrors
// the admin form's editor). Optional - admin can fill in during review
// if the submitter only provided a date range.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { generateToken, hashToken } from "$lib/server/tokens";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

// ---- Pacific time conversion (mirrors admin/calendar/[id]/edit) ----
function pacificOffsetForDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (m > 3 && m < 11) return "-07:00";
  if (m < 3 || m > 11) return "-08:00";
  const firstOfMonth = new Date(`${y}-${String(m).padStart(2, "0")}-01T12:00:00Z`);
  const dowFirst = firstOfMonth.getUTCDay();
  if (m === 3) {
    const firstSunday = 1 + ((7 - dowFirst) % 7);
    const secondSunday = firstSunday + 7;
    return d >= secondSunday ? "-07:00" : "-08:00";
  }
  const firstSunday = 1 + ((7 - dowFirst) % 7);
  return d >= firstSunday ? "-08:00" : "-07:00";
}
function pacificWallToUtc(wallClock: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wallClock)) return null;
  const [date] = wallClock.split("T");
  return new Date(`${wallClock}:00${pacificOffsetForDate(date)}`).toISOString();
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

export const load: PageServerLoad = async () => {
  const [catsRes, areasRes] = await Promise.all([
    supabaseAdmin
      .from("event_categories")
      .select("id, name, slug, sort_order")
      .order("sort_order"),
    supabaseAdmin.from("areas").select("id, name, sort_order").order("sort_order"),
  ]);
  return {
    categories: catsRes.data ?? [],
    areas: areasRes.data ?? [],
  };
};

type Values = {
  title: string;
  organizationName: string;
  runStart: string;
  runEnd: string;
  detailUrl: string;
  description: string;
  categoryId: string;
  areaId: string;
  performancesJson: string;
  submitterName: string;
  submitterEmail: string;
};

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();

    // Honeypot
    if ((data.get("website_url_extra") as string)?.trim()) {
      throw redirect(303, "/calendar/submit/thanks");
    }

    const values: Values = {
      title: ((data.get("title") as string) ?? "").trim(),
      organizationName: ((data.get("organization_name") as string) ?? "").trim(),
      runStart: ((data.get("run_start") as string) ?? "").trim(),
      runEnd: ((data.get("run_end") as string) ?? "").trim(),
      detailUrl: ((data.get("detail_url") as string) ?? "").trim(),
      description: ((data.get("description") as string) ?? "").trim(),
      categoryId: ((data.get("category_id") as string) ?? "").trim(),
      areaId: ((data.get("area_id") as string) ?? "").trim(),
      performancesJson: ((data.get("performances_json") as string) ?? "[]").trim(),
      submitterName: ((data.get("submitter_name") as string) ?? "").trim(),
      submitterEmail: ((data.get("submitter_email") as string) ?? "").trim().toLowerCase(),
    };

    const errors: Record<string, string> = {};
    if (!values.title) errors.title = "Required.";
    if (!values.organizationName) errors.organization_name = "Required.";
    if (!values.runStart) errors.run_start = "Required.";
    if (!values.runEnd) errors.run_end = "Required.";
    if (values.runStart && values.runEnd && values.runStart > values.runEnd) {
      errors.run_end = "Must be on or after run start.";
    }
    if (!values.areaId) errors.area_id = "Pick the region this is in.";
    if (!values.submitterName) errors.submitter_name = "Required.";
    if (!isValidEmail(values.submitterEmail)) errors.submitter_email = "Enter a valid email address.";
    if (values.detailUrl && !isValidUrl(values.detailUrl)) errors.detail_url = "Must be a valid URL.";

    // Parse performances JSON
    let perfs: Array<{ wallClock: string; note: string }> = [];
    try {
      const parsed = JSON.parse(values.performancesJson);
      if (Array.isArray(parsed)) {
        perfs = parsed
          .filter((p) => p && typeof p.wallClock === "string")
          .map((p) => ({
            wallClock: String(p.wallClock).slice(0, 32),
            note: typeof p.note === "string" ? p.note.trim().slice(0, 200) : "",
          }))
          .slice(0, 200);
      }
    } catch {
      // Treat as empty - admin can fill in during review.
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, values });
    }

    // Verified-org check: if submitter email is on a verified org, skip
    // admin review on email-verify.
    const { data: org } = await supabaseAdmin
      .from("verified_orgs")
      .select("id, name")
      .eq("contact_email", values.submitterEmail)
      .eq("verified", true)
      .is("deleted_at", null)
      .maybeSingle();

    const token = generateToken();
    const tokenHash = hashToken(token);
    const tokenExpires = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();

    const { data: prod, error: insErr } = await supabaseAdmin
      .from("productions")
      .insert({
        title: values.title.toUpperCase(),
        organization_name: values.organizationName,
        run_start: values.runStart,
        run_end: values.runEnd,
        detail_url: values.detailUrl || null,
        description: values.description || null,
        category_id: values.categoryId || null,
        area_id: values.areaId,
        verified_org_id: org?.id ?? null,
        submitter_email: values.submitterEmail,
        email_verification_token_hash: tokenHash,
        email_verification_expires_at: tokenExpires,
        status: "pending_email",
      })
      .select("id")
      .single();

    if (insErr || !prod) {
      console.error("calendar submit insert failed", insErr);
      return fail(500, {
        errors: { _form: "Could not save your submission. Please try again." },
        values,
      });
    }

    // Insert performances if provided. Skip malformed entries silently.
    if (perfs.length > 0) {
      const rows = [];
      for (const p of perfs) {
        const utcIso = pacificWallToUtc(p.wallClock);
        if (!utcIso) continue;
        rows.push({
          production_id: prod.id,
          performs_at: utcIso,
          note: p.note || null,
        });
      }
      if (rows.length > 0) {
        await supabaseAdmin.from("performances").insert(rows);
      }
    }

    const verifyUrl = `${PUBLIC_SITE_URL}/calendar/verify/${token}`;
    const send = await sendEmail({
      to: values.submitterEmail,
      templateSlug: "calendar_verify",
      vars: {
        name: values.submitterName,
        title: values.title,
        verify_url: verifyUrl,
      },
    });
    if (!send.ok) {
      console.error(`calendar verify email failed for ${prod.id}: ${send.reason}`);
    }

    throw redirect(303, "/calendar/submit/thanks");
  },
};
