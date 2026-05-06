// scripts/upload-signature-elements.mjs
//
// One-shot operational script. Uploads Lexi's hand-designed signature
// element SVGs (text-outlined in Illustrator, hosted locally) to
// Cloudinary, then prints a ready-to-paste markdown block for the
// email-signature row.
//
// Source files live in:
//   ~/OneDrive/Desktop/Artists Directory/SSTA Logos/SSTA Logo 3/Signature/
//
// Each uploaded asset gets a delivery URL that converts SVG to PNG
// (f_png) at a sensible width for email-signature display. Re-runs
// overwrite the same public_ids.

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

const SRC_DIR =
  "C:/Users/blake/OneDrive/Desktop/Artists Directory/SSTA Logos/SSTA Logo 3/Signature";

// Each entry: source filename, target public_id (under signature/),
// delivery width in CSS pixels. The widths are tuned so the stacked
// signature reads with a clear visual hierarchy: name biggest,
// org/url smaller, logo medium, icons small.
const ELEMENTS = [
  { src: "SSTA Logo 3_Lexi.svg",                          public_id: "signature/lexi-name",  width: 250 },
  { src: "SSTA Logo 3_South Sound Theatre Artists.svg",   public_id: "signature/ssta-name",  width: 300 },
  { src: "SSTA Logo 3_Link.svg",                          public_id: "signature/ssta-url",   width: 300 },
  { src: "SSTA Logo Mid Green.svg",                       public_id: "signature/ssta-logo",  width: 280 },
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

async function uploadSvg({ svg, public_id, width }) {
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
  return json.secure_url.replace(
    /\/upload\//,
    `/upload/w_${width},c_fit,f_png/`,
  );
}

async function main() {
  const results = {};

  for (const el of ELEMENTS) {
    process.stdout.write(`uploading ${el.public_id}... `);
    const svg = await readFile(`${SRC_DIR}/${el.src}`, "utf-8");
    results[el.public_id] = await uploadSvg({
      svg,
      public_id: el.public_id,
      width: el.width,
    });
    console.log("ok");
  }

  console.log("\n--- uploaded URLs ---");
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v}`);
  }

  // Existing icon URLs from previous upload session (instagram + facebook).
  const igUrl =
    "https://res.cloudinary.com/dh362nxzx/image/upload/w_56,c_fit,f_png/v1778101593/signature/instagram.svg";
  const fbUrl =
    "https://res.cloudinary.com/dh362nxzx/image/upload/w_56,c_fit,f_png/v1778101594/signature/facebook.svg";

  console.log("\n--- ready-to-paste signature markdown ---");
  console.log(`
![Lexi Barnett](${results["signature/lexi-name"]})

![South Sound Theatre Artists](${results["signature/ssta-name"]})

[![southsoundtheatreartists.org](${results["signature/ssta-url"]})](https://southsoundtheatreartists.org)

[![Instagram](${igUrl})](https://instagram.com/southsoundtheatreartists) &nbsp; [![Facebook](${fbUrl})](https://www.facebook.com/profile.php?id=61568260910909)

![SSTA](${results["signature/ssta-logo"]})
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
