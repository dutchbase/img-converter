#!/usr/bin/env node

import { Command, Option } from "commander";
import path from "path";
import fs from "fs";
import { processImage, processToMaxBytes } from "@/lib/imageProcessor";
import { OUTPUT_FORMATS, QUALITY_FORMATS } from "@/types/index";
import {
  buildConvertOptions,
  formatKB,
  isPipeMode,
  parseCrop,
  parseSize,
  packageRoot,
  CliError,
  type ErrorCode,
} from "@/cli/helpers";
import { resolveInputs, runConvert, runInfo, manifestToJobs, type CliResult, type Job } from "@/cli/run";
import type { CropOptions, ImageFormat } from "@/types/index";

const { version } = JSON.parse(fs.readFileSync(path.join(packageRoot(), "package.json"), "utf8")) as { version: string };

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
// Usage errors: exit 2, as JSON on stdout when --json is present
// ---------------------------------------------------------------------------
// info always speaks JSON, with or without --json
const jsonMode = process.argv.includes("--json") || process.argv[2] === "info";

/**
 * Write to stdout, then exit once it has flushed. process.exit() right after write()
 * truncates piped output on macOS/Windows, where pipe writes are asynchronous.
 */
function writeAndExit(data: string | Buffer, code: number): void {
  process.stdout.write(data, () => process.exit(code));
}

/** Usage error: exits immediately (small payload, so a synchronous write is safe). */
function fail(code: ErrorCode, message: string): never {
  if (jsonMode) {
    fs.writeSync(1, JSON.stringify({ error: { code, message } }) + "\n");
  } else {
    process.stderr.write(`Error: ${message}\n`);
  }
  process.exit(2);
}

/** Wrap a parser so CliErrors become usage errors (exit 2). */
const guard = <T>(parse: (v: string) => T) => (v: string): T => {
  try {
    return parse(v);
  } catch (err) {
    fail((err as CliError).code ?? "INVALID_ARGS", (err as Error).message);
  }
};

const positiveInt = (name: string) => guard((v: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new CliError("INVALID_ARGS", `${name} must be a positive integer, got "${v}"`);
  return n;
});

const quality = guard((v: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new CliError("INVALID_ARGS", `quality must be an integer 1-100, got "${v}"`);
  }
  return n;
});

const number = (name: string) => guard((v: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new CliError("INVALID_ARGS", `${name} must be a number, got "${v}"`);
  return n;
});

function validateFormat(format: string | undefined): ImageFormat {
  if (!format) fail("INVALID_ARGS", `Missing -f, --format <fmt>. Valid formats: ${OUTPUT_FORMATS.join(", ")}`);
  if (!(OUTPUT_FORMATS as string[]).includes(format)) {
    fail("INVALID_ARGS", `Unknown format "${format}". Valid formats: ${OUTPUT_FORMATS.join(", ")}`);
  }
  return format as ImageFormat;
}

