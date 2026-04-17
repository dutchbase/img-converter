/**
 * cli/mcp.ts
 * MCP (Model Context Protocol) server for img-convert.
 *
 * Exposes image conversion tools to AI agents via stdio transport.
 *
 * Usage:
 *   img-convert mcp
 *
 * Register in ~/.claude/mcp.json:
 *   { "img-convert": { "command": "img-convert", "args": ["mcp"] } }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { processImage, getImageMetadata } from "@/lib/imageProcessor";
import { decodeHeicToBuffer } from "@/lib/heicDecoder";
import { safeFetch } from "@/lib/safeFetch";
import { OUTPUT_FORMATS, FORMAT_EXTENSIONS } from "@/types/index";
import { detectFormatFromExt, buildOutputPath } from "@/cli/helpers";
import type { ImageFormat } from "@/types/index";

// Read version from package.json at runtime so it never drifts from the published version.
// Using require() directly — this file compiles to CommonJS (tsconfig.cli.json module: CommonJS).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version: PKG_VERSION } = require("../package.json") as { version: string };

const MAX_BATCH_ITEMS = 100;

/**
 * Validate and resolve a file path, ensuring it stays within CWD.
 * Prevents path-traversal attacks (e.g. ../../etc/passwd).
 */
function validatePath(p: string): string {
  const cwd = process.cwd();
  const resolved = path.resolve(cwd, p);
  if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
    throw new Error(`Path "${p}" is outside the allowed directory`);
  }
  return resolved;
}

/**
 * Validate output_format against OUTPUT_FORMATS allowlist.
 */
function validateOutputFormat(format: string): ImageFormat {
  if (!(OUTPUT_FORMATS as string[]).includes(format)) {
    throw new Error(`Invalid output format "${format}". Allowed: ${OUTPUT_FORMATS.join(", ")}`);
  }
  return format as ImageFormat;
}

/**
 * Clamp quality to [1, 100].
 */
function clampQuality(q: number | undefined): number {
  if (q === undefined) return 85;
  return Math.max(1, Math.min(100, Math.round(q)));
}

