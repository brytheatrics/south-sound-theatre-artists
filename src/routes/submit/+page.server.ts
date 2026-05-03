// Public artist submission form. Loads the discipline / area / union
// reference lists from the DB, validates the posted form, checks slug
// collision, and inserts a row into pending_submissions with
// status='pending_email'.
//
// Email verification (sending the link, the click-to-confirm endpoint) is
// step 5 of BUILD_PLAN - not wired here yet.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { generateToken, hashToken } from "$lib/server/tokens";
import { parseResumeData, type ResumeData } from "$lib/server/resume";
import { suggestAlternatives, validateSlug } from "$lib/util/slug";
import { normalizeUrl } from "$lib/util/url";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async () => {
  const [disciplinesRes, categoriesRes, areasRes, unionsRes, ethnicitiesRes] =
    await Promise.all([
      supabaseAdmin
        .from("disciplines")
        .select("name, category")
        .order("sort_order"),
      supabaseAdmin
        .from("discipline_categories")
        .select("name")
        .order("sort_order"),
      supabaseAdmin.from("areas").select("name, description").order("sort_order"),
      supabaseAdmin
        .from("unions")
        .select("name, description")
        .order("sort_order"),
      supabaseAdmin.from("ethnicities").select("name").order("sort_order"),
    ]);
  if (disciplinesRes.error) throw disciplinesRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (areasRes.error) throw areasRes.error;
  if (unionsRes.error) throw unionsRes.error;
  if (ethnicitiesRes.error) throw ethnicitiesRes.error;

  return {
    disciplines: (disciplinesRes.data ?? []) as Array<{
      name: string;
      category: string;
    }>,
    disciplineCategories: (categoriesRes.data ?? []).map(
      (c: { name: string }) => c.name,
    ),
    areas: (areasRes.data ?? []) as Array<{ name: string; description: string | null }>,
    unions: (unionsRes.data ?? []) as Array<{
      name: string;
      description: string | null;
    }>,
    options: {
      ethnicity: (ethnicitiesRes.data ?? []).map(
        (r: { name: string }) => r.name,
      ),
    },
  };
};

type Values = {
  fullName: string;
  email: string;
  slug: string;
  bio: string;
  pronouns: string;
  headshotUrl: string;
  headshotConsent: boolean;
  isMinor: boolean;
  guardianEmail: string;
  guardianName: string;
  area: string;
  areaOther: string;
  city: string;
  playableAgeMin: string;
  playableAgeMax: string;
  languages: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  linkedin: string;
  twitter: string;
  youtube: string;
  website: string;
  disciplines: string[];
  disciplineOther: string;
  unions: string[];
  unionOther: string;
  ethnicities: string[];
  ethnicityOther: string;
  resumes: Array<{ label: string; url: string }>;
  resumeData: ResumeData;
  mentorshipOffering: string[];
  mentorshipSeeking: string[];
};

