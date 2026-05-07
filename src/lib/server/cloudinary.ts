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

export type SignedRawUpload = {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
  resource_type: "raw";
};

/**
 * Returns the params a browser needs to POST a headshot directly to
 * Cloudinary. The eager-style `transformation` rewrites the original to a
 * 1200px max-edge JPEG/WebP at auto-quality, so we never store the raw
 * 20MB camera dump.
 */
export function signHeadshotUpload(): SignedUpload {
  return signFolder("headshots", "c_limit,w_1200,h_1200,q_auto,f_auto");
}

/**
 * Signed upload for admin-content images (banners, inline images in
 * site_content / email_templates markdown). Wider max-edge since these
 * may be hero images, not headshots.
 */
export function signContentUpload(): SignedUpload {
  return signFolder("content", "c_limit,w_1600,h_1600,q_auto,f_auto");
}

/**
 * Signed upload for theatre / org logos shown on /theatres + /admin
 * event-sources cards. Smaller max-edge than headshots (these display
 * in 64x64 thumbnails) and f_auto so PNGs with transparency keep their
 * alpha channel instead of getting JPEG'd against a black background.
 */
export function signLogoUpload(): SignedUpload {
  return signFolder("logos", "c_limit,w_400,h_400,q_auto,f_auto");
}

/**
 * Signed upload for resume PDFs. PDFs are not images, so they go in as
 * Cloudinary's `raw` resource type (no image transformations). The
 * client posts to `/raw/upload` instead of `/image/upload`.
 */
export function signResumeUpload(): SignedRawUpload {
  const folder = "resumes";
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    folder,
    timestamp: String(timestamp),
  };
  return {
    cloud_name: PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    timestamp,
    signature: signParams(params, CLOUDINARY_API_SECRET),
    folder,
    resource_type: "raw",
  };
}

// =============================================================
// OG card URL builder (per-artist social-share preview)
// =============================================================

/** Extract the Cloudinary public_id (with folder) from one of our
 *  signed-upload URLs, e.g.
 *   https://res.cloudinary.com/foo/image/upload/v1234/headshots/xyz.jpg
 *   -> "headshots/xyz"
 *  Returns null if the URL isn't Cloudinary-hosted on our cloud (in
 *  which case we'll fall back to the generic site OG card).
 */
function publicIdFromUrl(url: string): string | null {
  if (!url) return null;
  // Match the per-cloud Cloudinary URL pattern; extract everything
  // after the version segment, sans extension.
  const re = new RegExp(
    `^https?://res\\.cloudinary\\.com/${PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/(?:v\\d+/)?(.+?)(\\.[a-z0-9]+)?$`,
    "i",
  );
  const m = url.match(re);
  if (!m) return null;
  return m[1];
}

/** URL-encode a text overlay value for Cloudinary. Cloudinary text
 *  overlays choke on commas, slashes, and a few other separators -
 *  the safest path is full URL encoding. Returns "" for empty input. */
function encodeOverlayText(s: string): string {
  if (!s) return "";
  return encodeURIComponent(s.trim().slice(0, 80))
    .replace(/%2F/g, "%252F")
    .replace(/,/g, "%2C")
    .replace(/'/g, "%27");
}

/** Build the Cloudinary delivery URL for a per-artist OG card.
 *  Renders headshot left, name + discipline + "South Sound Theatre
 *  Artists" wordmark on a darker overlay. Returns null when the
 *  headshot isn't Cloudinary-hosted (caller falls back to the
 *  generic site card). */
export function buildOgCardUrl(input: {
  headshotUrl: string | null;
  name: string;
  primaryDiscipline?: string | null;
}): string | null {
  if (!input.headshotUrl) return null;
  const publicId = publicIdFromUrl(input.headshotUrl);
  if (!publicId) return null;
  const name = encodeOverlayText(input.name);
  const discipline = encodeOverlayText(input.primaryDiscipline ?? "");
  const wordmark = encodeOverlayText("South Sound Theatre Artists");

  // Conservative single-pass transformation:
  //   1. Crop the headshot to a face-detected 1200x630 fill.
  //   2. Overlay name + discipline + wordmark using white text with a
  //      black stroke for legibility (works against any headshot
  //      without needing a background-color layer, which has plan-
  //      dependent quirks on Cloudinary).
  const parts: string[] = [
    "w_1200,h_630,c_fill,g_face,q_auto,f_auto",
    `l_text:Arial_64_bold_stroke:${name},co_white,bo_3px_solid_black,g_south_west,x_50,y_${discipline ? 120 : 50}`,
  ];
  if (discipline) {
    parts.push(
      `l_text:Arial_32_stroke:${discipline},co_white,bo_2px_solid_black,g_south_west,x_50,y_50`,
    );
  }
  parts.push(
    `l_text:Arial_22_stroke:${wordmark},co_white,bo_2px_solid_black,g_south_east,x_30,y_30`,
  );
  return `https://res.cloudinary.com/${PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${parts.join("/")}/${publicId}.jpg`;
}

function signFolder(folder: string, transformation: string): SignedUpload {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    folder,
    timestamp: String(timestamp),
    transformation,
  };
  return {
    cloud_name: PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    timestamp,
    signature: signParams(params, CLOUDINARY_API_SECRET),
    folder,
    transformation,
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
