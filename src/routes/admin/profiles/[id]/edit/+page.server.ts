// /admin/profiles/[id]/edit: admin-side profile editor. Applies updates
// directly (admin is implicitly trusted). Mirrors the field set used by
// the public submit + magic-link edit forms but skips the help copy and
// rights consent (admin can change anything, including on behalf of an
// artist).

import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { parseResumeData } from "$lib/server/resume";
import { sendEmail } from "$lib/server/email";
import { generateToken, hashToken } from "$lib/server/tokens";
import { normalizeUrl } from "$lib/util/url";

const INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function parseResumes(raw: unknown): Array<{ label: string; url: string }> {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is { label: string; url: string } =>
          r && typeof r === "object" &&
          typeof r.label === "string" && typeof r.url === "string" &&
          r.url.startsWith("https://"),
      )
      .map((r) => ({ label: r.label.trim().slice(0, 80), url: r.url }))
      .filter((r) => r.label.length > 0)
      .slice(0, 20);
  } catch {
    return [];
  }
}

export const load: PageServerLoad = async ({ params }) => {
  const [
    profileRes,
    areasRes,
    disciplinesRes,
    categoriesRes,
    unionsRes,
    ethnicitiesRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", params.id)
      .maybeSingle(),
    supabaseAdmin.from("areas").select("name, description").order("sort_order"),
    supabaseAdmin
      .from("disciplines")
      .select("name, category")
      .order("sort_order"),
    supabaseAdmin
      .from("discipline_categories")
      .select("name")
      .order("sort_order"),
    supabaseAdmin
      .from("unions")
      .select("name, description")
      .order("sort_order"),
    supabaseAdmin.from("ethnicities").select("name").order("sort_order"),
  ]);

  if (!profileRes.data) error(404, "Profile not found.");

  // What's missing for this profile to be publishable? Mirrors the
  // /edit/[token] complete-to-publish gate so the admin can audit
  // each profile and see exactly what the artist will be asked to
  // fill in when they click their invitation link.
  const _p = profileRes.data;
  const missingFields: string[] = [];
  if (!_p.full_name) missingFields.push("Name");
  if (!_p.headshot_url) missingFields.push("Headshot or photo");
  if (!_p.geographic_area) missingFields.push("Geographic area");
  if (!_p.disciplines || _p.disciplines.length === 0) {
    missingFields.push("At least one discipline");
  }
  if (_p.headshot_url && !_p.headshot_consent) {
    missingFields.push("Headshot rights confirmation");
  }

  return {
    profile: profileRes.data,
    missingFields,
    areas: (areasRes.data ?? []) as Array<{ name: string; description: string | null }>,
    disciplines: disciplinesRes.data ?? [],
    disciplineCategories: (categoriesRes.data ?? []).map(
      (c: { name: string }) => c.name,
    ),
    unions: unionsRes.data ?? [],
    options: {
      ethnicity: (ethnicitiesRes.data ?? []).map(
        (r: { name: string }) => r.name,
      ),
    },
  };
};

