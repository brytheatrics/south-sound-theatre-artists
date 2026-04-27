// POST /api/cloudinary/sign-content
// Signed upload for admin-content images (markdown editors). Auth-gated
// to the admin session so we don't hand out signed uploads publicly.

import { error, json } from "@sveltejs/kit";
import { signContentUpload } from "$lib/server/cloudinary";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  return json(signContentUpload());
};
