#!/usr/bin/env node

import { Command } from "commander";
import path from "path";
import fs from "fs/promises";
import { glob } from "glob";
import pLimit from "p-limit";
import { processImage, getImageMetadata } from "@/lib/imageProcessor";
import { decodeHeicToBuffer } from "@/lib/heicDecoder";
import { safeFetch } from "@/lib/safeFetch";
import { OUTPUT_FORMATS, FORMAT_EXTENSIONS, ManifestItem } from "@/types/index";
import {
  detectFormatFromExt,
  buildOutputPath,
  buildConvertOptions,
  formatKB,
  isPipeMode,
} from "@/cli/helpers";
import type { ImageFormat } from "@/types/index";

// ---------------------------------------------------------------------------
// readStdin — collect stdin into a single Buffer (capped at 100 MB)
// ---------------------------------------------------------------------------
const MAX_STDIN_BYTES = 100 * 1024 * 1024; // 100 MB

function readStdin(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    process.stdin.on("data", (c: Buffer) => {
      totalBytes += c.length;
      if (totalBytes > MAX_STDIN_BYTES) {
        reject(new Error(`Stdin exceeds ${MAX_STDIN_BYTES / (1024 * 1024)} MB size limit`));
        process.stdin.destroy();
        return;
      }
      chunks.push(c);
    });
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// fetchUrl — download an image from a URL with SSRF protection
// ---------------------------------------------------------------------------
async function fetchUrl(url: string): Promise<Buffer> {
  return safeFetch(url);
}

// ---------------------------------------------------------------------------
// isUrl — detect if a string is an HTTP/HTTPS URL
// ---------------------------------------------------------------------------
function isUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}

// ---------------------------------------------------------------------------
// Commander program definition
// ---------------------------------------------------------------------------
const program = new Command();

program
  .name("img-convert")
  .description("Convert images between formats using Sharp")
  .enablePositionalOptions();

