"use strict";
/**
 * lib/api.ts
 * Programmatic Node.js API for img-convert.
 *
 * Usage:
 *   import { convert, getInfo, batch } from 'img-convert'
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convert = convert;
exports.getInfo = getInfo;
exports.batch = batch;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const p_limit_1 = __importDefault(require("p-limit"));
const imageProcessor_1 = require("../lib/imageProcessor");
const heicDecoder_1 = require("../lib/heicDecoder");
const safeFetch_1 = require("../lib/safeFetch");
const index_1 = require("../types/index");
const processingQueue_1 = require("../lib/processingQueue");
const formatUtils_1 = require("../lib/formatUtils");
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
/**
 * Validate that a file path is within CWD to prevent path traversal.
 */
function validateFilePath(filePath) {
    const cwd = process.cwd();
    const resolved = path_1.default.resolve(cwd, filePath);
    if (!resolved.startsWith(cwd + path_1.default.sep) && resolved !== cwd) {
        throw new Error(`Path "${filePath}" is outside the allowed directory`);
    }
}
function toConvertOptions(opts) {
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
async function resolveInput(input) {
    if (Buffer.isBuffer(input)) {
        return { buffer: input };
    }
    // URL input — use safeFetch for SSRF protection, timeout, and size limits
    if (input.startsWith("http://") || input.startsWith("https://")) {
        const buffer = await (0, safeFetch_1.safeFetch)(input);
        return { buffer };
    }
    // File path — validate within CWD
    validateFilePath(input);
    const buffer = await promises_1.default.readFile(input);
    const sourceFormat = (0, formatUtils_1.detectFormatFromExt)(input) ?? undefined;
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
async function convert(input, options) {
    const { buffer: inputBuffer, sourceFormat } = await resolveInput(input);
    let buf = inputBuffer;
    let effectiveSourceFormat = sourceFormat;
    if (sourceFormat === "heic") {
        // Pre-decode HEIC → JPEG buffer so processImage receives a Sharp-readable
        // buffer. Pass undefined as sourceFormat so processImage does NOT attempt a
        // second HEIC decode on the already-decoded JPEG buffer.
        buf = await (0, heicDecoder_1.decodeHeicToBuffer)(buf);
        effectiveSourceFormat = undefined;
    }
    const convertOpts = toConvertOptions(options);
    const outputBuffer = await (0, imageProcessor_1.processImage)(buf, convertOpts, effectiveSourceFormat);
    const meta = await (0, imageProcessor_1.getImageMetadata)(outputBuffer);
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
async function getInfo(input) {
    const { buffer } = await resolveInput(input);
    const filesize = buffer.length;
    const meta = await (0, imageProcessor_1.getImageMetadata)(buffer);
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
async function batch(items, batchOpts = {}) {
    const concurrency = batchOpts.concurrency ?? 4;
    const outputDir = batchOpts.outputDir;
    const limit = (0, p_limit_1.default)(concurrency);
    const settled = await Promise.allSettled(items.map((item) => limit(async () => {
        const { buffer: inputBuffer, sourceFormat } = await resolveInput(item.input);
        const quality = item.quality ?? 85;
        const convertOpts = {
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
        await processingQueue_1.processingQueue.acquire();
        let outputBuffer;
        try {
            outputBuffer = await (0, imageProcessor_1.processImage)(inputBuffer, convertOpts, sourceFormat);
        }
        finally {
            processingQueue_1.processingQueue.release();
        }
        const meta = await (0, imageProcessor_1.getImageMetadata)(outputBuffer);
        // Determine output path
        let outputPath = item.output;
        if (!outputPath) {
            const inputBase = typeof item.input === "string" ? item.input : "output";
            const ext = index_1.FORMAT_EXTENSIONS[item.format];
            const stem = path_1.default.basename(inputBase, path_1.default.extname(inputBase));
            const dir = outputDir ?? path_1.default.dirname(typeof item.input === "string" ? item.input : ".");
            outputPath = path_1.default.join(dir, `${stem}.${ext}`);
        }
        await promises_1.default.writeFile(outputPath, outputBuffer);
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
    })));
    // Return results for fulfilled items, re-throw first rejection if all failed
    const results = [];
    for (const result of settled) {
        if (result.status === "fulfilled") {
            results.push(result.value);
        }
        // Rejected items are silently skipped — caller gets partial results
    }
    return results;
}
