// Cloudinary signed-upload helper.
//
// Browser uploads go directly to Cloudinary, but each upload must include a
// signature generated server-side with the API secret. The signature pins the
// upload to a specific folder + transformation so a leaked sign endpoint
// can't be used to dump arbitrary files into our cloud.

import { createHash } from "node:crypto";
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} from "$env/static/private";
import { PUBLIC_CLOUDINARY_CLOUD_NAME } from "$env/static/public";

export type SignedUpload = {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
  transformation: string;
};

/**
 * Returns the params a browser needs to POST a headshot directly to
 * Cloudinary. The eager-style `transformation` rewrites the original to a
 * 1200px max-edge JPEG/WebP at auto-quality, so we never store the raw
 * 20MB camera dump.
 */
export function signHeadshotUpload(): SignedUpload {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    folder: "headshots",
    timestamp: String(timestamp),
    transformation: "c_limit,w_1200,h_1200,q_auto,f_auto",
  };
  return {
    cloud_name: PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    timestamp,
    signature: signParams(params, CLOUDINARY_API_SECRET),
    folder: params.folder,
    transformation: params.transformation,
  };
}

// Cloudinary signature: SHA-1 of `key1=val1&key2=val2&...&<api_secret>`
// where keys are alphabetically sorted. `file`, `cloud_name`, `api_key`,
// `resource_type`, and `signature` are excluded from the signed string.
function signParams(
  params: Record<string, string>,
  secret: string,
): string {
  const stringToSign =
    Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&") + secret;
  return createHash("sha1").update(stringToSign).digest("hex");
}
