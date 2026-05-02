// Client-side HEIC/HEIF -> JPEG conversion. Browsers can't decode HEIC
// in <canvas>, so iPhone photos saved in HEIC format would slip past
// downsizeImage and either upload at full size (often >10MB, hitting
// Cloudinary's ingest cap) or fail outright on rare browsers that
// can't decode them at all.
//
// `heic2any` is a small (~150KB minified) library that decodes HEIC
// in the browser via a wasm-backed HEVC decoder. We lazy-import it so
// only users who actually pick a HEIC file pay the load cost.

/**
 * If the file is HEIC/HEIF, decode + re-encode as JPEG at the given
 * quality and return a new File. Otherwise return the original file
 * unchanged. Errors during conversion (corrupt file, unsupported HEIC
 * variant) bubble up so the caller can decide whether to fall through
 * to the original or surface a specific error.
 */
export async function convertHeicIfNeeded(
  file: File,
  quality = 0.85,
): Promise<File> {
  const lower = file.name.toLowerCase();
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    lower.endsWith(".heic") ||
    lower.endsWith(".heif");
  if (!isHeic) return file;

  // Lazy-load so non-HEIC users never download the library.
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality,
  });
  // heic2any returns a Blob for single-frame HEIC, Blob[] for multi-frame
  // (rare - mostly burst / live photos). Take the first frame.
  const jpeg = Array.isArray(result) ? result[0] : result;
  const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
  return new File([jpeg], newName, { type: "image/jpeg" });
}
