// POST /api/cloudinary/sign-logo
// Signed upload for theatre / org logos used on /theatres + admin
// event-sources cards. Auth-gated to the admin session so we don't hand
// out signed logo uploads publicly.

import { error, json } from "@sveltejs/kit";
import { signLogoUpload } from "$lib/server/cloudinary";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  return json(signLogoUpload());
};
