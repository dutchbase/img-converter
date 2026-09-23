/**
 * cli/helpers.ts
 * Pure helper functions for the CLI tool.
 * No Commander, Sharp, or glob imports — all functions receive plain values.
 */

import fs from "fs";
import path from "path";
import { ImageFormat, ConvertOptions, CropOptions } from "@/types/index";

// Re-export from the shared lib layer so cli/ never defines its own copy.
// lib/api.ts and cli/ both import from lib/formatUtils to keep the dependency
// direction strictly: cli/ → lib/ → types/
export { detectFormatFromExt, EXT_TO_FORMAT, buildOutputPath } from "@/lib/formatUtils";

/**
 * Package root (holds package.json and SKILL.md). Found by walking up, because this file
 * runs from cli/ in tests and from dist/cli/cli/ when installed.
 */
export function packageRoot(): string {
  let dir = __dirname;
  while (!fs.existsSync(path.join(dir, "package.json")) && path.dirname(dir) !== dir) dir = path.dirname(dir);
  return dir;
}

/** Stable, machine-readable error codes emitted in --json output. */
export type ErrorCode =
  | "INVALID_ARGS" | "NO_INPUT" | "NOT_FOUND" | "UNSUPPORTED_INPUT" | "IMAGE_TOO_LARGE"
  | "LIVE_PHOTO_NOT_SUPPORTED" | "OUTPUT_IS_INPUT" | "DUPLICATE_OUTPUT" | "MAX_SIZE_UNREACHABLE"
  | "BLOCKED_URL" | "FETCH_FAILED" | "CONVERSION_FAILED";

export class CliError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}

/** Parse "150KB", "1.5MB" or a plain byte count (KB = 1024 bytes). */
export function parseSize(v: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb)?$/i.exec(v.trim());
  if (!m) throw new CliError("INVALID_ARGS", `Invalid size "${v}" — use e.g. 150KB, 1.5MB or a byte count`);
  const mult = { b: 1, kb: 1024, mb: 1024 * 1024 }[(m[2] ?? "b").toLowerCase() as "b" | "kb" | "mb"];
  return Math.floor(parseFloat(m[1]) * mult);
}

/** Parse "left,top,width,height" in pixels. */
export function parseCrop(v: string): CropOptions {
  const n = v.split(",").map((s) => Number(s.trim()));
  if (n.length !== 4 || n.some((x) => !Number.isInteger(x) || x < 0) || n[2] < 1 || n[3] < 1) {
    throw new CliError("INVALID_ARGS", `Invalid crop "${v}" — use left,top,width,height in pixels (e.g. 0,0,800,600)`);
  }
  return { left: n[0], top: n[1], width: n[2], height: n[3] };
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
  fit?: "inside" | "cover" | "contain" | "fill";
  allowUpscaling?: boolean;
  crop?: CropOptions;
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
    fit: opts.fit,
    allowUpscaling: opts.allowUpscaling,
    crop: opts.crop,
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
