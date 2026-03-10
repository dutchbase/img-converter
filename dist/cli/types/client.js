"use strict";
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTPUT_FORMATS = void 0;
exports.detectFormatFromMime = detectFormatFromMime;
__exportStar(require("./index"), exports);
function detectFormatFromMime(mimeType, filename) {
    const map = {
        "image/jpeg": "jpeg",
        "image/jpg": "jpeg",
        "image/png": "png",
        "image/webp": "webp",
        "image/avif": "avif",
        "image/gif": "gif",
        "image/tiff": "tiff",
        // REQ-301: HEIC/HEIF support — all variants returned by file-type v21.3.0
        "image/heic": "heic",
        "image/heif": "heic", // normalize heif → heic
        "image/heic-sequence": "heic",
        "image/heif-sequence": "heic",
    };
    const byMime = map[mimeType];
    if (byMime)
        return byMime;
    // REQ-301: Fallback — Firefox and older Chrome report .heic files as
    // application/octet-stream. Check file extension when MIME is generic.
    if (mimeType === "application/octet-stream" || mimeType === "" || mimeType == null) {
        const ext = filename?.split(".").pop()?.toLowerCase();
        if (ext === "heic" || ext === "heif")
            return "heic";
    }
    return null;
}
var index_1 = require("./index");
Object.defineProperty(exports, "OUTPUT_FORMATS", { enumerable: true, get: function () { return index_1.OUTPUT_FORMATS; } });
