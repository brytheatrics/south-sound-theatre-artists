// /edit/[token]: validate the magic-link token, render the artist's
// editable profile, accept changes, invalidate the token after a
// successful edit (single-use per BUILD_PLAN architecture commitment #7).
//
// All edits apply directly to the live profile in v1. The flagged_edits
// pipeline for major changes (headshot / disciplines) ships in step 12
// alongside admin profile management.

import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { hashToken } from "$lib/server/tokens";

async function loadValidToken(rawToken: string) {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = hashToken(rawToken);
  const { data } = await supabaseAdmin
    .from("magic_link_tokens")
    .select("id, email, target_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .eq("purpose", "edit_profile")
    .maybeSingle();
  if (!data) return null;
  if (data.used_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data;
}

export const load: PageServerLoad = async ({ params }) => {
  const token = await loadValidToken(params.token);
  if (!token || !token.target_id) error(404, "Edit link is invalid or expired.");

  const [profileRes, areasRes, disciplinesRes, categoriesRes, unionsRes] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", token.target_id)
        .maybeSingle(),
      supabaseAdmin.from("areas").select("name").order("sort_order"),
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
    ]);

  if (!profileRes.data) error(404, "Profile not found.");

  return {
    profile: profileRes.data,
    areas: (areasRes.data ?? []).map((a: { name: string }) => a.name),
    disciplines: disciplinesRes.data ?? [],
    disciplineCategories: (categoriesRes.data ?? []).map(
      (c: { name: string }) => c.name,
    ),
    unions: unionsRes.data ?? [],
    options: {
      ethnicity: [
        "African American / Black",
        "Asian",
        "Hispanic / Latino",
        "Indigenous / Native American",
        "Middle Eastern / North African",
        "Pacific Islander",
        "White / European",
        "Multiracial / Mixed",
        "Prefer not to say",
      ],
    },
  };
};

export const actions: Actions = {
  default: async ({ params, request }) => {
    const token = await loadValidToken(params.token);
    if (!token || !token.target_id) {
      return fail(401, { error: "Edit link is invalid or expired." });
    }

    const data = await request.formData();
    const fullName = ((data.get("full_name") as string) ?? "").trim();
    const pronouns = ((data.get("pronouns") as string) ?? "").trim();
    const bio = ((data.get("bio") as string) ?? "").trim();
    const headshotUrl = ((data.get("headshot_url") as string) ?? "").trim();
    const headshotConsent = data.get("headshot_consent") === "on";
    const area = ((data.get("area") as string) ?? "").trim();
    const areaOther = ((data.get("area_other") as string) ?? "").trim();
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

    const errors: Record<string, string> = {};
    if (!fullName) errors.full_name = "Required.";
    if (headshotUrl && !headshotConsent) {
      errors.headshot_consent = "Confirm rights to use the image.";
    }
    if (disciplines.length === 0) errors.disciplines = "Choose at least one.";
    if (!area) errors.area = "Choose an area.";
    if (area === "Other" && !areaOther) errors.area_other = "Tell us where.";

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
        pronouns: pronouns || null,
        bio: bio || null,
        headshot_url: headshotUrl || null,
        headshot_consent: headshotConsent,
        disciplines: finalDisciplines,
        geographic_area: finalArea,
        playable_age_min: ageMin,
        playable_age_max: ageMax,
        languages,
        unions: finalUnions,
        ethnicities: finalEthnicities,
        instagram_handle: instagram || null,
        facebook_url: facebook || null,
        tiktok_handle: tiktok || null,
        linkedin_url: linkedin || null,
        twitter_handle: twitter || null,
        youtube_url: youtube || null,
        website_url: website || null,
      })
      .eq("id", token.target_id);

    if (updateErr) {
      console.error("edit profile update failed", updateErr);
      return fail(500, {
        errors: { _form: "Could not save changes. Please try again." },
      });
    }

    // Burn the token now that the edit is in.
    await supabaseAdmin
      .from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", token.id);

    throw redirect(303, "/edit/done");
  },
};