// ---------------------------------------------------------------------------
// `info` subcommand
// ---------------------------------------------------------------------------
program
  .command("info <file>")
  .description("Get image metadata/info as JSON")
  .action(async (file: string) => {
    try {
      let buffer: Buffer;
      if (isUrl(file)) {
        buffer = await fetchUrl(file);
      } else {
        buffer = await fs.readFile(file);
      }

      // HEIC pre-decode if needed
      const ext = detectFormatFromExt(file);
      if (ext === "heic") {
        buffer = await decodeHeicToBuffer(buffer);
      }

      const meta = await getImageMetadata(buffer);
      const info = {
        format: meta.format ?? "unknown",
        width: meta.width ?? 0,
        height: meta.height ?? 0,
        filesize: buffer.length,
        hasAlpha: (meta.channels ?? 0) === 4 || meta.hasAlpha === true,
        hasExif: meta.exif !== undefined && meta.exif.length > 0,
        colorSpace: meta.space ?? "unknown",
        isAnimated: (meta.pages ?? 1) > 1,
        channels: meta.channels,
        density: meta.density,
      };
      process.stdout.write(JSON.stringify(info, null, 2) + "\n");
      process.exit(0);
    } catch (err) {
      process.stderr.write(`Error: ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// `batch` subcommand (manifest-based)
// ---------------------------------------------------------------------------
program
  .command("batch <manifest>")
  .description("Batch convert images from a JSON manifest file")
  .option("-c, --concurrency <n>", "Parallel conversion limit", (v: string) => parseInt(v, 10), 4)
  .option("--json", "Output results as JSON array")
  .action(async (manifestPath: string, opts: { concurrency: number; json: boolean }) => {
    let manifest: ManifestItem[];
    try {
      const content = await fs.readFile(manifestPath, "utf8");
      manifest = JSON.parse(content) as ManifestItem[];
    } catch (err) {
      process.stderr.write(`Error reading manifest: ${(err as Error).message}\n`);
      process.exit(1);
    }

    if (!Array.isArray(manifest) || manifest.length === 0) {
      process.stderr.write("Error: manifest must be a non-empty JSON array\n");
      process.exit(1);
    }

    // Validate each manifest item has required fields
    for (let i = 0; i < manifest.length; i++) {
      const item = manifest[i];
      if (!item.input || typeof item.input !== "string") {
        process.stderr.write(`Error: manifest item [${i}] missing required "input" field\n`);
        process.exit(1);
      }
      if (!item.format || typeof item.format !== "string") {
        process.stderr.write(`Error: manifest item [${i}] missing required "format" field\n`);
        process.exit(1);
      }
      const validFormats: string[] = OUTPUT_FORMATS;
      if (!validFormats.includes(item.format)) {
        process.stderr.write(`Error: manifest item [${i}] has invalid format "${item.format}". Valid: ${OUTPUT_FORMATS.join(", ")}\n`);
        process.exit(1);
      }
    }

    const limit = pLimit(opts.concurrency);
    const results: object[] = [];
    let failCount = 0;

    const tasks = manifest.map((item, idx) =>
      limit(async () => {
        try {
          let inputBuffer: Buffer;
          if (isUrl(item.input)) {
            inputBuffer = await fetchUrl(item.input);
          } else {
            inputBuffer = await fs.readFile(item.input);
          }

          const sourceFormat = detectFormatFromExt(item.input) ?? undefined;
          const convertOpts = buildConvertOptions({
            format: item.format,
            quality: item.quality ?? 85,
            width: item.width,
            height: item.height,
            metadata: !(item.removeMetadata ?? false),
            concurrency: opts.concurrency,
            quiet: false,
          });

          const outputBuffer = await processImage(inputBuffer, convertOpts, sourceFormat);
          const meta = await getImageMetadata(outputBuffer);

          // Determine output path
          let outputPath = item.output;
          if (!outputPath) {
            const ext = FORMAT_EXTENSIONS[item.format];
            const stem = path.basename(item.input, path.extname(item.input));
            const dir = path.dirname(item.input);
            outputPath = path.join(dir, `${stem}.${ext}`);
          }

          await fs.writeFile(outputPath, outputBuffer);

          const result = {
            index: idx,
            input: item.input,
            output: outputPath,
            inputBytes: inputBuffer.length,
            outputBytes: outputBuffer.length,
            reduction: inputBuffer.length > 0
              ? parseFloat(((1 - outputBuffer.length / inputBuffer.length) * 100).toFixed(1))
              : 0,
            width: meta.width ?? 0,
            height: meta.height ?? 0,
            format: item.format,
            quality: item.quality ?? 85,
          };

          if (!opts.json) {
            process.stderr.write(`\u2713 ${item.input} \u2192 ${outputPath}\n`);
          }
          results.push(result);
        } catch (err) {
          failCount++;
          if (!opts.json) {
            process.stderr.write(`\u2717 ${item.input} \u2014 ${(err as Error).message}\n`);
          } else {
            results.push({ index: idx, input: item.input, error: (err as Error).message });
          }
        }
      })
    );

    await Promise.all(tasks);

    if (opts.json) {
      process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    } else {
      process.stderr.write(`Done: ${manifest.length - failCount} converted, ${failCount} failed\n`);
    }

    process.exit(failCount > 0 ? 1 : 0);
  });

// ---------------------------------------------------------------------------
// `mcp` subcommand — MCP server
// ---------------------------------------------------------------------------
program
  .command("mcp")
  .description("Start an MCP (Model Context Protocol) server on stdio")
  .action(async () => {
    // Lazy import to avoid loading MCP SDK unless needed
    const { startMcpServer } = await import("@/cli/mcp");
    await startMcpServer();
  });

// ---------------------------------------------------------------------------
// Root convert command
// ---------------------------------------------------------------------------
program
  .argument("[files...]", "Input file paths, URLs, or glob patterns")
  .option("-f, --format <fmt>", `Target format (${OUTPUT_FORMATS.join("|")})`)
  .option(
    "-q, --quality <n>",
    "Quality 1-100",
    (v: string) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1 || n > 100) {
        console.error("Error: quality must be an integer between 1 and 100");
        process.exit(1);
      }
      return n;
    },
    85
  )
  .option("--width <n>", "Resize width in pixels", (v: string) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 1) {
      console.error("Error: width must be a positive integer");
      process.exit(1);
    }
    return n;
  })
  .option("--height <n>", "Resize height in pixels", (v: string) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 1) {
      console.error("Error: height must be a positive integer");
      process.exit(1);
    }
    return n;
  })
  .option("--no-metadata", "Strip EXIF metadata (ICC color profile preserved)")
  .option("-o, --output <dir>", "Output directory (default: same directory as input)")
  .option(
    "-c, --concurrency <n>",
    "Parallel conversion limit",
    (v: string) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1) {
        console.error("Error: concurrency must be a positive integer");
        process.exit(1);
      }
      return n;
    },
    4
  )
  .option("--quiet", "Suppress progress output (errors and summary still shown on failure)")
  .option("--json", "Output results as JSON (progress to stderr, data to stdout)")
  .option("--dry-run", "Show what would happen without writing files")
  .option("--grayscale", "Convert to grayscale")
  .option("--rotate <n>", "Rotate image by degrees", (v: string) => parseFloat(v))
  .option("--flip", "Flip image horizontally (mirror)")
  .option("--flop", "Flop image vertically")
  .option("--background <color>", "Background fill color (e.g. #ffffff, rgba(0,0,0,0))")
  .option("--blur <n>", "Gaussian blur sigma", (v: string) => parseFloat(v))
  .option("--sharpen", "Apply unsharp mask sharpening")
  .option("--normalize", "Apply automatic contrast enhancement")
  .option("--trim", "Auto-trim whitespace/solid borders")
  .action(async (files: string[], opts: {
    format?: string;
    quality: number;
    width?: number;
    height?: number;
    metadata: boolean;
    output?: string;
    concurrency: number;
    quiet: boolean;
    json: boolean;
    dryRun: boolean;
    grayscale?: boolean;
    rotate?: number;
    flip?: boolean;
    flop?: boolean;
    background?: string;
    blur?: number;
    sharpen?: boolean;
    normalize?: boolean;
    trim?: boolean;
  }) => {
    // ------------------------------------------------------------------
    // Format validation (required for root convert command)
    // ------------------------------------------------------------------
    if (!opts.format) {
      process.stderr.write("Error: required option '-f, --format <fmt>' not specified\n");
      program.help({ error: false });
      process.exit(1);
    }

    const validFormats: string[] = OUTPUT_FORMATS;
    if (!validFormats.includes(opts.format)) {
      process.stderr.write(
        `Error: unknown format '${opts.format}'. Valid formats: ${OUTPUT_FORMATS.join(", ")}\n`
      );
      process.exit(1);
    }
    const targetFormat = opts.format as ImageFormat;

    // ------------------------------------------------------------------
    // Output directory creation
    // ------------------------------------------------------------------
    if (opts.output && !opts.dryRun) {
      await fs.mkdir(opts.output, { recursive: true });
    }

    // ------------------------------------------------------------------
    // Pipe mode
    // ------------------------------------------------------------------
    if (isPipeMode(process.stdin.isTTY, files)) {
      try {
        const inputBuffer = await readStdin();
        // Detect source format via magic bytes so HEIC via stdin is handled correctly.
        // detectFormatFromExt cannot be used here (no filename), so we rely on file-type.
        const { fileTypeFromBuffer } = await import("file-type");
        const detected = await fileTypeFromBuffer(inputBuffer);
        const detectedFormat = detected ? (detected.mime === "image/heic" || detected.mime === "image/heif" ? "heic" as const : undefined) : undefined;

        const convertOptions = buildConvertOptions({
          ...opts,
          format: targetFormat,
          grayscale: opts.grayscale,
          rotate: opts.rotate,
          flip: opts.flip,
          flop: opts.flop,
          background: opts.background,
          blur: opts.blur,
          sharpen: opts.sharpen,
          normalize: opts.normalize,
          trim: opts.trim,
        });
        const outputBuffer = await processImage(inputBuffer, convertOptions, detectedFormat);
        process.stdout.write(outputBuffer);
        process.exit(0);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exit(1);
      }
    }

    // ------------------------------------------------------------------
    // Expand file paths and URLs
    // ------------------------------------------------------------------
    const resolvedFiles: string[] = [];
    for (const pattern of files) {
      if (isUrl(pattern)) {
        resolvedFiles.push(pattern);
      } else {
        const matches = await glob(pattern, { absolute: true });
        if (matches.length === 0) {
          process.stderr.write(`Warning: no files matched '${pattern}'\n`);
        }
        resolvedFiles.push(...matches);
      }
    }
    if (resolvedFiles.length === 0) {
      process.stderr.write("Error: no input files found\n");
      process.exit(1);
    }

    // ------------------------------------------------------------------
    // Batch processing with p-limit
    // ------------------------------------------------------------------
    const limit = pLimit(opts.concurrency);
    let failCount = 0;
    const convertOptions = buildConvertOptions({
      ...opts,
      format: targetFormat,
      grayscale: opts.grayscale,
      rotate: opts.rotate,
      flip: opts.flip,
      flop: opts.flop,
      background: opts.background,
      blur: opts.blur,
      sharpen: opts.sharpen,
      normalize: opts.normalize,
      trim: opts.trim,
    });

    const jsonResults: object[] = [];

    const tasks = resolvedFiles.map((filePath) =>
      limit(async () => {
        const inputName = isUrl(filePath) ? filePath : path.basename(filePath);
        try {
          let inputBuffer: Buffer;
          if (isUrl(filePath)) {
            inputBuffer = await fetchUrl(filePath);
          } else {
            inputBuffer = await fs.readFile(filePath);
          }

          const sourceFormat = isUrl(filePath) ? undefined : (detectFormatFromExt(filePath) ?? undefined);
          const outputPath = isUrl(filePath)
            ? buildOutputPath(new URL(filePath).pathname, targetFormat, opts.output)
            : buildOutputPath(filePath, targetFormat, opts.output);

          if (opts.dryRun) {
            const msg = `[dry-run] ${inputName} \u2192 ${path.basename(outputPath)} (${formatKB(inputBuffer.length)})\n`;
            if (opts.json) {
              jsonResults.push({ input: inputName, output: outputPath, inputBytes: inputBuffer.length, dryRun: true });
            } else {
              process.stderr.write(msg);
            }
            return;
          }

          const outputBuffer = await processImage(inputBuffer, convertOptions, sourceFormat);
          await fs.writeFile(outputPath, outputBuffer);

          const meta = await getImageMetadata(outputBuffer);
          const reduction = inputBuffer.length > 0
            ? parseFloat(((1 - outputBuffer.length / inputBuffer.length) * 100).toFixed(1))
            : 0;

          if (opts.json) {
            jsonResults.push({
              input: inputName,
              output: outputPath,
              inputBytes: inputBuffer.length,
              outputBytes: outputBuffer.length,
              reduction,
              width: meta.width ?? 0,
              height: meta.height ?? 0,
              format: targetFormat,
              quality: opts.quality,
            });
          } else if (!opts.quiet) {
            process.stderr.write(
              `\u2713 ${inputName} \u2192 ${path.basename(outputPath)} (${formatKB(inputBuffer.length)} \u2192 ${formatKB(outputBuffer.length)})\n`
            );
          }
        } catch (err) {
          failCount++;
          if (opts.json) {
            jsonResults.push({ input: inputName, error: (err as Error).message });
          } else {
            process.stderr.write(`\u2717 ${inputName} \u2014 ${(err as Error).message}\n`);
          }
        }
      })
    );

    await Promise.all(tasks);

    // ------------------------------------------------------------------
    // Output and exit
    // ------------------------------------------------------------------
    if (opts.json) {
      if (resolvedFiles.length === 1 && jsonResults.length === 1) {
        process.stdout.write(JSON.stringify(jsonResults[0], null, 2) + "\n");
      } else {
        process.stdout.write(JSON.stringify(jsonResults, null, 2) + "\n");
      }
    } else if (!opts.quiet || failCount > 0) {
      process.stderr.write(
        `Done: ${resolvedFiles.length - failCount} converted, ${failCount} failed\n`
      );
    }

    process.exit(failCount > 0 ? 1 : 0);
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
