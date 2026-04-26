// Resend wrapper. All outbound mail goes through here so we get one
// place to handle the blocklist check, the email_log audit row, and the
// {{variable}} substitution.
//
// Architecture commitment from BUILD_PLAN: every send logs to email_log
// (hashed recipient + type + sent_at) before calling Resend.

import { createHash } from "node:crypto";
import { RESEND_API_KEY, RESEND_FROM_EMAIL } from "$env/static/private";
import { supabaseAdmin } from "./supabase";

type SendArgs = {
  to: string;
  templateSlug: string;
  vars: Record<string, string>;
};

type SendResult = { ok: true } | { ok: false; reason: string };

export async function sendEmail({
  to,
  templateSlug,
  vars,
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
    .select("subject, body_markdown")
    .eq("slug", templateSlug)
    .maybeSingle();

  if (tmplErr || !tmpl) {
    console.error(`email template not found: ${templateSlug}`, tmplErr);
    return { ok: false, reason: "template_not_found" };
  }

  const subject = substitute(tmpl.subject, vars);
  const body = substitute(tmpl.body_markdown, vars);

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
        text: body,
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
