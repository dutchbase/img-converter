"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMcpServer = startMcpServer;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const promises_1 = __importDefault(require("fs/promises"));
const imageProcessor_1 = require("../lib/imageProcessor");
const heicDecoder_1 = require("../lib/heicDecoder");
const index_1 = require("../types/index");
const helpers_1 = require("../cli/helpers");
async function fetchBuffer(urlOrPath) {
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
        const res = await fetch(urlOrPath);
        if (!res.ok)
            throw new Error(`Failed to fetch ${urlOrPath}: ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
    }
    return promises_1.default.readFile(urlOrPath);
}
async function startMcpServer() {
    const server = new index_js_1.Server({ name: "img-convert", version: "1.0.0" }, {
        capabilities: { tools: {} },
        instructions: "Image conversion server. Convert images between formats, get metadata, and batch-process files.",
    });
    // -------------------------------------------------------------------------
    // List tools
    // -------------------------------------------------------------------------
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
        tools: [
            {
                name: "convert_image",
                description: "Convert an image file to another format. Supports JPEG, PNG, WebP, AVIF, GIF, TIFF, BMP output formats.",
                inputSchema: {
                    type: "object",
                    properties: {
                        input_path: {
                            type: "string",
                            description: "Path to the input image file or a HTTP/HTTPS URL",
                        },
                        output_format: {
                            type: "string",
                            enum: index_1.OUTPUT_FORMATS,
                            description: "Target image format",
                        },
                        output_path: {
                            type: "string",
                            description: "Path for the output file. If omitted, derived from input_path with new extension.",
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
                                    output_format: { type: "string", enum: index_1.OUTPUT_FORMATS },
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
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        if (name === "list_supported_formats") {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            input: ["jpeg", "png", "webp", "avif", "gif", "tiff", "heic", "svg", "bmp"],
                            output: index_1.OUTPUT_FORMATS,
                        }, null, 2),
                    },
                ],
            };
        }
        if (name === "get_image_info") {
            const inputPath = args?.input_path;
            if (!inputPath)
                throw new Error("input_path is required");
            const buffer = await fetchBuffer(inputPath);
            const ext = (0, helpers_1.detectFormatFromExt)(inputPath);
            const buf = ext === "heic" ? await (0, heicDecoder_1.decodeHeicToBuffer)(buffer) : buffer;
            const meta = await (0, imageProcessor_1.getImageMetadata)(buf);
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
            const inputPath = args?.input_path;
            const outputFormat = args?.output_format;
            if (!inputPath)
                throw new Error("input_path is required");
            if (!outputFormat)
                throw new Error("output_format is required");
            const inputBuffer = await fetchBuffer(inputPath);
            const sourceFormat = (0, helpers_1.detectFormatFromExt)(inputPath) ?? undefined;
            const outputPath = args?.output_path ??
                (0, helpers_1.buildOutputPath)(inputPath, outputFormat);
            const outputBuffer = await (0, imageProcessor_1.processImage)(inputBuffer, {
                targetFormat: outputFormat,
                quality: args?.quality ?? 85,
                resizeWidth: args?.width ?? null,
                resizeHeight: args?.height ?? null,
                maintainAspectRatio: true,
                removeMetadata: args?.remove_metadata ?? false,
                grayscale: args?.grayscale,
                rotate: args?.rotate,
                background: args?.background,
            }, sourceFormat);
            await promises_1.default.writeFile(outputPath, outputBuffer);
            const meta = await (0, imageProcessor_1.getImageMetadata)(outputBuffer);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            input_path: inputPath,
                            output_path: outputPath,
                            input_bytes: inputBuffer.length,
                            output_bytes: outputBuffer.length,
                            reduction: parseFloat(((1 - outputBuffer.length / inputBuffer.length) * 100).toFixed(1)),
                            width: meta.width ?? 0,
                            height: meta.height ?? 0,
                            format: outputFormat,
                            quality: args?.quality ?? 85,
                        }, null, 2),
                    },
                ],
            };
        }
        if (name === "batch_convert") {
            const items = args?.items;
            if (!items?.length)
                throw new Error("items array is required and must not be empty");
            const concurrency = args?.concurrency ?? 4;
            const results = [];
            // Simple sequential processing for MCP (concurrency handled externally)
            const limit = concurrency;
            let active = 0;
            const queue = [...items];
            const pending = [];
            const processItem = async (item) => {
                const inputBuffer = await fetchBuffer(item.input_path);
                const sourceFormat = (0, helpers_1.detectFormatFromExt)(item.input_path) ?? undefined;
                const outputPath = item.output_path ??
                    (0, helpers_1.buildOutputPath)(item.input_path, item.output_format);
                const outputBuffer = await (0, imageProcessor_1.processImage)(inputBuffer, {
                    targetFormat: item.output_format,
                    quality: item.quality ?? 85,
                    resizeWidth: item.width ?? null,
                    resizeHeight: item.height ?? null,
                    maintainAspectRatio: true,
                    removeMetadata: false,
                }, sourceFormat);
                await promises_1.default.writeFile(outputPath, outputBuffer);
                const meta = await (0, imageProcessor_1.getImageMetadata)(outputBuffer);
                results.push({
                    input_path: item.input_path,
                    output_path: outputPath,
                    input_bytes: inputBuffer.length,
                    output_bytes: outputBuffer.length,
                    width: meta.width ?? 0,
                    height: meta.height ?? 0,
                    format: item.output_format,
                });
            };
            // Process with concurrency limit
            const { default: pLimit } = await Promise.resolve().then(() => __importStar(require("p-limit")));
            const limiter = pLimit(limit);
            await Promise.all(items.map((item) => limiter(() => processItem(item))));
            return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
        }
        throw new Error(`Unknown tool: ${name}`);
    });
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
