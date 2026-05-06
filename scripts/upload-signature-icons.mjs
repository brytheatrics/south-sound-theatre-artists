// scripts/upload-signature-icons.mjs
//
// One-shot operational script. Fetches the Instagram + Facebook icons
// from simpleicons.org in moss color, uploads them to Cloudinary as
// PNGs (email-client compatible, sized for signature use), and prints
// the resulting URLs plus the moss-tinted main-logo URL.
//
// Run once to mint the assets, then paste the markdown that gets
// printed at the end into /admin/content -> Email signature.
//
// Idempotent: re-runs overwrite the same `signature/` public_ids.

import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const CLOUD_NAME = process.env.PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error("Missing CLOUDINARY env vars in .env");
  process.exit(1);
}

const MOSS = "3b6f4a"; // --accent
const INK_SOFT = "38352f"; // wordmark grey, matches the header logo
// Source SVGs from jsdelivr (Cloudinary can fetch from there). They
// arrive uncolored - we colorize on Cloudinary delivery via transforms.
const ICONS = [
  {
    name: "instagram",
    src: "https://cdn.jsdelivr.net/npm/simple-icons@11/icons/instagram.svg",
    public_id: "signature/instagram",
  },
  {
    name: "facebook",
    src: "https://cdn.jsdelivr.net/npm/simple-icons@11/icons/facebook.svg",
    public_id: "signature/facebook",
  },
];

function signParams(params, secret) {
  const stringToSign =
    Object.keys(params)
      .filter((k) => k !== "file" && k !== "api_key" && k !== "resource_type" && k !== "signature")
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&") + secret;
  return createHash("sha1").update(stringToSign).digest("hex");
}

async function uploadSvg({ svg, public_id, deliveryTransform }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id, timestamp, overwrite: "true" };
  const signature = signParams(params, API_SECRET);

  const form = new FormData();
  form.set(
    "file",
    new Blob([svg], { type: "image/svg+xml" }),
    `${public_id.split("/").pop()}.svg`,
  );
  for (const [k, v] of Object.entries(params)) {
    form.set(k, String(v));
  }
  form.set("api_key", API_KEY);
  form.set("signature", signature);

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const resp = await fetch(url, { method: "POST", body: form });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`upload failed (${resp.status}): ${errText}`);
  }
  const json = await resp.json();
  // Inject delivery-time transforms (size, f_png) so email clients
  // get a raster PNG even though the source asset is SVG.
  return json.secure_url.replace(
    /\/upload\//,
    `/upload/${deliveryTransform}/`,
  );
}

async function uploadIconFromUrl({ src, public_id }) {
  const svgRes = await fetch(src);
  if (!svgRes.ok) throw new Error(`fetch ${src} failed: ${svgRes.status}`);
  let svg = await svgRes.text();
  // simple-icons SVGs have no fill attribute (default black). Inject
  // fill="#3b6f4a" on the <path> so the rendered PNG is moss.
  svg = svg.replace(/<path /, `<path fill="#${MOSS}" `);
  return uploadSvg({ svg, public_id, deliveryTransform: "w_56,c_fit,f_png" });
}

async function uploadTwoToneLogo() {
  // Read the source SVG from /static, then patch in two-tone fills
  // matching the header LogoMark: masks (the two top-level <path>
  // elements) get moss; wordmark (the wrapping <g>) gets --ink-soft.
  let svg = await readFile("static/logo-long.svg", "utf-8");

  // Wrap the first two top-level <path> entries in a <g fill> for
  // moss, and the wordmark <g> already exists - we just inject a
  // fill attribute on it. Strategy: regex-replace the first two
  // <path d="M...> elements to add fill="#moss", then add fill on
  // the bare <g> wrapping the wordmark.
  let count = 0;
  svg = svg.replace(/<path d=/g, (match) => {
    count++;
    return count <= 2 ? `<path fill="#${MOSS}" d=` : `<path fill="#${INK_SOFT}" d=`;
  });

  return uploadSvg({
    svg,
    public_id: "signature/logo-two-tone",
    // 250px wide @ ~22px tall (preserves the ~11.2:1 aspect ratio,
    // matches what was in the previous signature). f_png so Outlook +
    // legacy clients get a raster instead of SVG.
    deliveryTransform: "w_250,c_fit,f_png",
  });
}

async function main() {
  const results = {};

  for (const icon of ICONS) {
    process.stdout.write(`uploading ${icon.name}... `);
    results[icon.name] = await uploadIconFromUrl(icon);
    console.log("ok");
  }

  process.stdout.write("uploading two-tone logo... ");
  results.logo = await uploadTwoToneLogo();
  console.log("ok");

  console.log("\n--- uploaded URLs ---");
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v}`);
  }

  console.log("\n--- ready-to-paste signature markdown ---");
  console.log(`
![SSTA](${results.logo})

**Lexi Barnett**
South Sound Theatre Artists

[southsoundtheatreartists.org](https://southsoundtheatreartists.org)

[![Instagram](${results.instagram})](https://instagram.com/southsoundtheatreartists) &nbsp; [![Facebook](${results.facebook})](https://www.facebook.com/profile.php?id=61568260910909)
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
