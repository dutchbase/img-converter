"use strict";
/**
 * cli/helpers.ts
 * Pure helper functions for the CLI tool.
 * No Commander, Sharp, or glob imports — all functions receive plain values.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectFormatFromExt = detectFormatFromExt;
exports.buildOutputPath = buildOutputPath;
exports.buildConvertOptions = buildConvertOptions;
exports.formatKB = formatKB;
exports.isPipeMode = isPipeMode;
const path_1 = __importDefault(require("path"));
const index_1 = require("../types/index");
// Extension -> ImageFormat map (lower-cased)
const EXT_TO_FORMAT = {
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
    ".png": "png",
    ".webp": "webp",
    ".avif": "avif",
    ".gif": "gif",
    ".tiff": "tiff",
    ".tif": "tiff",
    ".heic": "heic",
    ".heif": "heic",
    ".svg": "svg",
    ".bmp": "bmp",
};
/**
 * Detect the ImageFormat from a file path's extension.
 * Returns null for unknown extensions.
 */
function detectFormatFromExt(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    return EXT_TO_FORMAT[ext] ?? null;
}
/**
 * Build the output file path for a converted image.
 *
 * @param inputPath  - Absolute or relative path to the source file
 * @param format     - Target ImageFormat
 * @param outputDir  - Optional directory for the output file (defaults to input directory)
 */
function buildOutputPath(inputPath, format, outputDir) {
    const dir = outputDir ?? path_1.default.dirname(inputPath);
    const ext = path_1.default.extname(inputPath);
    const basename = ext ? path_1.default.basename(inputPath, ext) : path_1.default.basename(inputPath);
    const newExt = index_1.FORMAT_EXTENSIONS[format];
    return path_1.default.join(dir, `${basename}.${newExt}`);
}
/**
 * Map Commander parsed options to a ConvertOptions object.
 *
 * Critical inversion: Commander's --no-metadata sets opts.metadata = false,
 * which maps to removeMetadata: true.
 */
function buildConvertOptions(opts) {
    return {
        targetFormat: opts.format,
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
function formatKB(bytes) {
    return `${Math.round(bytes / 1024)} KB`;
}
/**
 * Determine whether the CLI should operate in pipe mode
 * (reading from stdin rather than file arguments).
 *
 * @param isTTY  - Whether stdin is a TTY (process.stdin.isTTY)
 * @param files  - Positional file arguments provided by the user
 */
function isPipeMode(isTTY, files) {
    return !isTTY && files.length === 0;
}
