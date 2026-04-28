// POST /api/cloudinary/sign-resume
// Returns the signed params a browser needs to upload a resume PDF
// directly to Cloudinary as a raw resource. Public endpoint - the
// public submit form needs it without auth.

import { json } from "@sveltejs/kit";
import { signResumeUpload } from "$lib/server/cloudinary";

export async function POST() {
  return json(signResumeUpload());
}
