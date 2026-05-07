// /admin/organizations: single page that manages every theatre we list.
// Folds together the old /admin/event-sources (calendar-sync sources)
// and /admin/orgs (verified-org applications) - they describe the same
// thing and now share one row in `organizations`.
//
// Sections on the page:
//   - Pending verification: contact_email set + verified=false
//   - Verified orgs: verified=true (callboard / calendar auto-publish)
//   - Pulled automatically: adapter != 'manual'
//   - Added by hand: adapter == 'manual'

import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { fail } from "@sveltejs/kit";
import pg from "pg";
import { syncEventSource } from "../../../../scripts/_lib/calendar-sync.mjs";
import { sendEmail } from "$lib/server/email";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { generateToken, hashToken } from "$lib/server/tokens";
import { env as privateEnv } from "$env/dynamic/private";

const { Client } = pg;

export const load: PageServerLoad = async ({ url }) => {
  const justCreated = url.searchParams.get("created") ?? "";

  const { data: orgs, error } = await supabaseAdmin
    .from("organizations")
    .select(
      `id, slug, name, source_url, adapter, cadence_days, active,
       last_status, last_show_count, last_checked_at, last_successful_at,
       last_error, cooldown_until, notes, updated_at, area_id,
       description, homepage_url, public_email, logo_url, logo_bg,
       contact_email, verified, created_at`,
    )
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;

  const { data: areas } = await supabaseAdmin
    .from("areas")
    .select("id, name, sort_order")
    .order("sort_order");
  const areaNameById = new Map((areas ?? []).map((a) => [a.id, a.name]));

  const enriched = (orgs ?? []).map((s) => ({
    ...s,
    area_name: s.area_id ? areaNameById.get(s.area_id) ?? null : null,
    is_manual: s.adapter === "manual",
  }));

  return {
    pendingVerification: enriched.filter(
      (o) => o.contact_email && !o.verified,
    ),
    verifiedOrgs: enriched.filter((o) => o.verified),
    autoSources: enriched.filter((o) => !o.is_manual),
    manualSources: enriched.filter((o) => o.is_manual),
    justCreated,
  };
};

