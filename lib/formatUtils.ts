/**
 * lib/formatUtils.ts
 * Format detection utilities shared between lib/ and cli/.
 *
 * Keeping this in lib/ (not cli/) ensures the programmatic API (lib/api.ts)
 * never imports from the CLI layer, preserving clean dependency direction:
 *   cli/ → lib/ → types/
 */

import path from "path";
import type { ImageFormat } from "@/types/index";

/** Maps lowercase file extensions to their ImageFormat. */
export const EXT_TO_FORMAT: Record<string, ImageFormat> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".webp": "webp",
  ".avif": "avif",
  ".gif": "gif",
  ".tiff": "tiff",
  ".tif": "tiff",
  ".heic": "heic",
  ".heif": "heic",
  ".svg": "svg",
  ".bmp": "bmp",
};

/**
 * Detect the ImageFormat from a file path's extension.
 * Returns null for unknown or missing extensions.
 */
export function detectFormatFromExt(filePath: string): ImageFormat | null {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_TO_FORMAT[ext] ?? null;
}
