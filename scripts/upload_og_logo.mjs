// One-off upload of the SSTA wordmark to Cloudinary at a fixed
// public_id ('brand/og-logo'). Used as an image overlay on per-artist
// OG cards. Re-runnable: overwrite=true keeps the URL stable.
//
// Run: node scripts/upload_og_logo.mjs
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const CLOUD = process.env.PUBLIC_CLOUDINARY_CLOUD_NAME;
const KEY = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;
if (!CLOUD || !KEY || !SECRET) {
  console.error("Missing Cloudinary env (PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)");
  process.exit(1);
}

const svg = readFileSync("static/logo-long.svg", "utf8");
// Cloudinary accepts a base64 data-URL as `file` for direct uploads.
const file = "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");

const timestamp = Math.floor(Date.now() / 1000);
const params = {
  public_id: "brand/og-logo",
  overwrite: "true",
  invalidate: "true",
  timestamp: String(timestamp),
};
const stringToSign =
  Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&") + SECRET;
const signature = createHash("sha1").update(stringToSign).digest("hex");

const fd = new FormData();
fd.append("file", file);
fd.append("api_key", KEY);
fd.append("timestamp", String(timestamp));
fd.append("signature", signature);
fd.append("public_id", params.public_id);
fd.append("overwrite", "true");
fd.append("invalidate", "true");

const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
  method: "POST",
  body: fd,
});
const data = await res.json();
if (!res.ok) {
  console.error("Upload failed:", data);
  process.exit(1);
}
console.log("Uploaded:", data.secure_url);
console.log("public_id:", data.public_id);
console.log("Use as Cloudinary layer: l_brand:og-logo");
