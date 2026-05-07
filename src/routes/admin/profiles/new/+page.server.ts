// /admin/profiles/new: admin creates a starter profile (with whatever
// info they have) and optionally fires a magic-link edit email so the
// artist can fill in the rest.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { generateToken, hashToken } from "$lib/server/tokens";
import { parseResumeData } from "$lib/server/resume";
import { expandLegacyResumeData } from "$lib/server/resumes";
import { suggestAlternatives, validateSlug } from "$lib/util/slug";

const EDIT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function parseResumesJson(raw: string): Array<{ label: string; url: string }> {
  if (!raw) return [];
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

  return {
    disciplines: disciplinesRes.data ?? [],
    disciplineCategories: (categoriesRes.data ?? []).map(
      (c: { name: string }) => c.name,
    ),
    areas: (areasRes.data ?? []) as Array<{ name: string; description: string | null }>,
    unions: unionsRes.data ?? [],
    options: {
      ethnicity: (ethnicitiesRes.data ?? []).map(
        (r: { name: string }) => r.name,
      ),
    },
  };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();

    const fullName = ((data.get("full_name") as string) ?? "").trim();
    const email = ((data.get("email") as string) ?? "").trim().toLowerCase();
    const slug = ((data.get("slug") as string) ?? "").trim().toLowerCase();
    const pronouns = ((data.get("pronouns") as string) ?? "").trim();
    const bio = ((data.get("bio") as string) ?? "").trim();
    const headshotUrl = ((data.get("headshot_url") as string) ?? "").trim();
    // Admin-created profiles auto-confirm consent when a headshot is
    // present - admin is vouching for rights outside the system, no
    // need for an extra checkbox. Mirrors the admin profile-edit save.
    const headshotConsent = !!headshotUrl;
    const area = ((data.get("area") as string) ?? "").trim();
    const city = ((data.get("city") as string) ?? "").trim();
    const resumesRaw = (data.get("resumes") as string) ?? "";
    const resumes = parseResumesJson(resumesRaw);
    const resumeData = parseResumeData(data.get("resume_data"));
    const mentorshipOffering = data
      .getAll("mentorship_offering")
      .map(String)
      .filter(Boolean);
    const mentorshipSeeking = data
      .getAll("mentorship_seeking")
      .map(String)
      .filter(Boolean);
    const disciplines = data.getAll("disciplines").map(String).filter(Boolean);
    const disciplineOther = ((data.get("discipline_other") as string) ?? "").trim();
    const publish = data.get("publish") !== "off";
    const sendLink = data.get("send_link") !== "off";

    const errors: Record<string, string> = {};
    if (!fullName) errors.full_name = "Required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Enter a valid email.";
    }
    const slugCheck = validateSlug(slug);
    if (!slugCheck.ok) errors.slug = slugCheck.reason;

    if (Object.keys(errors).length > 0) {
      return fail(400, {
        errors,
        values: {
          fullName, email, slug, pronouns, bio, headshotUrl, headshotConsent,
          area, city, disciplines, disciplineOther, publish, sendLink,
        },
      });
    }

    // Slug collision against live profiles.
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      const candidates = suggestAlternatives(fullName);
      const { data: takenRows } = await supabaseAdmin
        .from("profiles")
        .select("slug")
        .in("slug", candidates);
      const taken = new Set((takenRows ?? []).map((r: { slug: string }) => r.slug));
      const suggestions = candidates.filter((c) => !taken.has(c));
      return fail(409, {
        errors: { slug: "taken" },
        slugCollision: { requested: slug, suggestions },
        values: {
          fullName, email, slug, pronouns, bio, headshotUrl, headshotConsent,
          area, city, disciplines, disciplineOther, publish, sendLink,
        },
      });
    }

    // Resolve "Other" custom values.
    const finalDisciplines = [...disciplines];
    if (disciplineOther && finalDisciplines.includes("Other")) {
      finalDisciplines[finalDisciplines.indexOf("Other")] = disciplineOther;
    }
    const finalArea = area || null;

    const { data: profile, error: insertErr } = await supabaseAdmin
      .from("profiles")
      .insert({
        slug,
        full_name: fullName,
        email,
        pronouns: pronouns || null,
        bio: bio || null,
        disciplines: finalDisciplines,
        headshot_url: headshotUrl || null,
        headshot_consent: headshotConsent,
        geographic_area: finalArea,
        city: city || null,
        resumes,
        resume_data: resumeData,
        mentorship_offering: mentorshipOffering,
        mentorship_seeking: mentorshipSeeking,
        published: publish,
      })
      .select("id, slug, full_name, email")
      .single();

    if (!insertErr && profile) {
      // Expand the legacy resume_data jsonb into resume_entries rows so
      // the new multi-resume system has data on day one. Idempotent on
      // re-runs (creates a default resume if none exists).
      await expandLegacyResumeData(profile.id, resumeData);
    }

    if (insertErr || !profile) {
      console.error("admin profile create failed", insertErr);
      return fail(500, {
        errors: { _form: "Could not create profile." },
        values: {
          fullName, email, slug, pronouns, bio, headshotUrl, headshotConsent,
          area, city, disciplines, disciplineOther, publish, sendLink,
        },
      });
    }

    if (sendLink) {
      const token = generateToken();
      const tokenHash = hashToken(token);
      const expires = new Date(Date.now() + EDIT_TOKEN_TTL_MS).toISOString();
      await supabaseAdmin.from("magic_link_tokens").insert({
        token_hash: tokenHash,
        email: profile.email.toLowerCase(),
        purpose: "edit_profile",
        target_id: profile.id,
        expires_at: expires,
      });
      const editUrl = `${PUBLIC_SITE_URL}/edit/${token}`;
      await sendEmail({
        to: profile.email,
        templateSlug: "magic_link",
        vars: { name: profile.full_name, edit_url: editUrl },
      });
    }

    throw redirect(303, `/admin/profiles?created=${profile.slug}`);
  },
};
