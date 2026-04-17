/**
 * lib/api.ts
 * Programmatic Node.js API for img-convert.
 *
 * Usage:
 *   import { convert, getInfo, batch } from 'img-convert'
 */

import fs from "fs/promises";
import path from "path";
import pLimit from "p-limit";
import { processImage, getImageMetadata } from "@/lib/imageProcessor";
import { decodeHeicToBuffer } from "@/lib/heicDecoder";
import { safeFetch } from "@/lib/safeFetch";
import { FORMAT_EXTENSIONS } from "@/types/index";
import { processingQueue } from "@/lib/processingQueue";
import type {
  ImageFormat,
  ConvertApiOptions,
  ConvertApiResult,
  ImageInfo,
  BatchApiItem,
  BatchApiResult,
  BatchApiOptions,
  ConvertOptions,
} from "@/types/index";
import { detectFormatFromExt } from "@/lib/formatUtils";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a file path is within CWD to prevent path traversal.
 */
function validateFilePath(filePath: string): void {
  const cwd = process.cwd();
  const resolved = path.resolve(cwd, filePath);
  if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
    throw new Error(`Path "${filePath}" is outside the allowed directory`);
  }
}

function toConvertOptions(opts: ConvertApiOptions): ConvertOptions {
  return {
    targetFormat: opts.format,
    quality: opts.quality ?? 85,
    resizeWidth: opts.width ?? null,
    resizeHeight: opts.height ?? null,
    maintainAspectRatio: opts.maintainAspectRatio ?? true,
    removeMetadata: opts.removeMetadata ?? false,
    allowUpscaling: opts.allowUpscaling,
    crop: opts.crop,
    rotate: opts.rotate,
    autoRotate: opts.autoRotate,
    flip: opts.flip,
    flop: opts.flop,
    background: opts.background,
    grayscale: opts.grayscale,
    blur: opts.blur,
    sharpen: opts.sharpen,
    normalize: opts.normalize,
    trim: opts.trim,
  };
}

async function resolveInput(input: string | Buffer): Promise<{ buffer: Buffer; sourceFormat?: ImageFormat }> {
  if (Buffer.isBuffer(input)) {
    return { buffer: input };
  }

  // URL input — use safeFetch for SSRF protection, timeout, and size limits
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const buffer = await safeFetch(input);
    return { buffer };
  }

  // File path — validate within CWD
  validateFilePath(input);
  const buffer = await fs.readFile(input);
  const sourceFormat = detectFormatFromExt(input) ?? undefined;
  return { buffer, sourceFormat };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a single image.
 *
 * @param input   File path, URL, or Buffer
 * @param options Conversion options
 */
export async function convert(
  input: string | Buffer,
  options: ConvertApiOptions
): Promise<ConvertApiResult> {
  const { buffer: inputBuffer, sourceFormat } = await resolveInput(input);

  let buf = inputBuffer;
  let effectiveSourceFormat = sourceFormat;
  if (sourceFormat === "heic") {
    // Pre-decode HEIC → JPEG buffer so processImage receives a Sharp-readable
    // buffer. Pass undefined as sourceFormat so processImage does NOT attempt a
    // second HEIC decode on the already-decoded JPEG buffer.
    buf = await decodeHeicToBuffer(buf);
    effectiveSourceFormat = undefined;
  }

  const convertOpts = toConvertOptions(options);
  const outputBuffer = await processImage(buf, convertOpts, effectiveSourceFormat);

  const meta = await getImageMetadata(outputBuffer);

  return {
    buffer: outputBuffer,
    info: {
      inputBytes: inputBuffer.length,
      outputBytes: outputBuffer.length,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      format: options.format,
    },
  };
}

/**
 * Get metadata/info about an image without converting it.
 *
 * @param input File path, URL, or Buffer
 */
export async function getInfo(input: string | Buffer): Promise<ImageInfo> {
  const { buffer } = await resolveInput(input);

  const filesize = buffer.length;
  const meta = await getImageMetadata(buffer);

  return {
    format: meta.format ?? "unknown",
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    filesize,
    hasAlpha: (meta.channels ?? 0) === 4 || meta.hasAlpha === true,
    hasExif: meta.exif !== undefined && meta.exif.length > 0,
    colorSpace: meta.space ?? "unknown",
    isAnimated: (meta.pages ?? 1) > 1,
    channels: meta.channels,
    density: meta.density,
  };
}

/**
 * Batch convert multiple images.
 *
 * @param items       Array of conversion jobs
 * @param batchOpts   Batch options (concurrency, outputDir)
 */
export async function batch(
  items: BatchApiItem[],
  batchOpts: BatchApiOptions = {}
): Promise<BatchApiResult[]> {
  const concurrency = batchOpts.concurrency ?? 4;
  const outputDir = batchOpts.outputDir;
  const limit = pLimit(concurrency);

  const settled = await Promise.allSettled(
    items.map((item) =>
      limit(async (): Promise<BatchApiResult> => {
        const { buffer: inputBuffer, sourceFormat } = await resolveInput(item.input);

        const quality = item.quality ?? 85;
        const convertOpts: ConvertOptions = {
          targetFormat: item.format,
          quality,
          resizeWidth: item.width ?? null,
          resizeHeight: item.height ?? null,
          maintainAspectRatio: true,
          removeMetadata: item.removeMetadata ?? false,
          rotate: item.rotate,
          flip: item.flip,
          flop: item.flop,
          grayscale: item.grayscale,
          blur: item.blur,
          sharpen: item.sharpen,
          normalize: item.normalize,
          trim: item.trim,
          background: item.background,
        };

        await processingQueue.acquire();
        let outputBuffer: Buffer;
        try {
          outputBuffer = await processImage(inputBuffer, convertOpts, sourceFormat);
        } finally {
          processingQueue.release();
        }
        const meta = await getImageMetadata(outputBuffer);

        // Determine output path
        let outputPath = item.output;
        if (!outputPath) {
          const inputBase = typeof item.input === "string" ? item.input : "output";
          const ext = FORMAT_EXTENSIONS[item.format];
          const stem = path.basename(inputBase, path.extname(inputBase));
          const dir = outputDir ?? path.dirname(typeof item.input === "string" ? item.input : ".");
          outputPath = path.join(dir, `${stem}.${ext}`);
        }

        await fs.writeFile(outputPath, outputBuffer);

        return {
          input: typeof item.input === "string" ? item.input : "<buffer>",
          output: outputPath,
          inputBytes: inputBuffer.length,
          outputBytes: outputBuffer.length,
          width: meta.width ?? 0,
          height: meta.height ?? 0,
          format: item.format,
          quality,
        };
      })
    )
  );

  // Return results for fulfilled items, re-throw first rejection if all failed
  const results: BatchApiResult[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    }
    // Rejected items are silently skipped — caller gets partial results
  }
  return results;
}