async function fetchBuffer(urlOrPath: string): Promise<Buffer> {
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    return safeFetch(urlOrPath);
  }
  const safePath = validatePath(urlOrPath);
  return fs.readFile(safePath);
}

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "img-convert", version: PKG_VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        "Image conversion server. Convert images between formats, get metadata, and batch-process files.",
    }
  );

  // -------------------------------------------------------------------------
  // List tools
  // -------------------------------------------------------------------------
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "convert_image",
        description:
          "Convert an image file to another format. Supports JPEG, PNG, WebP, AVIF, GIF, TIFF, BMP output formats.",
        inputSchema: {
          type: "object",
          properties: {
            input_path: {
              type: "string",
              description: "Path to the input image file or a HTTP/HTTPS URL",
            },
            output_format: {
              type: "string",
              enum: OUTPUT_FORMATS,
              description: "Target image format",
            },
            output_path: {
              type: "string",
              description:
                "Path for the output file. If omitted, derived from input_path with new extension.",
            },
            quality: {
              type: "number",
              description: "Quality 1-100 (for JPEG, WebP, AVIF). Default: 85",
            },
            width: {
              type: "number",
              description: "Resize to this width in pixels (maintains aspect ratio)",
            },
            height: {
              type: "number",
              description: "Resize to this height in pixels (maintains aspect ratio)",
            },
            remove_metadata: {
              type: "boolean",
              description: "Strip EXIF metadata. Default: false",
            },
            grayscale: {
              type: "boolean",
              description: "Convert to grayscale",
            },
            rotate: {
              type: "number",
              description: "Rotate by degrees (e.g. 90, 180, 270)",
            },
            flip: {
              type: "boolean",
              description: "Flip image horizontally (mirror left-right)",
            },
            flop: {
              type: "boolean",
              description: "Flip image vertically (mirror top-bottom)",
            },
            blur: {
              type: "number",
              description: "Gaussian blur sigma (0.3–1000). Values <= 0 are ignored.",
            },
            sharpen: {
              type: "boolean",
              description: "Apply unsharp mask sharpening",
            },
            normalize: {
              type: "boolean",
              description: "Apply automatic contrast enhancement",
            },
            trim: {
              type: "boolean",
              description: "Auto-trim whitespace or solid-color borders",
            },
            background: {
              type: "string",
              description: "Background fill color for transparency (e.g. '#ffffff')",
            },
          },
          required: ["input_path", "output_format"],
        },
      },
      {
        name: "get_image_info",
        description: "Get metadata about an image: format, dimensions, filesize, alpha, EXIF, color space, animation.",
        inputSchema: {
          type: "object",
          properties: {
            input_path: {
              type: "string",
              description: "Path to the image file or a HTTP/HTTPS URL",
            },
          },
          required: ["input_path"],
        },
      },
      {
        name: "batch_convert",
        description: "Convert multiple images in parallel.",
        inputSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "List of conversion jobs",
              items: {
                type: "object",
                properties: {
                  input_path: { type: "string" },
                  output_format: { type: "string", enum: OUTPUT_FORMATS },
                  output_path: { type: "string" },
                  quality: { type: "number" },
                  width: { type: "number" },
                  height: { type: "number" },
                },
                required: ["input_path", "output_format"],
              },
            },
            concurrency: {
              type: "number",
              description: "Number of parallel conversions. Default: 4",
            },
          },
          required: ["items"],
        },
      },
      {
        name: "list_supported_formats",
        description: "List all supported input and output image formats.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  }));

  // -------------------------------------------------------------------------
  // Handle tool calls
  // -------------------------------------------------------------------------
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "list_supported_formats") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                input: ["jpeg", "png", "webp", "avif", "gif", "tiff", "heic", "svg", "bmp"],
                output: OUTPUT_FORMATS,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "get_image_info") {
      const inputPath = args?.input_path as string;
      if (!inputPath) throw new Error("input_path is required");

      const buffer = await fetchBuffer(inputPath);
      const ext = detectFormatFromExt(inputPath);
      const buf = ext === "heic" ? await decodeHeicToBuffer(buffer) : buffer;
      const meta = await getImageMetadata(buf);

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

      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    }

    if (name === "convert_image") {
      const inputPath = args?.input_path as string;
      const rawFormat = args?.output_format as string;
      if (!inputPath) throw new Error("input_path is required");
      if (!rawFormat) throw new Error("output_format is required");
      const outputFormat = validateOutputFormat(rawFormat);

      const inputBuffer = await fetchBuffer(inputPath);
      const sourceFormat = detectFormatFromExt(inputPath) ?? undefined;

      // Validate output path if provided, otherwise derive from input
      const rawOutputPath = args?.output_path as string | undefined;
      const outputPath = rawOutputPath
        ? validatePath(rawOutputPath)
        : buildOutputPath(inputPath, outputFormat);

      const outputBuffer = await processImage(
        inputBuffer,
        {
          targetFormat: outputFormat,
          quality: clampQuality(args?.quality as number | undefined),
          resizeWidth: (args?.width as number | undefined) ?? null,
          resizeHeight: (args?.height as number | undefined) ?? null,
          maintainAspectRatio: true,
          removeMetadata: (args?.remove_metadata as boolean | undefined) ?? false,
          grayscale: args?.grayscale as boolean | undefined,
          rotate: args?.rotate as number | undefined,
          flip: args?.flip as boolean | undefined,
          flop: args?.flop as boolean | undefined,
          blur: args?.blur as number | undefined,
          sharpen: args?.sharpen as boolean | undefined,
          normalize: args?.normalize as boolean | undefined,
          trim: args?.trim as boolean | undefined,
          background: args?.background as string | undefined,
        },
        sourceFormat
      );

      await fs.writeFile(outputPath, outputBuffer);
      const meta = await getImageMetadata(outputBuffer);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                input_path: inputPath,
                output_path: outputPath,
                input_bytes: inputBuffer.length,
                output_bytes: outputBuffer.length,
                reduction: parseFloat(
                  ((1 - outputBuffer.length / inputBuffer.length) * 100).toFixed(1)
                ),
                width: meta.width ?? 0,
                height: meta.height ?? 0,
                format: outputFormat,
                quality: clampQuality(args?.quality as number | undefined),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "batch_convert") {
      const items = args?.items as Array<{
        input_path: string;
        output_format: string;
        output_path?: string;
        quality?: number;
        width?: number;
        height?: number;
      }>;
      if (!items?.length) throw new Error("items array is required and must not be empty");
      if (items.length > MAX_BATCH_ITEMS) {
        throw new Error(`Batch limited to ${MAX_BATCH_ITEMS} items, got ${items.length}`);
      }

      const concurrency = (args?.concurrency as number | undefined) ?? 4;
      const results: object[] = [];

      const processItem = async (item: typeof items[0]): Promise<void> => {
        // Per-item error handling: a failure in one item does not abort the whole batch.
        try {
          const validatedFormat = validateOutputFormat(item.output_format);
          const inputBuffer = await fetchBuffer(item.input_path);
          const sourceFormat = detectFormatFromExt(item.input_path) ?? undefined;
          const rawOutputPath = item.output_path;
          const outputPath = rawOutputPath
            ? validatePath(rawOutputPath)
            : buildOutputPath(item.input_path, validatedFormat);

          const outputBuffer = await processImage(
            inputBuffer,
            {
              targetFormat: validatedFormat,
              quality: clampQuality(item.quality),
              resizeWidth: item.width ?? null,
              resizeHeight: item.height ?? null,
              maintainAspectRatio: true,
              removeMetadata: false,
            },
            sourceFormat
          );

          await fs.writeFile(outputPath, outputBuffer);
          const meta = await getImageMetadata(outputBuffer);

          results.push({
            input_path: item.input_path,
            output_path: outputPath,
            input_bytes: inputBuffer.length,
            output_bytes: outputBuffer.length,
            width: meta.width ?? 0,
            height: meta.height ?? 0,
            format: validatedFormat,
          });
        } catch (err) {
          results.push({
            input_path: item.input_path,
            error: (err as Error).message,
          });
        }
      };

      // Process with concurrency limit (use p-limit from top-level mock-compatible import)
      const { default: pLimit } = await import("p-limit");
      const limiter = pLimit(concurrency);
      await Promise.all(items.map((item) => limiter(() => processItem(item))));

      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
