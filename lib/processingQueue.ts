import { Sema } from "async-sema";

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

const _sema = new Sema(concurrency);

export const processingQueue = {
  async acquire(): Promise<void> {
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // If we give up waiting, hand the permit back the moment it arrives
    const acquired = _sema.acquire().then(() => { if (timedOut) _sema.release(); });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new Error("Processing queue acquire timed out after 60s"));
      }, ACQUIRE_TIMEOUT_MS);
    });
    try {
      await Promise.race([acquired, timeout]);
    } finally {
      clearTimeout(timer);
    }
  },
  release(): void {
    _sema.release();
  },
};
