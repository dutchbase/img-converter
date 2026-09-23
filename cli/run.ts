/**
 * cli/run.ts
 * The CLI's per-file work, kept free of Commander and process.exit so it is testable.
 * Every function returns results in input order using the v2 JSON contract (see SKILL.md).
 */

import path from "path";
import fs from "fs/promises";
import { glob } from "glob";
import pLimit from "p-limit";
import { processImage, processToMaxBytes, getImageMetadata } from "@/lib/imageProcessor";
import { decodeHeicToBuffer } from "@/lib/heicDecoder";
import { safeFetch } from "@/lib/safeFetch";
import { buildOutputPath, detectFormatFromExt } from "@/lib/formatUtils";
import { CliError, parseCrop, parseSize, type ErrorCode } from "@/cli/helpers";
import { OUTPUT_FORMATS, QUALITY_FORMATS, type ConvertOptions, type CropOptions, type ImageFormat, type ManifestItem } from "@/types/index";

export { CliError, type ErrorCode };

type Failure = { index: number; ok: false; input: string; error: { code: ErrorCode; message: string } };

export type CliResult =
  | {
      index: number; ok: true; input: string; output: string; format: ImageFormat;
      inputBytes: number; outputBytes: number; reduction: number; width: number; height: number; quality: number;
    }
  | { index: number; ok: true; dryRun: true; input: string; output: string; format: ImageFormat; inputBytes: number }
  | Failure;

export type InfoResult =
  | {
      index: number; ok: true; input: string; format: string; width: number; height: number; filesize: number;
      hasAlpha: boolean; hasExif: boolean; colorSpace: string; isAnimated: boolean; pages: number;
      channels?: number; density?: number;
    }
  | Failure;

export interface Job {
  input: string;
  options: ConvertOptions;
  output?: string;
  outputDir?: string;
  maxBytes?: number;
}

const isUrl = (s: string) => /^https?:\/\//.test(s);

/** Map any thrown error to a stable ErrorCode. */
export function errorCode(err: unknown): ErrorCode {
  if (err instanceof CliError) return err.code;
  const e = err as { code?: string; name?: string; message?: string };
  if (e.code === "MAX_SIZE_UNREACHABLE" || e.code === "OUTPUT_IS_INPUT") return e.code;
  if (e.code === "ENOENT" || e.code === "EISDIR") return "NOT_FOUND";
  if (e.name === "LIVE_PHOTO_NOT_SUPPORTED") return "LIVE_PHOTO_NOT_SUPPORTED";
  const m = e.message ?? "";
  if (m === "IMAGE_TOO_LARGE" || /pixel limit/i.test(m)) return "IMAGE_TOO_LARGE";
  if (/private\/internal addresses|Unsupported protocol/.test(m)) return "BLOCKED_URL";
  if (/^(Failed to fetch|Request timed out|Too many redirects|Response from|Invalid URL|No response body)/.test(m) || m === "fetch failed") {
    return "FETCH_FAILED";
  }
  if (/unsupported image format|corrupt header|HEIC decode failed/i.test(m)) return "UNSUPPORTED_INPUT";
  return "CONVERSION_FAILED";
}

function failure(index: number, input: string, err: unknown): Failure {
  return { index, ok: false, input, error: { code: errorCode(err), message: (err as Error).message } };
}

async function readInput(input: string): Promise<Buffer> {
  return isUrl(input) ? safeFetch(input) : fs.readFile(input);
}

/**
 * Expand CLI arguments: URLs pass through, existing files are used literally
 * (so names like "photo [1].png" work), everything else is globbed.
 */
