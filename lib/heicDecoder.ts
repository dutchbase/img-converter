import convert from "heic-convert";

export const LIVE_PHOTO_ERROR_CODE = "LIVE_PHOTO_NOT_SUPPORTED";

/**
 * Decodes a HEIC/HEIF buffer to a JPEG Buffer suitable for the Sharp pipeline.
 *
 * Uses convert.all() to detect multi-frame HEIC (Live Photos). If more than
 * one frame is present, throws with name === LIVE_PHOTO_ERROR_CODE.
 *
 * Uses quality: 1 (maximum) for the intermediate JPEG so that Sharp applies
 * the final quality during re-encoding — avoids double lossy compression.
 *
 * Note: heic-convert does a lot of work synchronously. The server-side
 * semaphore (limit 3 via lib/processingQueue.ts) is sufficient protection
 * for this project's self-hosted, low-concurrency use case.
 */
export async function decodeHeicToBuffer(inputBuffer: Buffer): Promise<Buffer> {
  // Use .slice() to ensure we get a correctly-sized ArrayBuffer view.
  // inputBuffer.buffer may reference a larger shared ArrayBuffer when the Buffer
  // was allocated from a pool, causing heic-convert to read garbage beyond the
  // actual HEIC data.
  const safeArrayBuffer = inputBuffer.buffer.slice(
    inputBuffer.byteOffset,
    inputBuffer.byteOffset + inputBuffer.byteLength
  );

  const images = await convert.all({
    buffer: safeArrayBuffer,
    format: "JPEG",
    quality: 1,
  });

  if (images.length > 1) {
    const err = new Error(LIVE_PHOTO_ERROR_CODE);
    err.name = LIVE_PHOTO_ERROR_CODE;
    throw err;
  }

  const outputArrayBuffer = await images[0].convert();
  return Buffer.from(outputArrayBuffer);
}
