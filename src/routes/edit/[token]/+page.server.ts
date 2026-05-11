// /edit/[token]: validate the magic-link token, render the artist's
// editable profile, accept changes, invalidate the token after a
// successful edit (single-use per BUILD_PLAN architecture commitment #7).
//
// Trust gate (step 12 phase B):
//   - profile.trusted = true → all edits apply directly.
//   - profile.trusted = false → minor fields (pronouns, area, age,
//     languages, unions, ethnicities, social links) apply directly;
//     major fields (full_name, bio, headshot_url, disciplines) get
//     queued in flagged_edits as one row per submission, jsonb-keyed
//     by field. Admin reviews + approves/rejects the bundle from
//     /admin/flagged-edits.

import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { hashToken } from "$lib/server/tokens";
import {
  ensureDefaultResume,
  loadProfileResumes,
} from "$lib/server/resumes";
import { isProfileIncomplete } from "$lib/server/profile-completeness";
import { logProfileEdit } from "$lib/server/profile-edit-log";
import { normalizeUrl } from "$lib/util/url";
import { isValidPhone, normalizePhone } from "$lib/util/phone";

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
      .map((r) => ({ label: r.label.trim().slice(0, 80), url: r.url }))
      .filter((r) => r.label.length > 0)
      .slice(0, 20);
  } catch {
    return [];
  }
}

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
      .eq("id", token.target_id)
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

  // Make sure this profile has at least one resume row so the new
  // builder always has something to add entries to. Cheap idempotent.
  await ensureDefaultResume(profileRes.data.id);
  const resumeSnapshot = await loadProfileResumes(profileRes.data.id);

  // Current callboard-digest subscription state, keyed by the profile's
  // email. Drives the opt-in toggle on the form.
  const subRes = profileRes.data.email
    ? await supabaseAdmin
        .from("callboard_subscriptions")
        .select("subscriber_email, unsubscribed_at")
        .eq("subscriber_email", profileRes.data.email.toLowerCase())
        .maybeSingle()
    : { data: null };
  const digestSubscribed = !!subRes.data && !subRes.data.unsubscribed_at;

  // What's missing for this profile to be publishable? Mirrors the
  // server-side validation in the save action below. Surfaced to the
  // page so we can render a "complete to publish" banner upfront for
  // bulk-imported profiles whose owner is opening their first edit
  // link. Once they fill these in and save, the action flips
  // published=true automatically.
  const p = profileRes.data;
  const missingFields: string[] = [];
  if (!p.full_name) missingFields.push("Name");
  if (!p.bio || !p.bio.trim()) missingFields.push("Bio");
  // Headshot is suppressed for minor profiles (we never display it
  // publicly), so it isn't required for them. The same exception
  // applies to the headshot_consent check below.
  if (!p.is_minor && !p.headshot_url) missingFields.push("Headshot or photo");
  if (!p.geographic_area) missingFields.push("Geographic area");
  if (!p.disciplines || p.disciplines.length === 0) {
    missingFields.push("At least one discipline");
  }
  if (!p.is_minor && p.headshot_url && !p.headshot_consent) {
    missingFields.push("Confirmation that you have rights to your photo");
  }

  return {
    profile: profileRes.data,
    digestSubscribed,
    missingFields,
    resumeSnapshot,
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
    const token = await loadValidToken(params.token);
    if (!token || !token.target_id) {
      return fail(401, { error: "Edit link is invalid or expired." });
    }

    const data = await request.formData();
    // Normalize CRLF to LF on every multi-line text field at the input
    // boundary. Browsers serialize textareas with the platform's native
    // line ending, but our stored bios came in over various paths
    // (bulk importer, admin edit form, public submit) with mixed
    // endings. Normalizing here means the trust-gate's bytewise compare
    // doesn't spuriously flag CRLF<->LF as a content change.
    const nlNorm = (s: string) => s.replace(/\r\n/g, "\n");
    const fullName = ((data.get("full_name") as string) ?? "").trim();
    const pronouns = ((data.get("pronouns") as string) ?? "").trim();
    const bio = nlNorm(((data.get("bio") as string) ?? "").trim());
    const phone = normalizePhone(data.get("phone") as string);
    if (phone && !isValidPhone(phone)) {
      return fail(400, { error: "Phone must have at least 7 digits or be left blank." });
    }
    const headshotUrl = ((data.get("headshot_url") as string) ?? "").trim();
    const headshotConsent = data.get("headshot_consent") === "on";
    const area = ((data.get("area") as string) ?? "").trim();
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
    // Resume builder entries are now relational (mig 078) and saved via
    // /api/edit/[token]/resumes + /entries during the edit session.
    // The form submit no longer carries resume_data.
    const mentorshipOffering = data
      .getAll("mentorship_offering")
      .map(String)
      .filter(Boolean);
    const mentorshipSeeking = data
      .getAll("mentorship_seeking")
      .map(String)
      .filter(Boolean);
    const subscribeDigest = data.get("subscribe_digest") === "on";

    const errors: Record<string, string> = {};
    if (!fullName) errors.full_name = "Required.";
    if (!bio) errors.bio = "Add a short bio so people can learn who you are.";
    if (!headshotUrl) {
      errors.headshot_url = "Add a clear photo of yourself.";
    } else if (!headshotConsent) {
      errors.headshot_consent = "Confirm rights to use the image.";
    }
    if (disciplines.length === 0) errors.disciplines = "Choose at least one discipline.";
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
    const finalArea = area;
    const languages = Array.from(
      new Set(
        languagesStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );

    // Pull current row to compare for the trust gate + to seed the
    // before-state for the audit log. The `*` is fine here - rows are
    // small and we already pay one round trip; this dedupes between the
    // trust-gate check below and the diff in profile-edit-log.
    const { data: current } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", token.target_id)
      .maybeSingle();
    if (!current) {
      return fail(500, {
        errors: { _form: "Profile not found." },
      });
    }

    // Major fields gated by trust. Minor fields apply directly either way.
    const proposedMajor: Record<string, unknown> = {};
    if (!current.trusted) {
      if (fullName !== current.full_name) {
        proposedMajor.full_name = fullName;
      }
      const newBio = bio || null;
      // Normalize both sides' line endings before comparing - existing
      // rows might still have CRLF from legacy imports while `bio` was
      // normalized at the input boundary above.
      const curBioNorm = current.bio ? nlNorm(current.bio) : null;
      if (newBio !== curBioNorm) {
        proposedMajor.bio = newBio;
      }
      const newHeadshot = headshotUrl || null;
      if (newHeadshot !== (current.headshot_url ?? null)) {
        proposedMajor.headshot_url = newHeadshot;
      }
      const sameDisc =
        Array.isArray(current.disciplines) &&
        current.disciplines.length === finalDisciplines.length &&
        current.disciplines.every((d: string, i: number) => d === finalDisciplines[i]);
      if (!sameDisc) {
        proposedMajor.disciplines = finalDisciplines;
      }
      // Resumes: deep-compare label+url pairs in order. Any change queues.
      const cur = (current.resumes ?? []) as Array<{ label: string; url: string }>;
      const sameResumes =
        cur.length === resumes.length &&
        cur.every(
          (r, i) => r.label === resumes[i].label && r.url === resumes[i].url,
        );
      if (!sameResumes) {
        proposedMajor.resumes = resumes;
      }
      // resume_data changes no longer flow through the trust gate -
      // entries live in their own tables (mig 078) and apply directly.
    }

    const minorUpdate: Record<string, unknown> = {
      pronouns: pronouns || null,
      // Phone: never rendered publicly; treated as a minor field today.
      // CASTING-TOOL-DAY: revisit. When phone routes callbacks, an
      // attacker who hijacks an account could rewrite it to impersonate
      // the artist to theatres - at that point phone may need to gate
      // through flagged_edits for untrusted profiles like other
      // load-bearing fields do.
      phone: phone || null,
      headshot_consent: headshotConsent,
      geographic_area: finalArea,
      city: city || null,
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
    };

    // Trusted: every change applies. Untrusted: only minor fields apply
    // directly; major changes (if any) get queued for admin review.
    const fullUpdate = current.trusted
      ? {
          ...minorUpdate,
          full_name: fullName,
          bio: bio || null,
          headshot_url: headshotUrl || null,
          disciplines: finalDisciplines,
          resumes,
        }
      : minorUpdate;

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update(fullUpdate)
      .eq("id", token.target_id);

    if (updateErr) {
      console.error("edit profile update failed", updateErr);
      return fail(500, {
        errors: { _form: "Could not save changes. Please try again." },
      });
    }

    // Auto-publish gate: bulk-imported profiles ship unpublished when
    // they're missing required info, AND launch-grace auto-hide flips
    // published=false on incomplete invited profiles after T+30. After
    // this save, refetch the row and check the publishable bar against
    // actual DB state (untrusted users' major-field edits go to
    // flagged_edits, not the row, so we can't trust the form submission
    // alone). Flip published only when every required field is
    // genuinely present.
    const { data: updated } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", token.target_id)
      .maybeSingle();
    if (updated && !updated.published && !isProfileIncomplete(updated)) {
      // Clear auto_hidden_incomplete when re-publishing so the next
      // hide cycle (if it ever fires again) treats it as a fresh case.
      await supabaseAdmin
        .from("profiles")
        .update({ published: true, auto_hidden_incomplete: false })
        .eq("id", token.target_id);
      // Reflect those two field changes in the diff snapshot too.
      if (updated) {
        updated.published = true;
        updated.auto_hidden_incomplete = false;
      }
    }

    // Audit log: capture what actually changed. Trusted users' edits all
    // applied above; untrusted users' major-field changes are still in
    // proposedMajor (about to be queued in flagged_edits), so the diff
    // here only reflects the minor-field part that landed in the row.
    if (current && updated) {
      await logProfileEdit(supabaseAdmin, {
        profileId: token.target_id,
        before: current,
        after: updated,
        kind: "artist",
        editorEmail: null,
      });
    }

    let queued = false;
    if (!current.trusted && Object.keys(proposedMajor).length > 0) {
      const { error: flagErr } = await supabaseAdmin
        .from("flagged_edits")
        .insert({
          profile_id: token.target_id,
          proposed_changes: proposedMajor,
          status: "pending",
        });
      if (flagErr) {
        console.error("flagged_edits insert failed", flagErr);
        // Surface a non-fatal warning. Minor changes already saved.
      } else {
        queued = true;
      }
    }

    // Sync the callboard-digest subscription to match the toggle. Uses
    // the profile's email + (final, possibly major-edit-pending)
    // disciplines. Stamps unsubscribed_at when toggling off so we keep
    // history; clears it on re-opt-in.
    if (token.email) {
      const subEmail = token.email.toLowerCase();
      const { data: existing } = await supabaseAdmin
        .from("callboard_subscriptions")
        .select("id, unsubscribed_at")
        .eq("subscriber_email", subEmail)
        .maybeSingle();
      if (subscribeDigest) {
        if (!existing) {
          await supabaseAdmin.from("callboard_subscriptions").insert({
            subscriber_email: subEmail,
            disciplines: finalDisciplines,
          });
        } else {
          await supabaseAdmin
            .from("callboard_subscriptions")
            .update({
              disciplines: finalDisciplines,
              unsubscribed_at: null,
            })
            .eq("id", existing.id);
        }
      } else if (existing && !existing.unsubscribed_at) {
        await supabaseAdmin
          .from("callboard_subscriptions")
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
    }

    // Burn the token now that the edit is in.
    await supabaseAdmin
      .from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", token.id);

    throw redirect(303, queued ? "/edit/done?queued=1" : "/edit/done");
  },

  // Graduate a minor profile to non-minor: clears is_minor + the
  // guardian fields. Only meaningful when is_minor=true on load. The
  // contact email column stays as-is - the artist can update it via
  // the regular form afterwards if they want a different address.
  // Headshot upload becomes available once the profile is non-minor.
  //
  // Token isn't burned by this action (different from the save flow):
  // graduating doesn't end the edit session, the user usually graduates
  // and then keeps editing (e.g. to upload a headshot now that they
  // can). The token still expires on its normal schedule.
  graduate: async ({ params }) => {
    const token = await loadValidToken(params.token);
    if (!token || !token.target_id) {
      return fail(401, { error: "Edit link is invalid or expired." });
    }
    const { error: updErr } = await supabaseAdmin
      .from("profiles")
      .update({
        is_minor: false,
        guardian_email: null,
        guardian_name: null,
      })
      .eq("id", token.target_id);
    if (updErr) {
      return fail(500, { error: "Could not update the profile. Try again." });
    }
    return { graduated: true };
  },
};
