#!/usr/bin/env node

import { Command } from "commander";
import path from "path";
import fs from "fs/promises";
import { glob } from "glob";
import pLimit from "p-limit";
import { processImage } from "@/lib/imageProcessor";
import { OUTPUT_FORMATS } from "@/types/index";
import {
  detectFormatFromExt,
  buildOutputPath,
  buildConvertOptions,
  formatKB,
  isPipeMode,
} from "@/cli/helpers";
import type { ImageFormat } from "@/types/index";

// ---------------------------------------------------------------------------
// readStdin — collect stdin into a single Buffer
// ---------------------------------------------------------------------------
function readStdin(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c: Buffer) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Commander program definition
// ---------------------------------------------------------------------------
const program = new Command();

program
  .name("img-convert")
  .description("Convert images between formats using Sharp")
  .argument("[files...]", "Input file paths or glob patterns")
  .requiredOption("-f, --format <fmt>", `Target format (${OUTPUT_FORMATS.join("|")})`)
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
  .action(async (files: string[], opts: {
    format: string;
    quality: number;
    width?: number;
    height?: number;
    metadata: boolean;
    output?: string;
    concurrency: number;
    quiet: boolean;
  }) => {
    // ------------------------------------------------------------------
    // Format validation
    // ------------------------------------------------------------------
    const validFormats: string[] = OUTPUT_FORMATS;
    if (!validFormats.includes(opts.format)) {
      console.error(
        `Error: unknown format '${opts.format}'. Valid formats: ${OUTPUT_FORMATS.join(", ")}`
      );
      process.exit(1);
    }
    const targetFormat = opts.format as ImageFormat;

    // ------------------------------------------------------------------
    // Output directory creation
    // ------------------------------------------------------------------
    if (opts.output) {
      await fs.mkdir(opts.output, { recursive: true });
    }

    // ------------------------------------------------------------------
    // Pipe mode
    // ------------------------------------------------------------------
    if (isPipeMode(process.stdin.isTTY, files)) {
      try {
        const inputBuffer = await readStdin();
        const convertOptions = buildConvertOptions({ ...opts, format: targetFormat });
        const outputBuffer = await processImage(inputBuffer, convertOptions);
        process.stdout.write(outputBuffer);
        process.exit(0);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exit(1);
      }
    }

    // ------------------------------------------------------------------
    // Glob expansion
    // ------------------------------------------------------------------
    const resolvedFiles: string[] = [];
    for (const pattern of files) {
      const matches = await glob(pattern, { absolute: true });
      if (matches.length === 0) {
        process.stderr.write(`Warning: no files matched '${pattern}'\n`);
      }
      resolvedFiles.push(...matches);
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
    const convertOptions = buildConvertOptions({ ...opts, format: targetFormat });

    const tasks = resolvedFiles.map((filePath) =>
      limit(async () => {
        const inputName = path.basename(filePath);
        try {
          const inputBuffer = await fs.readFile(filePath);
          const sourceFormat = detectFormatFromExt(filePath) ?? undefined;
          const outputBuffer = await processImage(inputBuffer, convertOptions, sourceFormat);
          const outputPath = buildOutputPath(filePath, targetFormat, opts.output);
          await fs.writeFile(outputPath, outputBuffer);
          const outputName = path.basename(outputPath);
          if (!opts.quiet) {
            process.stdout.write(
              `\u2713 ${inputName} \u2192 ${outputName} (${formatKB(inputBuffer.length)} \u2192 ${formatKB(outputBuffer.length)})\n`
            );
          }
        } catch (err) {
          failCount++;
          process.stdout.write(`\u2717 ${inputName} \u2014 ${(err as Error).message}\n`);
        }
      })
    );

    await Promise.all(tasks);

    // ------------------------------------------------------------------
    // Summary and exit
    // ------------------------------------------------------------------
    if (!opts.quiet || failCount > 0) {
      process.stdout.write(
        `Done: ${resolvedFiles.length - failCount} converted, ${failCount} failed\n`
      );
    }
    process.exit(failCount > 0 ? 1 : 0);
  });

program.parseAsync(process.argv);