async function resolveOrFail(patterns: string[]): Promise<string[]> {
  try {
    const { files, unmatched } = await resolveInputs(patterns);
    for (const p of unmatched) process.stderr.write(`Warning: no files matched '${p}'\n`);
    return files;
  } catch (err) {
    fail((err as CliError).code ?? "NO_INPUT", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Result printing shared by convert and batch
// ---------------------------------------------------------------------------
function printProgress(r: CliResult, quiet: boolean): void {
  if (jsonMode) return;
  const name = /^https?:\/\//.test(r.input) ? r.input : path.basename(r.input);
  if (!r.ok) {
    process.stderr.write(`✗ ${name} — [${r.error.code}] ${r.error.message}\n`);
  } else if (quiet) {
    return;
  } else if ("dryRun" in r) {
    process.stderr.write(`[dry-run] ${name} → ${r.output} (${formatKB(r.inputBytes)})\n`);
  } else {
    process.stderr.write(
      `✓ ${name} → ${path.basename(r.output)} (${formatKB(r.inputBytes)} → ${formatKB(r.outputBytes)})\n`
    );
  }
}

function finish(results: CliResult[], quiet: boolean): void {
  const failed = results.filter((r) => !r.ok).length;
  if (jsonMode) return writeAndExit(JSON.stringify(results, null, 2) + "\n", failed > 0 ? 1 : 0);
  if (!quiet || failed > 0) {
    process.stderr.write(`Done: ${results.length - failed} converted, ${failed} failed\n`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Commander program definition
// ---------------------------------------------------------------------------
const program = new Command();

program
  .name("img-convert")
  .description("Convert, resize, compress and inspect images (JPEG, PNG, WebP, AVIF, GIF, TIFF; HEIC/SVG input)")
  .version(version, "-v, --version")
  .enablePositionalOptions()
  // Help/version exit 0; every other Commander parse error is a usage error (exit 2)
  .exitOverride((err) => process.exit(err.exitCode === 0 ? 0 : 2));

// ---------------------------------------------------------------------------
// `info` subcommand
// ---------------------------------------------------------------------------
program
  .command("info <files...>")
  .description("Print image metadata as a JSON array (paths, quoted globs or URLs)")
  .option("--json", "Accepted for consistency; info always prints JSON")
  .action(async (patterns: string[]) => {
    const results = await runInfo(await resolveOrFail(patterns));
    return writeAndExit(JSON.stringify(results, null, 2) + "\n", results.some((r) => !r.ok) ? 1 : 0);
  });

// ---------------------------------------------------------------------------
// `batch` subcommand (manifest-based)
// ---------------------------------------------------------------------------
program
  .command("batch <manifest>")
  .description("Convert images listed in a JSON manifest file (use - to read it from stdin)")
  .option("-c, --concurrency <n>", "Parallel conversion limit", positiveInt("concurrency"), 4)
  .option("--json", "Print results as a JSON array on stdout")
  .option("--dry-run", "Show what would happen without writing files")
  .option("--quiet", "Suppress per-file progress lines")
  .action(async (manifestPath: string, opts: { concurrency: number; dryRun?: boolean; quiet?: boolean }) => {
    let jobs: Job[];
    try {
      const text = manifestPath === "-" ? (await readStdin()).toString("utf8") : fs.readFileSync(manifestPath, "utf8");
      jobs = manifestToJobs(JSON.parse(text));
    } catch (err) {
      fail("INVALID_ARGS", `Invalid manifest: ${(err as Error).message}`);
    }
    const results = await runConvert(jobs, {
      concurrency: opts.concurrency,
      dryRun: opts.dryRun,
      onResult: (r) => printProgress(r, !!opts.quiet),
    });
    finish(results, !!opts.quiet);
  });

// ---------------------------------------------------------------------------
// `skill` subcommand — print the agent guide bundled with the package
// ---------------------------------------------------------------------------
program
  .command("skill")
  .description("Print the agent skill guide (SKILL.md) to stdout")
  .action(() => {
    process.stdout.write(fs.readFileSync(path.join(packageRoot(), "SKILL.md"), "utf8"));
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
  .argument("[files...]", "Input file paths, quoted glob patterns or HTTP(S) URLs; omit to read stdin")
  .option("-f, --format <fmt>", `Target format (${OUTPUT_FORMATS.join("|")})`)
  .option("-q, --quality <n>", "Quality 1-100 (lossy formats)", quality, 85)
  .option("--width <n>", "Resize width in pixels", positiveInt("width"))
  .option("--height <n>", "Resize height in pixels", positiveInt("height"))
  .addOption(
    new Option(
      "--fit <mode>",
      "How --width + --height fit: inside (keep ratio), cover (crop to fill), contain (pad with --background), fill (stretch)"
    )
      .choices(["inside", "cover", "contain", "fill"])
      .default("inside")
  )
  .option("--allow-upscaling", "Allow enlarging images smaller than --width/--height")
  .option("--crop <l,t,w,h>", "Crop region in source pixels, applied before resizing (left,top,width,height)", guard(parseCrop))
  .option("--max-size <size>", "Pick the highest quality that fits, e.g. 200KB or 1.5MB (jpeg/webp/avif only)", guard(parseSize))
  .option("--no-metadata", "Strip EXIF/XMP/IPTC (ICC profile kept)")
  .option("-o, --output <dir>", "Output directory, created if missing (default: next to each input)")
  .option("-c, --concurrency <n>", "Parallel conversion limit", positiveInt("concurrency"), 4)
  .option("--quiet", "Suppress per-file progress lines (failures and summary still shown)")
  .option("--json", "Print results as a JSON array on stdout (progress goes to stderr)")
  .option("--dry-run", "Show what would happen without writing files")
  .option("--grayscale", "Convert to grayscale")
  .option("--rotate <degrees>", "Rotate by degrees (-360 to 360); corners filled with --background", number("rotate"))
  .option("--flip", "Mirror horizontally (left↔right)")
  .option("--flop", "Mirror vertically (top↔bottom)")
  .option("--background <color>", "Fill color for transparency, rotation and contain, e.g. #ffffff (JPEG default: white)")
  .option("--blur <sigma>", "Gaussian blur sigma (0.3-100)", number("blur"))
  .option("--sharpen", "Apply unsharp mask sharpening")
  .option("--normalize", "Stretch contrast to the full range")
  .option("--trim", "Trim uniform-color borders")
  .addHelpText(
    "after",
    `
Examples:
  img-convert photo.jpg -f webp --json
  img-convert "shots/*.png" -f jpeg --width 200 --height 200 --fit cover -o thumbs --json
  img-convert big.png -f jpeg --max-size 200KB --json
  img-convert info "shots/*.png"
  img-convert batch - --json < jobs.json

Exit codes: 0 ok, 1 some items failed (see the JSON array), 2 usage error (JSON {"error":...} with --json)
AI agents: run \`img-convert skill\` for the full usage guide.`
  )
  .action(async (files: string[], opts: {
    format?: string;
    quality: number;
    width?: number;
    height?: number;
    fit: "inside" | "cover" | "contain" | "fill";
    allowUpscaling?: boolean;
    crop?: CropOptions;
    maxSize?: number;
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
    const targetFormat = validateFormat(opts.format);
    if (opts.maxSize !== undefined && !QUALITY_FORMATS.includes(targetFormat)) {
      fail("INVALID_ARGS", `--max-size requires a lossy format (${QUALITY_FORMATS.join(", ")}), got "${targetFormat}"`);
    }
    const convertOptions = buildConvertOptions({ ...opts, format: targetFormat });

    // ------------------------------------------------------------------
    // Pipe mode: stdin → stdout
    // ------------------------------------------------------------------
    if (isPipeMode(process.stdin.isTTY, files)) {
      try {
        const inputBuffer = await readStdin();
        if (inputBuffer.length === 0) {
          fail("NO_INPUT", "No input files given and stdin is empty. Pass file paths, or pipe an image into stdin.");
        }
        // Magic bytes identify HEIC (there is no filename to go on)
        const { fileTypeFromBuffer } = await import("file-type");
        const detected = await fileTypeFromBuffer(inputBuffer);
        const sourceFormat =
          detected?.mime === "image/heic" || detected?.mime === "image/heif" ? ("heic" as const) : undefined;
        const outputBuffer = opts.maxSize
          ? (await processToMaxBytes(inputBuffer, convertOptions, opts.maxSize, sourceFormat)).buffer
          : await processImage(inputBuffer, convertOptions, sourceFormat);
        return writeAndExit(outputBuffer, 0);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exit(1);
      }
    }

    const inputs = await resolveOrFail(files);
    const jobs: Job[] = inputs.map((input) => ({
      input,
      options: convertOptions,
      outputDir: opts.output,
      maxBytes: opts.maxSize,
    }));
    const results = await runConvert(jobs, {
      concurrency: opts.concurrency,
      dryRun: opts.dryRun,
      onResult: (r) => printProgress(r, opts.quiet),
    });
    finish(results, opts.quiet);
  });

program.parseAsync(process.argv).catch((err) => {
  fail("INVALID_ARGS", (err as Error).message);
});
