// POST /api/cloudinary/sign-poster
// Signed-upload params for a production poster image, used by the
// public /calendar/submit form. Public endpoint - the submit form is
// public by design - but inherits the same per-IP submit rate-limit
// the rest of the form uses on actual submission, so a bad actor can't
// spam Cloudinary uploads via this without also tripping the form
// rate-limit upstream.

import { json } from "@sveltejs/kit";
import { signPosterUpload } from "$lib/server/cloudinary";

export async function POST() {
  return json(signPosterUpload());
}