function parseResumes(raw: unknown): Array<{ label: string; url: string }> {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is { label: string; url: string } =>
          r &&
          typeof r === "object" &&
          typeof r.label === "string" &&
          typeof r.url === "string" &&
          r.url.startsWith("https://"),
      )
      .map((r) => ({
        label: r.label.trim().slice(0, 80),
        url: r.url,
      }))
      .filter((r) => r.label.length > 0)
      .slice(0, 20); // hard cap so a malicious client can't store thousands
  } catch {
    return [];
  }
}

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();

    // Honeypot: bots fill this hidden field, humans don't see it.
    if ((data.get("website_url_extra") as string)?.trim()) {
      throw redirect(303, "/submit/thanks");
    }

    const values: Values = {
      fullName: ((data.get("full_name") as string) ?? "").trim(),
      email: ((data.get("email") as string) ?? "").trim().toLowerCase(),
      slug: ((data.get("slug") as string) ?? "").trim().toLowerCase(),
      bio: ((data.get("bio") as string) ?? "").trim(),
      pronouns: ((data.get("pronouns") as string) ?? "").trim(),
      headshotUrl: ((data.get("headshot_url") as string) ?? "").trim(),
      headshotConsent: data.get("headshot_consent") === "on",
      isMinor: data.get("is_minor") === "on",
      guardianEmail: ((data.get("guardian_email") as string) ?? "").trim().toLowerCase(),
      guardianName: ((data.get("guardian_name") as string) ?? "").trim(),
      area: ((data.get("area") as string) ?? "").trim(),
      areaOther: ((data.get("area_other") as string) ?? "").trim(),
      city: ((data.get("city") as string) ?? "").trim(),
      playableAgeMin: ((data.get("playable_age_min") as string) ?? "").trim(),
      playableAgeMax: ((data.get("playable_age_max") as string) ?? "").trim(),
      languages: ((data.get("languages") as string) ?? "").trim(),
      instagram: ((data.get("instagram") as string) ?? "").trim(),
      facebook: ((data.get("facebook") as string) ?? "").trim(),
      tiktok: ((data.get("tiktok") as string) ?? "").trim(),
      linkedin: ((data.get("linkedin") as string) ?? "").trim(),
      twitter: ((data.get("twitter") as string) ?? "").trim(),
      youtube: ((data.get("youtube") as string) ?? "").trim(),
      website: ((data.get("website") as string) ?? "").trim(),
      disciplines: data.getAll("disciplines").map(String).filter(Boolean),
      disciplineOther: ((data.get("discipline_other") as string) ?? "").trim(),
      unions: data.getAll("unions").map(String).filter(Boolean),
      unionOther: ((data.get("union_other") as string) ?? "").trim(),
      ethnicities: data.getAll("ethnicities").map(String).filter(Boolean),
      ethnicityOther: ((data.get("ethnicity_other") as string) ?? "").trim(),
      resumes: parseResumes(data.get("resumes")),
      resumeData: parseResumeData(data.get("resume_data")),
      mentorshipOffering: data
        .getAll("mentorship_offering")
        .map(String)
        .filter(Boolean),
      mentorshipSeeking: data
        .getAll("mentorship_seeking")
        .map(String)
        .filter(Boolean),
    };

    const errors: Record<string, string> = {};

    if (!values.fullName) errors.full_name = "Required.";
    if (!isValidEmail(values.email)) errors.email = "Enter a valid email address.";

    // Minor profiles: parent / guardian email is required and is the
    // address everything else routes through (verification, magic links,
    // contact-form messages). Guardian name is optional but recommended.
    if (values.isMinor) {
      if (!isValidEmail(values.guardianEmail)) {
        errors.guardian_email = "Parent or guardian email is required.";
      } else if (values.guardianEmail === values.email) {
        errors.guardian_email = "Use a different email for the parent or guardian.";
      }
    }

    // Headshot/photo: normally required for adult profiles. For minor
    // profiles we suppress it on the public profile so we don't ask for
    // one at submit time either. (If the parent uploads anyway it's
    // stored but never displayed; the column still gets set to null.)
    if (!values.isMinor) {
      if (!values.headshotUrl) {
        errors.headshot_url = "Add a clear photo of yourself.";
      } else if (!values.headshotConsent) {
        errors.headshot_consent = "Please confirm you have rights to use this image.";
      }
    }

    if (values.disciplines.length === 0) errors.disciplines = "Choose at least one.";
    if (!values.area) errors.area = "Choose an area.";
    if (values.area === "Other" && !values.areaOther) {
      errors.area_other = "Tell us where.";
    }

    // Playable age range: optional, but if either is set both must be,
    // and 0 ≤ min ≤ max ≤ 120.
    let ageMin: number | null = null;
    let ageMax: number | null = null;
    if (values.playableAgeMin || values.playableAgeMax) {
      if (!values.playableAgeMin || !values.playableAgeMax) {
        errors.playable_age = "Set both ages or leave both blank.";
      } else {
        const a = Number(values.playableAgeMin);
        const b = Number(values.playableAgeMax);
        if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b > 120) {
          errors.playable_age = "Ages must be whole numbers between 0 and 120.";
        } else if (a > b) {
          errors.playable_age = "Min must be less than or equal to max.";
        } else {
          ageMin = a;
          ageMax = b;
        }
      }
    }

    if (values.website && !isValidUrl(values.website)) {
      errors.website = "Must be a valid URL.";
    }
    if (values.facebook && !isValidUrl(values.facebook)) {
      errors.facebook = "Must be a valid URL (https://facebook.com/...).";
    }
    if (values.linkedin && !isValidUrl(values.linkedin)) {
      errors.linkedin = "Must be a valid URL (https://linkedin.com/in/...).";
    }
    if (values.youtube && !isValidUrl(values.youtube)) {
      errors.youtube = "Must be a valid URL (https://youtube.com/...).";
    }

    const slugCheck = validateSlug(values.slug);
    if (!slugCheck.ok) errors.slug = slugCheck.reason;

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, values });
    }

    // Slug collision against live profiles only.
    const { data: existing, error: existErr } = await supabaseAdmin
      .from("profiles")
      .select("slug")
      .eq("slug", values.slug)
      .maybeSingle();
    if (existErr) {
      console.error("slug collision check failed", existErr);
      return fail(500, {
        errors: { _form: "Something went wrong. Please try again." },
        values,
      });
    }
    if (existing) {
      const suggestions = await findFreeSuggestions(values.fullName);
      return fail(409, {
        errors: { slug: "taken" },
        slugCollision: { requested: values.slug, suggestions },
        values,
      });
    }

    // Resolve "Other" placeholders to typed values.
    const disciplines = [...values.disciplines];
    if (values.disciplineOther && disciplines.includes("Other")) {
      disciplines[disciplines.indexOf("Other")] = values.disciplineOther;
    }

    const unions = [...values.unions];
    if (values.unionOther && unions.includes("Other")) {
      unions[unions.indexOf("Other")] = values.unionOther;
    }

    const ethnicities = [...values.ethnicities];
    if (values.ethnicityOther) ethnicities.push(values.ethnicityOther);

    const area =
      values.area === "Other" && values.areaOther
        ? values.areaOther
        : values.area;

    // Languages: comma-separated → trimmed, deduped array.
    const languages = Array.from(
      new Set(
        values.languages
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );

    const verificationToken = generateToken();
    const tokenHash = hashToken(verificationToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();

    // For minors, the contact email of record IS the guardian's. The
    // 'email' column is what we send verification to + what magic links
    // route to + what the contact form forwards to. Storing guardian_email
    // separately lets us *show* it on /admin and route it correctly even
    // if the artist's own email later gets added.
    const contactEmail = values.isMinor ? values.guardianEmail : values.email;

    const { error: insertErr } = await supabaseAdmin
      .from("pending_submissions")
      .insert({
        email: contactEmail,
        email_verified: false,
        email_verification_token_hash: tokenHash,
        email_verification_expires_at: expiresAt,
        full_name: values.fullName,
        bio: values.bio || null,
        disciplines,
        // Minors don't show a headshot publicly. Stash whatever was
        // uploaded as null so it can't leak via a stale row.
        headshot_url: values.isMinor ? null : (values.headshotUrl || null),
        headshot_consent: values.isMinor ? false : values.headshotConsent,
        is_minor: values.isMinor,
        guardian_email: values.isMinor ? values.guardianEmail : null,
        guardian_name: values.isMinor ? (values.guardianName || null) : null,
        geographic_area: area,
        city: values.city || null,
        resumes: values.resumes,
        resume_data: values.resumeData,
        mentorship_offering: values.mentorshipOffering,
        mentorship_seeking: values.mentorshipSeeking,
        playable_age_min: ageMin,
        playable_age_max: ageMax,
        languages,
        unions,
        instagram_handle: values.instagram || null,
        facebook_url: normalizeUrl(values.facebook) || null,
        tiktok_handle: values.tiktok || null,
        linkedin_url: normalizeUrl(values.linkedin) || null,
        twitter_handle: values.twitter || null,
        youtube_url: normalizeUrl(values.youtube) || null,
        website_url: normalizeUrl(values.website) || null,
        desired_slug: values.slug,
        pronouns: values.pronouns || null,
        ethnicities,
        status: "pending_email",
      });

    if (insertErr) {
      console.error("pending_submissions insert failed", insertErr);
      return fail(500, {
        errors: { _form: "Could not save your submission. Please try again." },
        values,
      });
    }

    // Fire the verification email. We don't roll the insert back if this
    // fails - the row exists, the user sees the success page, and the admin
    // can reach out manually. Failures are captured in email_log. For
    // minor profiles the guardian gets the email, not the artist.
    const verifyUrl = `${PUBLIC_SITE_URL}/verify/${verificationToken}`;
    const sendResult = await sendEmail({
      to: contactEmail,
      templateSlug: "email_verification",
      vars: {
        name: values.isMinor && values.guardianName
          ? values.guardianName
          : values.fullName,
        verify_url: verifyUrl,
      },
    });
    if (!sendResult.ok) {
      console.error(
        `verification email failed for submission, reason=${sendResult.reason}`,
      );
    }

    throw redirect(303, "/submit/thanks");
  },
};

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

async function findFreeSuggestions(name: string): Promise<string[]> {
  const candidates = suggestAlternatives(name);
  if (candidates.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("slug")
    .in("slug", candidates);
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  return candidates.filter((c) => !taken.has(c));
}
