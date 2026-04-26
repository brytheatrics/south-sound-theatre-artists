// POST /api/cloudinary/sign
// Returns the signed params a browser needs to upload a headshot directly to
// Cloudinary. Public endpoint - submission flow is zero-auth by design.

import { json } from "@sveltejs/kit";
import { signHeadshotUpload } from "$lib/server/cloudinary";

export async function POST() {
  return json(signHeadshotUpload());
}
