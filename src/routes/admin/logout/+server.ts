// POST /admin/logout: revoke session, clear cookie, redirect to login.

import { redirect } from "@sveltejs/kit";
import { revokeSession, SESSION_COOKIE } from "$lib/server/admin-auth";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies }) => {
  const token = cookies.get(SESSION_COOKIE);
  if (token) await revokeSession(token);
  cookies.delete(SESSION_COOKIE, { path: "/" });
  throw redirect(303, "/admin/login");
};