export async function resolveInputs(patterns: string[]): Promise<{ files: string[]; unmatched: string[] }> {
  const files: string[] = [];
  const unmatched: string[] = [];
  for (const p of patterns) {
    if (isUrl(p)) {
      files.push(p);
      continue;
    }
    try {
      if ((await fs.stat(p)).isFile()) {
        files.push(path.resolve(p));
        continue;
      }
    } catch {
      // not an existing file — try it as a glob
    }
    if (!/[*?[\]{}]/.test(p)) {
      files.push(path.resolve(p)); // plain path that doesn't exist: report NOT_FOUND per item
      continue;
    }
    const matches = await glob(p, { absolute: true, nodir: true });
    if (matches.length === 0) unmatched.push(p);
    files.push(...matches.sort());
  }
  if (files.length === 0) {
    throw new CliError("NO_INPUT", `No files matched: ${unmatched.join(", ")}`);
  }
  return { files, unmatched };
}

/** Convert every job; results come back in job order. Never throws for per-item failures. */
export async function runConvert(
  jobs: Job[],
  opts: { concurrency: number; dryRun?: boolean; onResult?: (r: CliResult) => void }
): Promise<CliResult[]> {
  const results: CliResult[] = new Array(jobs.length);
  const outputs: (string | null)[] = [];
  const claimed = new Map<string, number>(); // lower-cased output path → first job index

  // Plan every output up front so two inputs can never silently write the same file
  jobs.forEach((job, index) => {
    const input = isUrl(job.input) ? job.input : path.resolve(job.input);
    try {
      const output = job.output
        ? path.resolve(job.output)
        : path.resolve(buildOutputPath(input, job.options.targetFormat, job.outputDir));
      const first = claimed.get(output.toLowerCase());
      if (first !== undefined) {
        throw new CliError(
          "DUPLICATE_OUTPUT",
          `Output ${output} is also produced by input #${first}; use distinct output paths or --output dirs`
        );
      }
      claimed.set(output.toLowerCase(), index);
      outputs.push(output);
    } catch (err) {
      results[index] = failure(index, input, err);
      outputs.push(null);
    }
  });

  const limit = pLimit(opts.concurrency);
  await Promise.all(
    jobs.map((job, index) =>
      limit(async () => {
        const output = outputs[index];
        if (output === null) {
          opts.onResult?.(results[index]);
          return;
        }
        const input = isUrl(job.input) ? job.input : path.resolve(job.input);
        const format = job.options.targetFormat;
        try {
          const inputBuffer = await readInput(input);
          if (opts.dryRun) {
            results[index] = { index, ok: true, dryRun: true, input, output, format, inputBytes: inputBuffer.length };
          } else {
            const sourceFormat = isUrl(input) ? undefined : detectFormatFromExt(input) ?? undefined;
            const { buffer, quality } = job.maxBytes
              ? await processToMaxBytes(inputBuffer, job.options, job.maxBytes, sourceFormat)
              : { buffer: await processImage(inputBuffer, job.options, sourceFormat), quality: job.options.quality };
            await fs.mkdir(path.dirname(output), { recursive: true });
            await fs.writeFile(output, buffer);
            const meta = await getImageMetadata(buffer);
            results[index] = {
              index, ok: true, input, output, format,
              inputBytes: inputBuffer.length,
              outputBytes: buffer.length,
              reduction: inputBuffer.length > 0 ? +((1 - buffer.length / inputBuffer.length) * 100).toFixed(1) : 0,
              width: meta.width ?? 0,
              height: meta.height ?? 0,
              quality,
            };
          }
        } catch (err) {
          results[index] = failure(index, input, err);
        }
        opts.onResult?.(results[index]);
      })
    )
  );
  return results;
}

