"use client";

/**
 * Square a picture down to something a database row can hold.
 *
 * Avatars are stored inline on the user row rather than in object storage.
 * That is a deliberate trade: it costs no bucket, no signed URLs and no second
 * service to keep alive, and it is only viable because the image is made small
 * first. A phone photo is 3–8 MB; this returns roughly 20 KB.
 *
 * JPEG rather than PNG, because a photograph is what people upload and PNG
 * would be several times the size for no visible gain. Transparency is not
 * worth keeping: the result is drawn inside a circle either way, and a
 * transparent PNG would show the page through the face.
 */

export const AVATAR_PX = 256;

export interface ResizeResult {
  dataUrl: string;
  bytes:   number;
}

/** Crop to a centred square, scale to AVATAR_PX, encode as JPEG. */
export async function squareToDataUrl(
  file: File,
  px: number = AVATAR_PX,
  quality = 0.82,
): Promise<ResizeResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file is not an image.");
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    /* A file can claim image/* and still not decode — a truncated download, or
       a format this browser does not read. Saying so beats a broken avatar. */
    throw new Error("That image could not be read.");
  });

  // Centre crop: take the largest square that fits, from the middle. Cropping
  // beats letterboxing here because the result is masked to a circle, and
  // bars inside a circle look like a mistake.
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.round((bitmap.width  - side) / 2);
  const sy = Math.round((bitmap.height - side) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");

  ctx.imageSmoothingQuality = "high";
  // White under the image: a source PNG with transparency would otherwise
  // encode those pixels as black once JPEG drops the alpha channel.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, px, px);
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, px, px);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const bytes = Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4);
  return { dataUrl, bytes };
}
