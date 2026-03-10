"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processingQueue = void 0;
const async_sema_1 = require("async-sema");
/**
 * REQ-205: Module-level semaphore limiting server-side Sharp concurrency to 3.
 * Singleton — shared across all requests within the same Node.js process.
 * Always acquire before processImage() and release in a finally block.
 */
exports.processingQueue = new async_sema_1.Sema(3);
