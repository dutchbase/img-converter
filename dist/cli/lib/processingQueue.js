"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processingQueue = void 0;
const async_sema_1 = require("async-sema");
/**
 * REQ-205: Module-level semaphore limiting server-side Sharp concurrency.
 * Singleton — shared across all requests within the same Node.js process.
 * Always acquire before processImage() and release in a finally block.
 *
 * Concurrency is configurable via SHARP_CONCURRENCY env var (default: 3).
 * Acquire timeout is 60 seconds to prevent indefinite blocking.
 */
const concurrency = Math.max(1, parseInt(process.env.SHARP_CONCURRENCY ?? "3", 10) || 3);
const ACQUIRE_TIMEOUT_MS = 60_000;
const _sema = new async_sema_1.Sema(concurrency);
exports.processingQueue = {
    async acquire() {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Processing queue acquire timed out after 60s")), ACQUIRE_TIMEOUT_MS));
        await Promise.race([_sema.acquire(), timeout]);
    },
    release() {
        _sema.release();
    },
};
