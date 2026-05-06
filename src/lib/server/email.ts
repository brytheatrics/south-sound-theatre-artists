// Resend wrapper. All outbound mail goes through here so we get one
// place to handle the blocklist check, the email_log audit row, and the
// {{variable}} substitution.
//
// Architecture commitment from BUILD_PLAN: every send logs to email_log
// (hashed recipient + type + sent_at) before calling Resend.
//
// As of mig 067, every send produces both a plain-text fallback and an
// HTML version (rendered from the same markdown body via renderMarkdown
// + an email-safe shell). A {{signature}} variable is auto-injected
// from the `email_signature` site_content row so Lexi edits the
// signature in one place and every template picks it up.

import { createHash } from "node:crypto";
import { RESEND_API_KEY, RESEND_FROM_EMAIL } from "$env/static/private";
import { env as privateEnv } from "$env/dynamic/private";
import { supabaseAdmin } from "./supabase";
import { renderMarkdown } from "../util/markdown";

// In-memory cache for the email signature so we don't hit the DB on
// every send. site_content rows change rarely; a 60s TTL is plenty
// fresh for the admin's edit -> retest cycle.
let signatureCache: { value: string; loadedAt: number } | null = null;
const SIGNATURE_TTL_MS = 60_000;

async function loadSignature(): Promise<string> {
  if (signatureCache && Date.now() - signatureCache.loadedAt < SIGNATURE_TTL_MS) {
    return signatureCache.value;
  }
  const { data } = await supabaseAdmin
    .from("site_content")
    .select("body_markdown")
    .eq("slug", "email_signature")
    .maybeSingle();
  const value = data?.body_markdown ?? "";
  signatureCache = { value, loadedAt: Date.now() };
  return value;
}

type SendArgs = {
  to: string;
  templateSlug: string;
  vars: Record<string, string>;
  /** When set, hitting Reply in the recipient's mail client targets this
   * address instead of RESEND_FROM_EMAIL. Used by the contact-routing flow
   * so artists reply directly to the sender. */
  replyTo?: string;
};

type SendResult = { ok: true } | { ok: false; reason: string };

export async function sendEmail({
  to,
  templateSlug,
  vars,
  replyTo,
}: SendArgs): Promise<SendResult> {
  const recipient = to.trim().toLowerCase();

  // Blocklist: silent success so an abusive sender can't tell they're blocked.
  const { data: blocked } = await supabaseAdmin
    .from("email_blocklist")
    .select("email")
    .eq("email", recipient)
    .maybeSingle();
  if (blocked) return { ok: true };

  // Pull and render the template
  const { data: tmpl, error: tmplErr } = await supabaseAdmin
    .from("email_templates")
    .select("subject, body_markdown, audience")
    .eq("slug", templateSlug)
    .maybeSingle();

  if (tmplErr || !tmpl) {
    console.error(`email template not found: ${templateSlug}`, tmplErr);
    return { ok: false, reason: "template_not_found" };
  }

  // Pre-launch / quiet-period kill switch: when EMAIL_PAUSE_COMMUNITY=true
  // is set in env, all audience='community' templates short-circuit
  // BEFORE Resend is hit. Admin-bound templates (2FA codes, daily
  // digest, volume alert) still send so Lexi can keep logging in.
  // Pauses are logged to email_log with status='paused' so admin can
  // audit what would have gone out. Flip the env var off when the
  // site is ready for real subscriber traffic.
  if (
    privateEnv.EMAIL_PAUSE_COMMUNITY === "true" &&
    tmpl.audience === "community"
  ) {
    const recipientHash = createHash("sha256").update(recipient).digest("hex");
    await supabaseAdmin.from("email_log").insert({
      recipient_hash: recipientHash,
      email_type: templateSlug,
      subject: substitute(tmpl.subject, vars),
      status: "paused",
    });
    return { ok: true };
  }

  // Auto-inject {{signature}} so every template can reference it
  // without each one needing the variable wired in by the caller.
  // Caller-supplied `vars.signature` wins if explicitly set.
  const signature = vars.signature ?? (await loadSignature());
  const allVars = { ...vars, signature };

  const subject = substitute(tmpl.subject, allVars);
  const body = substitute(tmpl.body_markdown, allVars);
  const html = wrapHtmlEmail(renderMarkdown(body));

  // Log first so a failed send still leaves a record.
  const recipientHash = createHash("sha256").update(recipient).digest("hex");
  const { data: logRow } = await supabaseAdmin
    .from("email_log")
    .insert({
      recipient_hash: recipientHash,
      email_type: templateSlug,
      subject,
      status: "sent",
    })
    .select("id")
    .single();

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: recipient,
        subject,
        // Both `text` and `html` so HTML-stripped clients (terminal
        // mail readers, screen-reader pipelines) still get a readable
        // message. Resend forwards both parts as a multipart/alternative.
        text: body,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (logRow) {
        await supabaseAdmin
          .from("email_log")
          .update({ status: "failed", error: errText.slice(0, 1000) })
          .eq("id", logRow.id);
      }
      console.error(`resend send failed (${resp.status})`, errText);
      return { ok: false, reason: "send_failed" };
    }

    const result = (await resp.json()) as { id?: string };
    if (logRow && result.id) {
      await supabaseAdmin
        .from("email_log")
        .update({ resend_id: result.id })
        .eq("id", logRow.id);
    }
    return { ok: true };
  } catch (err) {
    if (logRow) {
      await supabaseAdmin
        .from("email_log")
        .update({ status: "failed", error: String(err).slice(0, 1000) })
        .eq("id", logRow.id);
    }
    console.error("resend send threw", err);
    return { ok: false, reason: "send_failed" };
  }
}

function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/**
 * Wraps rendered template HTML in a minimal email-safe shell: a
 * fixed-width centered table, paper-and-ink palette inlined per
 * element, and just enough scoped overrides so img / a / p / li look
 * decent in Gmail / Outlook / Apple Mail without remote CSS.
 *
 * Why a table layout instead of flexbox? Outlook (Word-rendering
 * engine) ignores most modern CSS including flexbox / grid. The
 * 600px-wide centered <table> is the boring lowest-common-denominator
 * pattern every email tooling agrees on.
 */
export function wrapHtmlEmail(bodyHtml: string): string {
  // Best-effort: nudge any <img> the renderer emitted to render at a
  // sensible inline size. Keeps a logo / inline screenshot from blowing
  // out the 600px column on Gmail, where unconstrained imgs render at
  // intrinsic resolution.
  const safeBody = bodyHtml.replace(
    /<img\s+([^>]*?)\/?>/g,
    (_, attrs) =>
      `<img ${attrs} style="display:block;max-width:100%;height:auto;border:0;margin:1rem 0" />`,
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SSTA</title>
</head>
<body style="margin:0;padding:0;background:#f6f1e6;font-family:'Inter Tight','Helvetica Neue',Arial,sans-serif;color:#2a2622;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f1e6">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fffaf0;border:1px solid #e7decd;border-radius:6px">
        <tr>
          <td style="padding:32px 36px 36px 36px;font-size:15px;color:#2a2622">
            <div class="email-body" style="font-size:15px;line-height:1.55">${safeBody}</div>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;letter-spacing:0.08em;color:#7a7268;text-transform:uppercase">
        South Sound Theatre Artists
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;
}
