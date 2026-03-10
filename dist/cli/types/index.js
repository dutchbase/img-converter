"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INPUT_ONLY_FORMATS = exports.OUTPUT_FORMATS = exports.QUALITY_FORMATS = exports.FORMAT_EXTENSIONS = exports.FORMAT_MIME = exports.FORMAT_LABELS = void 0;
exports.FORMAT_LABELS = {
    jpeg: "JPG",
    png: "PNG",
    webp: "WebP",
    avif: "AVIF",
    gif: "GIF",
    tiff: "TIFF",
    heic: "HEIC",
    svg: "SVG",
    bmp: "BMP",
};
exports.FORMAT_MIME = {
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
    gif: "image/gif",
    tiff: "image/tiff",
    heic: "image/heic",
    svg: "image/svg+xml",
    bmp: "image/bmp",
};
exports.FORMAT_EXTENSIONS = {
    jpeg: "jpg",
    png: "png",
    webp: "webp",
    avif: "avif",
    gif: "gif",
    tiff: "tiff",
    heic: "heic",
    svg: "svg",
    bmp: "bmp",
};
exports.QUALITY_FORMATS = ["jpeg", "webp", "avif"];
// Formats valid as conversion output (Sharp can write these — excludes input-only formats)
exports.OUTPUT_FORMATS = ["jpeg", "png", "webp", "avif", "gif", "tiff"];
// Formats accepted as input only (Sharp cannot encode these)
exports.INPUT_ONLY_FORMATS = ["heic", "svg", "bmp"];
