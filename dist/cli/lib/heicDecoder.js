"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIVE_PHOTO_ERROR_CODE = void 0;
exports.decodeHeicToBuffer = decodeHeicToBuffer;
const heic_convert_1 = __importDefault(require("heic-convert"));
exports.LIVE_PHOTO_ERROR_CODE = "LIVE_PHOTO_NOT_SUPPORTED";
/**
 * Decodes a HEIC/HEIF buffer to a JPEG Buffer suitable for the Sharp pipeline.
 *
 * Uses convert.all() to detect multi-frame HEIC (Live Photos). If more than
 * one frame is present, throws with name === LIVE_PHOTO_ERROR_CODE.
 *
 * Uses quality: 1 (maximum) for the intermediate JPEG so that Sharp applies
 * the final quality during re-encoding — avoids double lossy compression.
 *
 * Note: heic-convert does a lot of work synchronously. The server-side
 * semaphore (limit 3 via lib/processingQueue.ts) is sufficient protection
 * for this project's self-hosted, low-concurrency use case.
 */
async function decodeHeicToBuffer(inputBuffer) {
    const images = await heic_convert_1.default.all({
        buffer: inputBuffer.buffer,
        format: "JPEG",
        quality: 1,
    });
    if (images.length > 1) {
        const err = new Error(exports.LIVE_PHOTO_ERROR_CODE);
        err.name = exports.LIVE_PHOTO_ERROR_CODE;
        throw err;
    }
    const outputArrayBuffer = await images[0].convert();
    return Buffer.from(outputArrayBuffer);
}
