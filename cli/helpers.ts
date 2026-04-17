/**
 * cli/helpers.ts
 * Pure helper functions for the CLI tool.
 * No Commander, Sharp, or glob imports — all functions receive plain values.
 */

import path from "path";
import { ImageFormat, FORMAT_EXTENSIONS, ConvertOptions } from "@/types/index";

// Re-export from the shared lib layer so cli/ never defines its own copy.
// lib/api.ts and cli/ both import from lib/formatUtils to keep the dependency
// direction strictly: cli/ → lib/ → types/
export { detectFormatFromExt, EXT_TO_FORMAT } from "@/lib/formatUtils";

/**
 * Build the output file path for a converted image.
 *
 * @param inputPath  - Absolute or relative path to the source file
 * @param format     - Target ImageFormat
 * @param outputDir  - Optional directory for the output file (defaults to input directory)
 */
export function buildOutputPath(
  inputPath: string,
  format: ImageFormat,
  outputDir?: string
): string {
  const dir = outputDir ?? path.dirname(inputPath);
  const ext = path.extname(inputPath);
  // Sanitize basename to prevent path traversal (e.g. "../../etc/passwd")
  const rawBasename = ext ? path.basename(inputPath, ext) : path.basename(inputPath);
  const basename = rawBasename.replace(/[^a-zA-Z0-9._-]/g, "_") || "output";
  const newExt = FORMAT_EXTENSIONS[format];
  return path.join(dir, `${basename}.${newExt}`);
}

/**
 * Commander parsed opts shape accepted by buildConvertOptions.
 */
interface CommanderOpts {
  format: string;       // required — always present
  quality: number;      // parsed by Commander parseArg; default 85
  width?: number;       // undefined if not provided
  height?: number;      // undefined if not provided
  metadata: boolean;    // Commander negation: true by default, false when --no-metadata passed
  output?: string;      // output directory
  concurrency: number;  // default 4
  quiet: boolean;       // default false
  // New processing options
  grayscale?: boolean;
  rotate?: number;
  autoRotate?: boolean;
  flip?: boolean;
  flop?: boolean;
  background?: string;
  blur?: number;
  sharpen?: boolean;
  normalize?: boolean;
  trim?: boolean;
}

/**
 * Map Commander parsed options to a ConvertOptions object.
 *
 * Critical inversion: Commander's --no-metadata sets opts.metadata = false,
 * which maps to removeMetadata: true.
 */
export function buildConvertOptions(opts: CommanderOpts): ConvertOptions {
  return {
    targetFormat: opts.format as ImageFormat,
    quality: opts.quality,
    resizeWidth: opts.width ?? null,
    resizeHeight: opts.height ?? null,
    maintainAspectRatio: true,
    removeMetadata: !opts.metadata,
    // New options
    grayscale: opts.grayscale,
    rotate: opts.rotate,
    autoRotate: opts.autoRotate,
    flip: opts.flip,
    flop: opts.flop,
    background: opts.background,
    blur: opts.blur,
    sharpen: opts.sharpen,
    normalize: opts.normalize,
    trim: opts.trim,
  };
}

/**
 * Format a byte count as a rounded KB string, e.g. "423 KB".
 */
export function formatKB(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Determine whether the CLI should operate in pipe mode
 * (reading from stdin rather than file arguments).
 *
 * @param isTTY  - Whether stdin is a TTY (process.stdin.isTTY)
 * @param files  - Positional file arguments provided by the user
 */
export function isPipeMode(isTTY: boolean | undefined, files: string[]): boolean {
  return !isTTY && files.length === 0;
}
