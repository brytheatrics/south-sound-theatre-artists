// TEMPORARY (delete before launch). Helpers for /admin/email-test.
//
// Builds real send arguments for every email_templates row so an admin
// can validate end-to-end delivery — including click-throughs that
// resolve to real flows. Each per-template builder mints actual tokens
// (where the template has a link with a token) tied to a designated
// "Test Profile" / "Test Org" / etc. so clicking the link in the
// received email lands the admin on a working page.
//
// Recipient is hard-coded to TEST_RECIPIENT for safety. Bypasses the
// EMAIL_PAUSE_COMMUNITY kill switch via sendEmail's bypassPause flag.
//
// To remove after launch:
//   1. Delete this file.
//   2. Delete src/routes/admin/email-test/.
//   3. Optionally remove the bypassPause flag from sendEmail() if no
//      other code path needs it. (None will at that point.)

import { randomBytes } from "node:crypto";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { generateToken, hashToken } from "$lib/server/tokens";
import { buildDigestVars } from "$lib/server/digest-build";

export const TEST_RECIPIENT = "ssta.admin@gmail.com";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// ----- Test target setup --------------------------------------------
//
// Each helper upserts a stable "test" row keyed by slug/email so repeat
// runs reuse the same target instead of cluttering the DB.

async function getOrCreateTestProfile(): Promise<{
  id: string;
  email: string;
  full_name: string;
  slug: string;
}> {
  const slug = "test-profile";
  const email = TEST_RECIPIENT;
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing;

  // Insert a minimal published=false profile. Won't appear in /directory
  // or anywhere else public, but the magic-link edit flow loads by ID
  // from the token regardless of published state, so the link works.
  const { data: created, error } = await supabaseAdmin
    .from("profiles")
    .insert({
      email,
      slug,
      full_name: "Test Profile",
      bio: "Internal test profile used by /admin/email-test. Not publicly visible.",
      disciplines: ["Actor"],
      published: false,
      trusted: true,
    })
    .select("id, email, full_name, slug")
    .single();
  if (error || !created) {
    throw new Error(`could not create test profile: ${error?.message}`);
  }
  return created;
}

async function getOrCreateTestOrg(): Promise<{
  id: string;
  name: string;
  slug: string;
  contact_email: string | null;
}> {
  const slug = "test-org";
  const { data: existing } = await supabaseAdmin
    .from("organizations")
    .select("id, name, slug, contact_email")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabaseAdmin
    .from("organizations")
    .insert({
      slug,
      name: "Test Organization",
      contact_email: TEST_RECIPIENT,
      verified: true,
      adapter: "manual",
      active: false, // skip cron entirely
    })
    .select("id, name, slug, contact_email")
    .single();
  if (error || !created) {
    throw new Error(`could not create test org: ${error?.message}`);
  }
  return created;
}

async function getOrCreateTestPendingSubmission(): Promise<{
  id: string;
  email: string;
  full_name: string;
  email_verification_token: string;
}> {
  // Reset the verification token every call so the verify URL works.
  // Raw token goes in the URL; only its SHA-256 hash is stored - matches
  // the convention enforced by /submit/+page.server.ts so the verify
  // route's hash-lookup actually finds the row.
  const verificationToken = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(verificationToken);
  const { data: existing } = await supabaseAdmin
    .from("pending_submissions")
    .select("id")
    .eq("email", TEST_RECIPIENT)
    .eq("status", "pending_email")
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("pending_submissions")
      .update({
        email_verification_token_hash: tokenHash,
        email_verification_expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      })
      .eq("id", existing.id);
    return {
      id: existing.id,
      email: TEST_RECIPIENT,
      full_name: "Test Profile",
      email_verification_token: verificationToken,
    };
  }

  const { data: created, error } = await supabaseAdmin
    .from("pending_submissions")
    .insert({
      email: TEST_RECIPIENT,
      full_name: "Test Profile",
      bio: "Test submission",
      disciplines: ["Actor"],
      desired_slug: "test-profile-pending",
      status: "pending_email",
      email_verified: false,
      email_verification_token_hash: tokenHash,
      email_verification_expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    })
    .select("id, email, full_name")
    .single();
  if (error || !created) {
    throw new Error(`could not create test pending submission: ${error?.message}`);
  }
  return { ...created, email_verification_token: verificationToken };
}

