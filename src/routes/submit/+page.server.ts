// Public artist submission form. Loads the discipline list, validates the
// posted form, checks slug collision, and inserts a row into
// pending_submissions with status='pending_email'.
//
// Email verification (sending the link, the click-to-confirm endpoint) is
// step 5 of BUILD_PLAN - not wired here yet. The success page tells the
// artist a verification email is on the way.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { suggestAlternatives, validateSlug } from "$lib/util/slug";

const AVAILABILITY_OPTIONS = ["Available", "Currently Committed"];
const EXPERIENCE_OPTIONS = ["Emerging", "Mid-Career", "Veteran"];
const UNION_OPTIONS = ["AEA", "AGMA", "Non-Union"];
const AREA_OPTIONS = ["Tacoma", "Olympia", "Gig Harbor", "Other South Sound"];
const AGE_OPTIONS = [
  "Under 18",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
  "Prefer not to say",
];
const ETHNICITY_OPTIONS = [
  "African American / Black",
  "Asian",
  "Hispanic / Latino",
  "Indigenous / Native American",
  "Middle Eastern / North African",
  "Pacific Islander",
  "White / European",
  "Multiracial / Mixed",
  "Prefer not to say",
];

export const load: PageServerLoad = async () => {
  const { data, error } = await supabaseAdmin
    .from("disciplines")
    .select("name")
    .order("sort_order");
  if (error) throw error;
  return {
    disciplines: (data ?? []).map((d: { name: string }) => d.name),
    options: {
      availability: AVAILABILITY_OPTIONS,
      experience: EXPERIENCE_OPTIONS,
      union: UNION_OPTIONS,
      area: AREA_OPTIONS,
      age: AGE_OPTIONS,
      ethnicity: ETHNICITY_OPTIONS,
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
  availability: string;
  experience: string;
  union: string;
  area: string;
  ageRange: string;
  languages: string;
  instagram: string;
  website: string;
  disciplines: string[];
  ethnicities: string[];
  ethnicityOther: string;
};

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();

    // Honeypot: bots fill this field, humans don't see it. Pretend success
    // so they don't iterate against us.
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
      availability: ((data.get("availability") as string) ?? "").trim(),
      experience: ((data.get("experience") as string) ?? "").trim(),
      union: ((data.get("union") as string) ?? "").trim(),
      area: ((data.get("area") as string) ?? "").trim(),
      ageRange: ((data.get("age_range") as string) ?? "").trim(),
      languages: ((data.get("languages") as string) ?? "").trim(),
      instagram: ((data.get("instagram") as string) ?? "").trim(),
      website: ((data.get("website") as string) ?? "").trim(),
      disciplines: data.getAll("disciplines").map(String).filter(Boolean),
      ethnicities: data.getAll("ethnicities").map(String).filter(Boolean),
      ethnicityOther: ((data.get("ethnicity_other") as string) ?? "").trim(),
    };

    const errors: Record<string, string> = {};

    if (!values.fullName) errors.full_name = "Required.";
    if (!isValidEmail(values.email)) errors.email = "Enter a valid email address.";
    if (!values.headshotUrl) errors.headshot_url = "Headshot is required.";
    if (!values.headshotConsent) {
      errors.headshot_consent = "Please confirm you have rights to use this image.";
    }
    if (values.disciplines.length === 0) errors.disciplines = "Choose at least one.";
    if (!AVAILABILITY_OPTIONS.includes(values.availability)) {
      errors.availability = "Choose your availability.";
    }
    if (!AREA_OPTIONS.includes(values.area)) errors.area = "Choose an area.";

    if (values.experience && !EXPERIENCE_OPTIONS.includes(values.experience)) {
      errors.experience = "Pick from the list.";
    }
    if (values.union && !UNION_OPTIONS.includes(values.union)) {
      errors.union = "Pick from the list.";
    }
    if (values.ageRange && !AGE_OPTIONS.includes(values.ageRange)) {
      errors.age_range = "Pick from the list.";
    }
    if (values.website && !isValidUrl(values.website)) {
      errors.website = "Must be a valid URL.";
    }

    const slugCheck = validateSlug(values.slug);
    if (!slugCheck.ok) errors.slug = slugCheck.reason;

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, values });
    }

    // Slug collision: only check against live profiles. Pending submissions
    // don't reserve slugs (per planning notes); a tied pair is rare enough
    // that the admin handles it at approval time.
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

    // Languages: comma-separated input → array, trimmed, dedup.
    const languages = Array.from(
      new Set(
        values.languages
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );

    const ethnicities = [...values.ethnicities];
    if (values.ethnicityOther) ethnicities.push(values.ethnicityOther);

    const { error: insertErr } = await supabaseAdmin
      .from("pending_submissions")
      .insert({
        email: values.email,
        email_verified: false,
        full_name: values.fullName,
        bio: values.bio || null,
        disciplines: values.disciplines,
        headshot_url: values.headshotUrl,
        headshot_consent: values.headshotConsent,
        availability_status: values.availability,
        experience_level: values.experience || null,
        union_status: values.union || null,
        geographic_area: values.area,
        age_range: values.ageRange || null,
        languages,
        instagram_handle: values.instagram || null,
        website_url: values.website || null,
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

    // TODO step 5: send email verification link via Resend wrapper
    // (logs to email_log first). For now, the success page tells the user
    // to expect an email.

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