/** Inspect images; results come back in input order. */
export async function runInfo(inputs: string[]): Promise<InfoResult[]> {
  const results: InfoResult[] = [];
  // ponytail: sequential; use p-limit if info on hundreds of files is slow
  for (const [index, raw] of inputs.entries()) {
    const input = isUrl(raw) ? raw : path.resolve(raw);
    try {
      const buffer = await readInput(input);
      const isHeic = detectFormatFromExt(isUrl(input) ? new URL(input).pathname : input) === "heic";
      const meta = await getImageMetadata(isHeic ? await decodeHeicToBuffer(buffer) : buffer);
      const pages = meta.pages ?? 1;
      results.push({
        index, ok: true, input,
        format: isHeic ? "heic" : meta.format ?? "unknown",
        width: meta.width ?? 0,
        height: meta.height ?? 0,
        filesize: buffer.length,
        hasAlpha: (meta.channels ?? 0) === 4 || meta.hasAlpha === true,
        hasExif: meta.exif !== undefined && meta.exif.length > 0,
        colorSpace: meta.space ?? "unknown",
        isAnimated: pages > 1,
        pages,
        channels: meta.channels,
        density: meta.density,
      });
    } catch (err) {
      results.push(failure(index, input, err));
    }
  }
  return results;
}

const MANIFEST_KEYS: (keyof ManifestItem)[] = [
  "input", "format", "output", "outputDir", "quality", "width", "height", "fit", "allowUpscaling", "crop",
  "removeMetadata", "rotate", "flip", "flop", "background", "grayscale", "blur", "sharpen", "normalize", "trim", "maxSize",
];
const FITS = ["inside", "cover", "contain", "fill"];

/** Validate a parsed batch manifest and turn it into jobs. Throws CliError("INVALID_ARGS") naming the bad item. */
export function manifestToJobs(raw: unknown): Job[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new CliError("INVALID_ARGS", "Manifest must be a non-empty JSON array of items");
  }
  return raw.map((item: ManifestItem, i) => {
    const bad = (msg: string) => new CliError("INVALID_ARGS", `Manifest item [${i}]: ${msg}`);
    if (typeof item !== "object" || item === null) throw bad("must be an object");
    for (const k of Object.keys(item)) {
      if (!MANIFEST_KEYS.includes(k as keyof ManifestItem)) {
        throw bad(`unknown key "${k}". Valid keys: ${MANIFEST_KEYS.join(", ")}`);
      }
    }
    if (typeof item.input !== "string" || !item.input) throw bad(`"input" must be a file path or URL`);
    if (!OUTPUT_FORMATS.includes(item.format)) throw bad(`"format" must be one of ${OUTPUT_FORMATS.join(", ")}`);
    if (item.fit !== undefined && !FITS.includes(item.fit)) throw bad(`"fit" must be one of ${FITS.join(", ")}`);
    if (item.quality !== undefined && !(Number.isInteger(item.quality) && item.quality >= 1 && item.quality <= 100)) {
      throw bad(`"quality" must be an integer 1-100`);
    }
    for (const k of ["width", "height"] as const) {
      if (item[k] !== undefined && !(Number.isInteger(item[k]) && (item[k] as number) > 0)) throw bad(`"${k}" must be a positive integer`);
    }
    let maxBytes: number | undefined;
    if (item.maxSize !== undefined) {
      if (!QUALITY_FORMATS.includes(item.format)) throw bad(`"maxSize" requires format ${QUALITY_FORMATS.join(", ")}`);
      maxBytes = typeof item.maxSize === "string" ? parseSize(item.maxSize) : item.maxSize;
    }
    let crop: CropOptions | undefined;
    try {
      crop = typeof item.crop === "string" ? parseCrop(item.crop) : item.crop;
    } catch (err) {
      throw bad((err as Error).message);
    }
    return {
      input: item.input,
      output: item.output,
      outputDir: item.outputDir,
      maxBytes,
      options: {
        targetFormat: item.format,
        quality: item.quality ?? 85,
        resizeWidth: item.width ?? null,
        resizeHeight: item.height ?? null,
        maintainAspectRatio: true,
        removeMetadata: item.removeMetadata ?? false,
        fit: item.fit,
        allowUpscaling: item.allowUpscaling,
        crop,
        rotate: item.rotate,
        flip: item.flip,
        flop: item.flop,
        background: item.background,
        grayscale: item.grayscale,
        blur: item.blur,
        sharpen: item.sharpen,
        normalize: item.normalize,
        trim: item.trim,
      },
    };
  });
}
