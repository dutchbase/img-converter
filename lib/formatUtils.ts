/**
 * lib/formatUtils.ts
 * Format detection utilities shared between lib/ and cli/.
 *
 * Keeping this in lib/ (not cli/) ensures the programmatic API (lib/api.ts)
 * never imports from the CLI layer, preserving clean dependency direction:
 *   cli/ → lib/ → types/
 */

import path from "path";
import { FORMAT_EXTENSIONS, type ImageFormat } from "@/types/index";

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

/**
 * Build the default output path for a converted image.
 * URL inputs land in outputDir or cwd. Throws rather than overwrite the input.
 */
export function buildOutputPath(inputPath: string, format: ImageFormat, outputDir?: string): string {
  const isUrl = /^https?:\/\//.test(inputPath);
  const srcPath = isUrl ? new URL(inputPath).pathname : inputPath;
  const dir = outputDir ?? (isUrl ? process.cwd() : path.dirname(inputPath));
  // Sanitize basename to prevent path traversal (e.g. "../../etc/passwd")
  const basename = path.basename(srcPath, path.extname(srcPath)).replace(/[^a-zA-Z0-9._-]/g, "_") || "output";
  const out = path.join(dir, `${basename}.${FORMAT_EXTENSIONS[format]}`);
  if (!isUrl && path.resolve(out) === path.resolve(inputPath)) {
    throw new Error(`Output would overwrite input "${inputPath}" — choose an output directory`);
  }
  return out;
}
