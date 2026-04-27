// Server hooks: protect /admin/* routes.
//
// Reads the admin session cookie, validates it against admin_sessions, and
// stashes the result on event.locals.admin. Anything under /admin (except
// /admin/login and /admin/verify) redirects to /admin/login when there's no
// valid session.

import { redirect, type Handle } from "@sveltejs/kit";
import { findValidSession, SESSION_COOKIE } from "$lib/server/admin-auth";

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/verify"]);

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get(SESSION_COOKIE);
  event.locals.admin = token ? await findValidSession(token) : null;

  const path = event.url.pathname;
  const isAdminRoute = path === "/admin" || path.startsWith("/admin/");
  const isPublicAdmin = PUBLIC_ADMIN_PATHS.has(path);

  if (isAdminRoute && !isPublicAdmin && !event.locals.admin) {
    throw redirect(303, "/admin/login");
  }

  return resolve(event);
};