export const actions: Actions = {
  // Save the public-facing /theatres metadata. Same shape as the old
  // event-sources updatePublic action.
  updatePublic: async ({ request }) => {
    const fd = await request.formData();
    const id = String(fd.get("id") ?? "");
    if (!id) return fail(400, { error: "missing organization id" });

    const description = String(fd.get("description") ?? "").trim();
    const homepageUrl = String(fd.get("homepage_url") ?? "").trim();
    const logoUrl = String(fd.get("logo_url") ?? "").trim();
    const logoBg = String(fd.get("logo_bg") ?? "paper").trim();

    const looksLikeUrl = (s: string) => /^https?:\/\//i.test(s);
    if (homepageUrl && !looksLikeUrl(homepageUrl)) {
      return fail(400, { error: "Homepage URL must start with http:// or https://" });
    }
    if (logoUrl && !looksLikeUrl(logoUrl)) {
      return fail(400, { error: "Logo URL must start with http:// or https://" });
    }
    if (description.length > 500) {
      return fail(400, { error: "Description should be under 500 characters." });
    }
    const validBgs = ["paper", "paper-2", "bg-raised", "ink", "accent"];
    if (!validBgs.includes(logoBg)) {
      return fail(400, { error: "Invalid logo background choice." });
    }

    const { data: row, error } = await supabaseAdmin
      .from("organizations")
      .update({
        description: description || null,
        homepage_url: homepageUrl || null,
        logo_url: logoUrl || null,
        logo_bg: logoBg,
      })
      .eq("id", id)
      .select("slug")
      .maybeSingle();
    if (error || !row) return fail(500, { error: "Could not save." });
    return { savedPublic: row.slug };
  },

  setActive: async ({ request }) => {
    const fd = await request.formData();
    const id = String(fd.get("id") ?? "");
    const active = fd.get("active") === "true";
    if (!id) return fail(400, { error: "missing organization id" });
    const { data: row, error } = await supabaseAdmin
      .from("organizations")
      .update({ active })
      .eq("id", id)
      .select("slug")
      .maybeSingle();
    if (error || !row) return fail(500, { error: "Could not update." });
    return { activeSet: { slug: row.slug, active } };
  },

  setAdapter: async ({ request }) => {
    const fd = await request.formData();
    const id = String(fd.get("id") ?? "");
    const adapter = String(fd.get("adapter") ?? "");
    if (!id) return fail(400, { error: "missing organization id" });
    if (adapter !== "ai-generic" && adapter !== "manual") {
      return fail(400, { error: "adapter must be ai-generic or manual" });
    }
    const { data: row, error } = await supabaseAdmin
      .from("organizations")
      .update({ adapter })
      .eq("id", id)
      .select("slug")
      .maybeSingle();
    if (error || !row) return fail(500, { error: "Could not update." });
    return { adapterSet: { slug: row.slug, adapter } };
  },

  // Approve a pending verification application. Also fires the
  // org_approved email so the contact knows their callboard +
  // calendar submissions will now skip the per-post review.
  approveVerification: async ({ request }) => {
    const fd = await request.formData();
    const ids = fd.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });

    for (const id of ids) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("name, contact_email")
        .eq("id", id)
        .maybeSingle();
      if (!org || !org.contact_email) continue;

      await supabaseAdmin
        .from("organizations")
        .update({ verified: true })
        .eq("id", id);

      await sendEmail({
        to: org.contact_email,
        templateSlug: "org_approved",
        vars: {
          name: org.name,
          org_name: org.name,
          callboard_url: `${PUBLIC_SITE_URL}/callboard`,
          calendar_url: `${PUBLIC_SITE_URL}/calendar`,
        },
      });
    }

    return { verified: ids.length };
  },

  // Issues an org-edit magic-link token and returns the URL for the
  // admin to copy + send to the org rep out of band. v1.1: kept admin-
  // mediated rather than self-serve to avoid a public form + email
  // sender. Token is single-use semantics-aside (purpose='org_edit'),
  // valid for 60 days.
  issueOrgEditLink: async ({ request }) => {
    const fd = await request.formData();
    const id = String(fd.get("id") ?? "");
    if (!id) return fail(400, { error: "missing organization id" });
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name, contact_email")
      .eq("id", id)
      .maybeSingle();
    if (!org) return fail(404, { error: "Organization not found." });
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const { error: insertErr } = await supabaseAdmin
      .from("magic_link_tokens")
      .insert({
        token_hash: tokenHash,
        email: org.contact_email,
        purpose: "org_edit",
        target_id: org.id,
        expires_at: expiresAt,
      });
    if (insertErr) return fail(500, { error: "Could not create token." });
    return {
      orgEditLink: {
        url: `${PUBLIC_SITE_URL}/org-edit/${token}`,
        org_name: org.name,
        contact_email: org.contact_email,
        expires_at: expiresAt,
      },
    };
  },

  revokeVerification: async ({ request }) => {
    const fd = await request.formData();
    const ids = fd.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ verified: false })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not revoke." });
    return { revoked: ids.length };
  },

  softDelete: async ({ request }) => {
    const fd = await request.formData();
    const ids = fd.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ deleted_at: new Date().toISOString(), verified: false, active: false })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not delete." });
    return { deleted: ids.length };
  },

  refresh: async ({ request }) => {
    if (!privateEnv.ANTHROPIC_API_KEY) return fail(500, { error: "ANTHROPIC_API_KEY not configured" });
    const fd = await request.formData();
    const sourceId = String(fd.get("id") ?? "");
    if (!sourceId) return fail(400, { error: "missing organization id" });

    const db = new Client({ connectionString: privateEnv.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
    await db.connect();
    try {
      // syncEventSource expects org_slug / org_name field names from the
      // old event_sources rows. Alias on read so the lib doesn't have to
      // change shape.
      const sourceRes = await db.query(
        `select id,
                slug as org_slug,
                name as org_name,
                source_url, adapter, last_hash,
                last_show_count, cadence_days, last_checked_at, last_status,
                cooldown_until
           from public.organizations where id = $1`,
        [sourceId],
      );
      const source = sourceRes.rows[0];
      if (!source) return fail(404, { error: "organization not found" });

      if (source.cooldown_until && new Date(source.cooldown_until) > new Date()) {
        const minsLeft = Math.ceil(
          (new Date(source.cooldown_until).getTime() - Date.now()) / 60_000,
        );
        return fail(429, {
          error: `Cooldown - try again in ${minsLeft} minute${minsLeft === 1 ? "" : "s"}.`,
        });
      }

      const result = await syncEventSource(db, source, { force: true });
      return {
        refreshed: source.org_slug,
        result: {
          status: result.status,
          showCount: result.showCount ?? 0,
          performanceCount: result.performanceCount ?? 0,
          cost: result.cost ?? 0,
          error: result.error,
        },
      };
    } catch (err) {
      return fail(500, { error: String(err).slice(0, 500) });
    } finally {
      await db.end();
    }
  },
};
