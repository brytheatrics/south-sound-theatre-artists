// Admin layout server load: fetches "needs attention" counts for every
// queue-style section so the sidebar can show a badge on tabs that have
// outstanding work. Skips the auth routes (login / verify) - those don't
// render the chrome anyway.

import type { LayoutServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: LayoutServerLoad = async ({ url }) => {
  const path = url.pathname;
  if (path === "/admin/login" || path === "/admin/verify") {
    return { queueCounts: null };
  }

  const [pending, flagged, reports, callboard, orgs] = await Promise.all([
    supabaseAdmin
      .from("pending_submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_review")
      .eq("email_verified", true),
    supabaseAdmin
      .from("flagged_edits")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabaseAdmin
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabaseAdmin
      .from("callboard_posts")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_review")
      .is("deleted_at", null),
    supabaseAdmin
      .from("verified_orgs")
      .select("*", { count: "exact", head: true })
      .eq("verified", false)
      .is("deleted_at", null),
  ]);

  return {
    queueCounts: {
      pending: pending.count ?? 0,
      flaggedEdits: flagged.count ?? 0,
      reports: reports.count ?? 0,
      callboard: callboard.count ?? 0,
      orgs: orgs.count ?? 0,
    },
  };
};