async function getOrCreateTestCallboardPost(): Promise<{
  id: string;
  title: string;
  organization_name: string;
  email_verification_token: string;
}> {
  const verificationToken = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(verificationToken);
  const { data: existing } = await supabaseAdmin
    .from("callboard_posts")
    .select("id, title, organization_name")
    .eq("submitter_email", TEST_RECIPIENT)
    .eq("title", "TEST CALLBOARD POST")
    .maybeSingle();
  if (existing) {
    await supabaseAdmin
      .from("callboard_posts")
      .update({
        email_verification_token_hash: tokenHash,
        email_verification_expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      })
      .eq("id", existing.id);
    return { ...existing, email_verification_token: verificationToken };
  }
  const { data: created, error } = await supabaseAdmin
    .from("callboard_posts")
    .insert({
      title: "TEST CALLBOARD POST",
      organization_name: "Test Organization",
      post_type: "audition",
      submitter_email: TEST_RECIPIENT,
      description: "Internal test post for /admin/email-test.",
      status: "pending_email",
      published: false,
      email_verification_token_hash: tokenHash,
      email_verification_expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    })
    .select("id, title, organization_name")
    .single();
  if (error || !created) {
    throw new Error(`could not create test callboard post: ${error?.message}`);
  }
  return { ...created, email_verification_token: verificationToken };
}

async function getOrCreateTestProduction(orgId: string): Promise<{
  id: string;
  title: string;
  email_verification_token: string;
}> {
  const verificationToken = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(verificationToken);
  const { data: existing } = await supabaseAdmin
    .from("productions")
    .select("id, title")
    .eq("submitter_email", TEST_RECIPIENT)
    .eq("title", "TEST PRODUCTION")
    .maybeSingle();
  if (existing) {
    await supabaseAdmin
      .from("productions")
      .update({
        email_verification_token_hash: tokenHash,
        email_verification_expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      })
      .eq("id", existing.id);
    return { ...existing, email_verification_token: verificationToken };
  }
  const { data: created, error } = await supabaseAdmin
    .from("productions")
    .insert({
      title: "TEST PRODUCTION",
      organization_name: "Test Organization",
      organization_id: orgId,
      submitter_email: TEST_RECIPIENT,
      run_start: "2099-01-01",
      run_end: "2099-01-31",
      status: "pending_email",
      email_verification_token_hash: tokenHash,
      email_verification_expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    })
    .select("id, title")
    .single();
  if (error || !created) {
    throw new Error(`could not create test production: ${error?.message}`);
  }
  return { ...created, email_verification_token: verificationToken };
}

// Idempotent. The first call creates the row pre-confirmed (confirmed_at
// stamped, include_blog=true) so the digest preview works without
// stepping through the double-opt-in. The subscription_confirm test
// case re-mints the confirmation token + clears confirmed_at to make
// that flow testable on demand.
async function getOrCreateTestSubscription(opts?: {
  resetConfirmation?: boolean;
}): Promise<{
  id: string;
  confirmation_token: string;
  unsubscribe_token: string;
}> {
  const confirmationToken = randomBytes(24).toString("base64url");
  const { data: existing } = await supabaseAdmin
    .from("callboard_subscriptions")
    .select("id, unsubscribe_token")
    .eq("subscriber_email", TEST_RECIPIENT)
    .maybeSingle();
  if (existing) {
    const update: Record<string, unknown> = {
      preferences_updated_at: new Date().toISOString(),
    };
    if (opts?.resetConfirmation) {
      update.confirmation_token = confirmationToken;
      update.confirmed_at = null;
      update.unsubscribed_at = null;
    }
    await supabaseAdmin
      .from("callboard_subscriptions")
      .update(update)
      .eq("id", existing.id);
    return {
      id: existing.id,
      confirmation_token: confirmationToken,
      unsubscribe_token: existing.unsubscribe_token,
    };
  }
  const unsubscribeToken = randomBytes(24).toString("base64url");
  const { data: created, error } = await supabaseAdmin
    .from("callboard_subscriptions")
    .insert({
      subscriber_email: TEST_RECIPIENT,
      confirmation_token: confirmationToken,
      unsubscribe_token: unsubscribeToken,
      // Pre-confirmed so the digest preview works immediately; the
      // subscription_confirm test case reverses this when needed.
      confirmed_at: opts?.resetConfirmation ? null : new Date().toISOString(),
      include_blog: true,
      preferences_updated_at: new Date().toISOString(),
    })
    .select("id, unsubscribe_token")
    .single();
  if (error || !created) {
    throw new Error(`could not create test subscription: ${error?.message}`);
  }
  return {
    id: created.id,
    confirmation_token: confirmationToken,
    unsubscribe_token: created.unsubscribe_token,
  };
}