export const actions: Actions = {
  save: async ({ params, request }) => {
    const data = await request.formData();
    const fullName = ((data.get("full_name") as string) ?? "").trim();
    const slug = ((data.get("slug") as string) ?? "").trim().toLowerCase();
    const email = ((data.get("email") as string) ?? "").trim().toLowerCase();
    const pronouns = ((data.get("pronouns") as string) ?? "").trim();
    const bio = ((data.get("bio") as string) ?? "").trim();
    const headshotUrl = ((data.get("headshot_url") as string) ?? "").trim();
    const area = ((data.get("area") as string) ?? "").trim();
    const areaOther = ((data.get("area_other") as string) ?? "").trim();
    const city = ((data.get("city") as string) ?? "").trim();
    const playableAgeMin = ((data.get("playable_age_min") as string) ?? "").trim();
    const playableAgeMax = ((data.get("playable_age_max") as string) ?? "").trim();
    const languagesStr = ((data.get("languages") as string) ?? "").trim();
    const instagram = ((data.get("instagram") as string) ?? "").trim();
    const facebook = ((data.get("facebook") as string) ?? "").trim();
    const tiktok = ((data.get("tiktok") as string) ?? "").trim();
    const linkedin = ((data.get("linkedin") as string) ?? "").trim();
    const twitter = ((data.get("twitter") as string) ?? "").trim();
    const youtube = ((data.get("youtube") as string) ?? "").trim();
    const website = ((data.get("website") as string) ?? "").trim();
    const disciplines = data.getAll("disciplines").map(String).filter(Boolean);
    const disciplineOther = ((data.get("discipline_other") as string) ?? "").trim();
    const unionsArr = data.getAll("unions").map(String).filter(Boolean);
    const unionOther = ((data.get("union_other") as string) ?? "").trim();
    const ethnicities = data.getAll("ethnicities").map(String).filter(Boolean);
    const ethnicityOther = ((data.get("ethnicity_other") as string) ?? "").trim();
    const resumes = parseResumes(data.get("resumes"));
    const resumeData = parseResumeData(data.get("resume_data"));
    const mentorshipOffering = data
      .getAll("mentorship_offering")
      .map(String)
      .filter(Boolean);
    const mentorshipSeeking = data
      .getAll("mentorship_seeking")
      .map(String)
      .filter(Boolean);

    const errors: Record<string, string> = {};
    if (!fullName) errors.full_name = "Required.";
    if (!slug || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      errors.slug = "Lowercase letters, numbers, hyphens. No leading or trailing hyphen.";
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Valid email required.";
    }
    if (disciplines.length === 0) errors.disciplines = "Choose at least one.";
    if (!area) errors.area = "Choose an area.";

    let ageMin: number | null = null;
    let ageMax: number | null = null;
    if (playableAgeMin || playableAgeMax) {
      if (!playableAgeMin || !playableAgeMax) {
        errors.playable_age = "Set both ages or leave both blank.";
      } else {
        const a = Number(playableAgeMin);
        const b = Number(playableAgeMax);
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

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors });
    }

    // Slug-collision check (excluding the profile being edited).
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("slug", slug)
      .neq("id", params.id)
      .maybeSingle();
    if (existing) {
      return fail(409, { errors: { slug: "Already used by another profile." } });
    }

    const finalDisciplines = [...disciplines];
    if (disciplineOther && finalDisciplines.includes("Other")) {
      finalDisciplines[finalDisciplines.indexOf("Other")] = disciplineOther;
    }
    const finalUnions = [...unionsArr];
    if (unionOther && finalUnions.includes("Other")) {
      finalUnions[finalUnions.indexOf("Other")] = unionOther;
    }
    const finalEthnicities = [...ethnicities];
    if (ethnicityOther) finalEthnicities.push(ethnicityOther);
    const finalArea = area === "Other" && areaOther ? areaOther : area;
    const languages = Array.from(
      new Set(
        languagesStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: fullName,
        slug,
        email,
        pronouns: pronouns || null,
        bio: bio || null,
        headshot_url: headshotUrl || null,
        // Admin save implicitly vouches for headshot rights - the
        // admin-side flow doesn't surface the consent checkbox the way
        // artist forms do, so we set it true alongside any non-empty
        // headshot URL. Clears it back when the URL is removed.
        headshot_consent: !!headshotUrl,
        disciplines: finalDisciplines,
        geographic_area: finalArea,
        city: city || null,
        resumes,
        resume_data: resumeData,
        playable_age_min: ageMin,
        playable_age_max: ageMax,
        languages,
        unions: finalUnions,
        ethnicities: finalEthnicities,
        instagram_handle: instagram || null,
        facebook_url: normalizeUrl(facebook) || null,
        tiktok_handle: tiktok || null,
        linkedin_url: normalizeUrl(linkedin) || null,
        twitter_handle: twitter || null,
        youtube_url: normalizeUrl(youtube) || null,
        website_url: normalizeUrl(website) || null,
        mentorship_offering: mentorshipOffering,
        mentorship_seeking: mentorshipSeeking,
      })
      .eq("id", params.id);

    if (updateErr) {
      console.error("admin profile update failed", updateErr);
      return fail(500, {
        errors: { _form: "Could not save changes. Please try again." },
      });
    }

    return { saved: true };
  },

  // Sends the artist an invitation email with a fresh single-use edit
  // link, for profiles created by admin (bulk import, /admin/profiles/new
  // when send_link wasn't used at creation time, etc.). Different from
  // the magic_link template which assumes the artist was the one who
  // initiated the relationship - this is "we set up your profile, claim
  // it". The token is created here, not assumed to exist.
  sendInvitation: async ({ params }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, slug, full_name, email")
      .eq("id", params.id)
      .maybeSingle();
    if (!profile) return fail(404, { errors: { _form: "Profile not found." } });
    if (!profile.email) {
      return fail(400, {
        errors: {
          _form: "This profile has no email - add one before sending an invitation.",
        },
      });
    }
    // Block placeholder emails the bulk-import script generated for
    // folders without a meta.txt email line. They have nowhere to land.
    if (profile.email.endsWith("@unknown.ssta.local")) {
      return fail(400, {
        errors: {
          _form:
            "This profile is using a placeholder email - replace it with the real address before sending an invitation.",
        },
      });
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expires = new Date(Date.now() + INVITE_TOKEN_TTL_MS).toISOString();
    const { error: tokenErr } = await supabaseAdmin
      .from("magic_link_tokens")
      .insert({
        token_hash: tokenHash,
        email: profile.email.toLowerCase(),
        purpose: "edit_profile",
        target_id: profile.id,
        expires_at: expires,
      });
    if (tokenErr) {
      console.error("invitation token insert failed", tokenErr);
      return fail(500, { errors: { _form: "Could not create the edit token." } });
    }

    const editUrl = `${PUBLIC_SITE_URL}/edit/${token}`;
    const profileUrl = `${PUBLIC_SITE_URL}/artists/${profile.slug}`;
    const result = await sendEmail({
      to: profile.email,
      templateSlug: "admin_invitation",
      vars: {
        name: profile.full_name,
        edit_url: editUrl,
        profile_url: profileUrl,
        site_url: PUBLIC_SITE_URL,
      },
    });
    if (!result.ok) {
      return fail(500, {
        errors: {
          _form:
            result.reason === "template_not_found"
              ? "Email template missing - run the latest migrations."
              : "Could not send the email. The token was created though.",
        },
      });
    }

    return { invitationSent: profile.email };
  },
};
