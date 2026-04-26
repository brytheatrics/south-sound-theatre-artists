// Browser-side image downsize before upload. Handles the "user picks a 25 MB
// phone photo" case: scale to a 2000 px max edge and re-encode as JPEG so
// the upload stays under Cloudinary's 10 MB ingest cap and finishes faster.
//
// Returns the original blob unchanged when:
//   - the format can't safely be canvas-resized (animated GIF, HEIC/HEIF
//     that browsers can't decode);
//   - the browser fails to decode the file at all (we let Cloudinary try);
//   - the image is already small enough that resizing would only hurt.

const MAX_EDGE = 2000;        // pixels on the long side
const JPEG_QUALITY = 0.85;
const SKIP_FORMATS = new Set([
  "image/gif",   // re-encoding would drop animation
  "image/heic",  // most browsers can't decode in canvas
  "image/heif",
]);

export async function downsizeImage(file: File): Promise<Blob> {
  if (SKIP_FORMATS.has(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const { width, height } = bitmap;
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_EDGE) {
    bitmap.close();
    return file;
  }

  const scale = MAX_EDGE / longEdge;
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", JPEG_QUALITY),
  );
  return blob ?? file;
}