// ----- Token minters -------------------------------------------------

async function mintEditProfileToken(profileId: string, email: string): Promise<string> {
  const raw = generateToken();
  await supabaseAdmin.from("magic_link_tokens").insert({
    token_hash: hashToken(raw),
    email,
    purpose: "edit_profile",
    target_id: profileId,
    expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  });
  return raw;
}

async function mintOrgEditToken(orgId: string, email: string): Promise<string> {
  const raw = generateToken();
  await supabaseAdmin.from("magic_link_tokens").insert({
    token_hash: hashToken(raw),
    email,
    purpose: "org_edit",
    target_id: orgId,
    expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return raw;
}

// ----- Per-template send dispatcher ---------------------------------

type SendResult = { ok: true; note?: string } | { ok: false; reason: string };

export async function sendTestEmail(slug: string): Promise<SendResult> {
  try {
    const { vars, replyTo } = await buildVars(slug);
    const result = await sendEmail({
      to: TEST_RECIPIENT,
      templateSlug: slug,
      vars,
      replyTo,
      bypassPause: true,
    });
    if (result.ok) return { ok: true };
    return { ok: false, reason: result.reason };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}

async function buildVars(
  slug: string,
): Promise<{ vars: Record<string, string>; replyTo?: string }> {
  switch (slug) {
    // No-token templates - just sample vars
    case "admin_2fa":
      return { vars: { code: "123456" } };

    case "admin_daily_digest":
      return {
        vars: {
          verb: "are",
          total: "3",
          plural: "s",
          breakdown:
            "- 2 pending profile submissions\n- 1 flagged edit\n- 0 open reports",
          admin_url: `${PUBLIC_SITE_URL}/admin`,
        },
      };

    case "admin_volume_alert":
      return { vars: { sent: "2100", cap: "3000", percent: "70" } };

    case "calendar_approved":
      return {
        vars: {
          name: "Test Submitter",
          title: "TEST PRODUCTION",
          calendar_url: `${PUBLIC_SITE_URL}/calendar`,
        },
      };

    case "calendar_rejected":
      return {
        vars: {
          name: "Test Submitter",
          title: "TEST PRODUCTION",
          reason:
            "This is a sample rejection reason to verify the rejection email renders.",
        },
      };

    case "callboard_approved":
      return {
        vars: {
          name: "Test Submitter",
          title: "TEST CALLBOARD POST",
          callboard_url: `${PUBLIC_SITE_URL}/callboard`,
        },
      };

    case "callboard_rejected":
      return {
        vars: {
          name: "Test Submitter",
          title: "TEST CALLBOARD POST",
          reason:
            "This is a sample rejection reason to verify the rejection email renders.",
        },
      };

    case "contact_routed":
      return {
        vars: {
          recipient_name: "Test Profile",
          sender_name: "Test Sender",
          sender_email: "test-sender@example.com",
          message:
            "Hi! This is a test contact message routed through the directory. Reply to this email to confirm reply-to wiring.",
        },
        replyTo: "test-sender@example.com",
      };

    case "daily_digest":
      return {
        vars: {
          pending_submissions: "2",
          flagged_edits: "1",
          open_reports: "0",
          admin_url: `${PUBLIC_SITE_URL}/admin`,
        },
      };

    case "org_application_received":
      return {
        vars: { name: "Test Organization Contact" },
      };

    case "rejection":
      return {
        vars: {
          name: "Test Profile",
          reason:
            "This is a sample rejection reason to verify the rejection email renders.",
        },
      };

    // Magic-link based templates - all point at the Test Profile
    case "magic_link":
    case "magic_link_resend": {
      const profile = await getOrCreateTestProfile();
      const raw = await mintEditProfileToken(profile.id, profile.email);
      return {
        vars: {
          name: profile.full_name,
          edit_url: `${PUBLIC_SITE_URL}/edit/${raw}`,
        },
      };
    }

    case "welcome": {
      const profile = await getOrCreateTestProfile();
      const raw = await mintEditProfileToken(profile.id, profile.email);
      return {
        vars: {
          name: profile.full_name,
          profile_url: `${PUBLIC_SITE_URL}/artists/${profile.slug}`,
          edit_url: `${PUBLIC_SITE_URL}/edit/${raw}`,
        },
      };
    }

    case "admin_invitation": {
      const profile = await getOrCreateTestProfile();
      const raw = await mintEditProfileToken(profile.id, profile.email);
      return {
        vars: {
          name: profile.full_name,
          edit_url: `${PUBLIC_SITE_URL}/edit/${raw}`,
          profile_url: `${PUBLIC_SITE_URL}/artists/${profile.slug}`,
          site_url: PUBLIC_SITE_URL,
        },
      };
    }

    case "stale_profile_ping": {
      const profile = await getOrCreateTestProfile();
      const raw = await mintEditProfileToken(profile.id, profile.email);
      return {
        vars: {
          name: profile.full_name,
          still_active_url: `${PUBLIC_SITE_URL}/still-active/${raw}`,
          edit_url: `${PUBLIC_SITE_URL}/edit/${raw}`,
        },
      };
    }

    case "launch_completion_warning": {
      const profile = await getOrCreateTestProfile();
      const raw = await mintEditProfileToken(profile.id, profile.email);
      const hideDate = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString(
        "en-US",
        { month: "long", day: "numeric", year: "numeric" },
      );
      return {
        vars: {
          name: profile.full_name,
          // Sample missing fields list. The real cron formats from
          // missingRequiredFields() per profile.
          missing_fields:
            "- Bio\n- Headshot photo + rights confirmation\n- At least one discipline",
          hide_date: hideDate,
          edit_url: `${PUBLIC_SITE_URL}/edit/${raw}`,
        },
      };
    }

    // Verification-token templates
    case "email_verification": {
      const sub = await getOrCreateTestPendingSubmission();
      return {
        vars: {
          name: sub.full_name,
          verify_url: `${PUBLIC_SITE_URL}/submit/verify/${sub.email_verification_token}`,
        },
      };
    }

    case "callboard_verify": {
      const post = await getOrCreateTestCallboardPost();
      return {
        vars: {
          name: "Test Submitter",
          verify_url: `${PUBLIC_SITE_URL}/callboard/verify/${post.email_verification_token}`,
        },
      };
    }

    case "calendar_verify": {
      const org = await getOrCreateTestOrg();
      const prod = await getOrCreateTestProduction(org.id);
      return {
        vars: {
          name: "Test Submitter",
          title: prod.title,
          verify_url: `${PUBLIC_SITE_URL}/calendar/verify/${prod.email_verification_token}`,
        },
      };
    }

    case "subscription_confirm": {
      // This test specifically validates the confirm flow. Reset the
      // subscription's confirmed_at so the link actually changes state
      // when clicked.
      const sub = await getOrCreateTestSubscription({ resetConfirmation: true });
      return {
        vars: {
          confirm_url: `${PUBLIC_SITE_URL}/callboard/subscribe/confirm/${sub.confirmation_token}`,
        },
      };
    }

    case "callboard_weekly_digest": {
      // Real preview: pull live DB data through the actual digest
      // builder so the test send shows what subscribers will receive
      // on Sunday. The test subscription is pre-confirmed with
      // include_blog=true and empty filter arrays (= firehose), so
      // every callboard post + production + blog post that matches
      // the section windows shows up. sinceOverride covers the past
      // 7 days so we get a realistic week of content even on a
      // freshly-created test subscription.
      const sub = await getOrCreateTestSubscription();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { vars } = await buildDigestVars(sub.id, { sinceOverride: sevenDaysAgo });
      return { vars };
    }

    case "org_approved": {
      const org = await getOrCreateTestOrg();
      // org_approved is sent when admin verifies an org. The body links
      // back to the public surfaces, plus an embedded org_edit token is
      // typical so the rep can manage credits. Mint one here.
      await mintOrgEditToken(org.id, TEST_RECIPIENT);
      return {
        vars: {
          name: "Test Organization Contact",
          org_name: org.name,
          callboard_url: `${PUBLIC_SITE_URL}/callboard`,
          calendar_url: `${PUBLIC_SITE_URL}/calendar`,
        },
      };
    }

    default:
      throw new Error(`unknown template slug: ${slug}`);
  }
}
