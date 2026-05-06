// scripts/send-launch-invitations.mjs
//
// One-shot operational script. For every published profile that hasn't
// been invited yet, mints a fresh 30-day single-use edit token + sends
// the `admin_invitation` email so the artist can claim their page.
//
// Skip rules:
//   - Profiles where slug is on the SKIP_SLUGS list (Blake + Lexi don't
//     need an invitation to their own seeded profiles).
//   - Profiles whose email is the @unknown.ssta.local placeholder used
//     by the bulk importer when no real address was supplied.
//   - Profiles where an admin_invitation email has already gone out in
//     the past 30 days (re-run-safe; doesn't email someone twice).
//     Note we check email_log for actual sends, not magic_link_tokens
//     for unused tokens - the bulk importer mints tokens up-front for
//     mail-merge, so those exist for everyone but no email's gone yet.
//
// Flags:
//   --dry-run       walk the list + print would-send, no token or email
//   --slug=<slug>   only process the matching profile (test path; use
//                   --slug=lexi-barnett or --slug=blake-r-york first)
//   --force         ignore the recent-invitation guard. Use only if you
//                   really mean to send a duplicate (e.g. the original
//                   email bounced).
//
// All sends route through `sendCronEmail` -> Resend so they hit
// `email_log` and the existing template / blocklist machinery, same as
// every other cron in the repo.

import { createHash, randomBytes } from "node:crypto";
import { getDb, sendCronEmail, exitOk, exitFail } from "./_lib/cron.mjs";

const SKIP_SLUGS = new Set(["lexi-barnett", "blake-r-york"]);
const PLACEHOLDER_EMAIL_SUFFIX = "@unknown.ssta.local";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_INVITE_DAYS = 30;

function parseFlags(argv) {
  const flags = { dryRun: false, slug: null, force: false };
  for (const a of argv.slice(2)) {
    if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--force") flags.force = true;
    else if (a.startsWith("--slug=")) flags.slug = a.slice("--slug=".length);
  }
  return flags;
}

function generateToken() {
  return randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function main() {
  const flags = parseFlags(process.argv);
  const siteUrl =
    process.env.PUBLIC_SITE_URL || "https://southsoundtheatreartists.org";

  const db = getDb();
  await db.connect();
  try {
    // Pull the candidate profile rows. Filter happens in JS for clarity
    // (the SKIP_SLUGS / placeholder-email checks are short and the
    // dataset is ~30 rows).
    const profilesRes = await db.query(
      `select id, slug, full_name, email
         from profiles
        where published = true
          and deleted_at is null
        ${flags.slug ? "and slug = $1" : ""}
        order by full_name`,
      flags.slug ? [flags.slug] : [],
    );

    // Fetch the email signature once. cron.mjs's substitute() leaves
    // unknown vars as empty string; the in-app sendEmail wrapper auto-
    // injects {{signature}} from site_content.email_signature, and we
    // mirror that here so the cron path doesn't diverge silently.
    const sigRes = await db.query(
      `select body_markdown from site_content where slug = 'email_signature'`,
    );
    const signature = sigRes.rows[0]?.body_markdown ?? "";

    let sent = 0;
    let skipped = 0;
    let alreadyInvited = 0;
    let errored = 0;

    for (const p of profilesRes.rows) {
      if (SKIP_SLUGS.has(p.slug)) {
        skipped++;
        console.log(`skip ${p.slug} (in SKIP_SLUGS)`);
        continue;
      }
      if (p.email && p.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) {
        skipped++;
        console.log(`skip ${p.slug} (placeholder email)`);
        continue;
      }
      if (!p.email) {
        skipped++;
        console.warn(`skip ${p.slug} (no email)`);
        continue;
      }

      // Recent-invitation guard: skip if an admin_invitation email has
      // actually gone out to this artist in the past N days. Checked
      // via email_log.recipient_hash (sha256 of the lowercased email)
      // rather than via magic_link_tokens - the bulk importer pre-mints
      // tokens for mail-merge, so token-existence is not proof of send.
      if (!flags.force) {
        const recipientHash = createHash("sha256")
          .update(p.email.toLowerCase())
          .digest("hex");
        const recentRes = await db.query(
          `select id from email_log
            where recipient_hash = $1
              and email_type = 'admin_invitation'
              and status = 'sent'
              and sent_at > now() - interval '${RECENT_INVITE_DAYS} days'
            limit 1`,
          [recipientHash],
        );
        if (recentRes.rowCount && recentRes.rowCount > 0) {
          alreadyInvited++;
          console.log(`skip ${p.slug} (already invited recently)`);
          continue;
        }
      }

      const token = generateToken();
      const tokenHash = hashToken(token);
      const expires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
      const editUrl = `${siteUrl}/edit/${token}`;
      const profileUrl = `${siteUrl}/artists/${p.slug}`;

      if (flags.dryRun) {
        console.log(`would send to ${p.email} -> ${editUrl}`);
        sent++;
        continue;
      }

      // Insert the token first; if the email send fails we'll have an
      // orphaned token but that's preferable to sending an email with
      // an unrooted link.
      await db.query(
        `insert into magic_link_tokens
           (token_hash, email, purpose, target_id, expires_at)
         values ($1, $2, 'edit_profile', $3, $4)`,
        [tokenHash, p.email.toLowerCase(), p.id, expires],
      );

      const result = await sendCronEmail(db, {
        to: p.email,
        templateSlug: "admin_invitation",
        vars: {
          name: p.full_name,
          edit_url: editUrl,
          profile_url: profileUrl,
          site_url: siteUrl,
          signature,
        },
      });

      if (result.ok) {
        sent++;
        console.log(`sent ${p.slug}`);
      } else {
        errored++;
        console.warn(`send failed for ${p.slug}: ${result.reason}`);
      }
    }

    const verb = flags.dryRun ? "would-send" : "sent";
    exitOk(
      `launch invitations done: ${verb}=${sent}, ` +
        `skipped=${skipped}, already_invited=${alreadyInvited}, errored=${errored}`,
    );
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  exitFail("send-launch-invitations crashed");
});
