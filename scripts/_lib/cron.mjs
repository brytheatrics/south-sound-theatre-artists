// scripts/_lib/cron.mjs
//
// Shared infrastructure for all GitHub Actions cron scripts. Provides:
//   - getDb(): a connected pg Client (uses SUPABASE_DB_URL)
//   - sendCronEmail(): mirrors the in-app sendEmail wrapper (template
//     pull, {{var}} substitution, blocklist check, email_log row, Resend
//     POST). Kept in a separate file so the in-app and cron paths don't
//     diverge silently.
//   - exitOk / exitFail: consistent log format for GitHub Actions output.
//
// The crons aren't part of the SvelteKit build, so they can't import
// $env / $lib. They use plain dotenv for local dev and lean on the
// workflow's `env:` block for CI.

import { createHash } from "node:crypto";
import { renderMarkdownLite, wrapHtmlEmail } from "./email-html.mjs";
import "dotenv/config";
import pg from "pg";

const { Client } = pg;

export function getDb() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    exitFail("SUPABASE_DB_URL is not set");
  }
  return new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
}

/**
 * Send an email via Resend, going through the same blocklist + email_log
 * + template-substitution flow the in-app sendEmail uses.
 *
 * @param {pg.Client} db
 * @param {{ to: string, templateSlug: string, vars: Record<string,string>, replyTo?: string }} args
 * @returns {Promise<{ok: true} | {ok: false, reason: string}>}
 */
export async function sendCronEmail(db, { to, templateSlug, vars, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, reason: "resend_env_missing" };
  }

  const recipient = to.trim().toLowerCase();

  // Blocklist - silent success.
  const blocked = await db.query(
    `select 1 from email_blocklist where email = $1 limit 1`,
    [recipient],
  );
  if (blocked.rowCount && blocked.rowCount > 0) return { ok: true };

  // Template lookup.
  const tmplRes = await db.query(
    `select subject, body_markdown from email_templates where slug = $1`,
    [templateSlug],
  );
  if (tmplRes.rowCount === 0) {
    console.error(`email template not found: ${templateSlug}`);
    return { ok: false, reason: "template_not_found" };
  }
  const subject = substitute(tmplRes.rows[0].subject, vars);
  const body = substitute(tmplRes.rows[0].body_markdown, vars);

  // Log first so a failed send still leaves a record.
  const recipientHash = createHash("sha256").update(recipient).digest("hex");
  const logIns = await db.query(
    `insert into email_log (recipient_hash, email_type, subject, status)
     values ($1, $2, $3, 'sent')
     returning id`,
    [recipientHash, templateSlug, subject],
  );
  const logId = logIns.rows[0]?.id;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipient,
        subject,
        text: body,
        html: wrapHtmlEmail(renderMarkdownLite(body)),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (logId) {
        await db.query(
          `update email_log set status = 'failed', error = $1 where id = $2`,
          [errText.slice(0, 1000), logId],
        );
      }
      console.error(`resend send failed (${resp.status}): ${errText.slice(0, 300)}`);
      return { ok: false, reason: "send_failed" };
    }

    const result = await resp.json();
    if (logId && result.id) {
      await db.query(
        `update email_log set resend_id = $1 where id = $2`,
        [result.id, logId],
      );
    }
    return { ok: true };
  } catch (err) {
    if (logId) {
      await db.query(
        `update email_log set status = 'failed', error = $1 where id = $2`,
        [String(err).slice(0, 1000), logId],
      );
    }
    console.error("resend send threw", err);
    return { ok: false, reason: "send_failed" };
  }
}

function substitute(template, vars) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export function exitOk(msg) {
  console.log(`::notice::${msg}`);
  process.exit(0);
}

export function exitFail(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}
