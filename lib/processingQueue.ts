import { Sema } from "async-sema";

/**
 * REQ-205: Module-level semaphore limiting server-side Sharp concurrency to 3.
 * Singleton — shared across all requests within the same Node.js process.
 * Always acquire before processImage() and release in a finally block.
 */
export const processingQueue = new Sema(3);
