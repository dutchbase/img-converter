"use client";

import { useState, useCallback, useRef } from "react";
import pLimit from "p-limit";
import { ConvertOptions, BatchItem, BatchStatus } from "@/types/client";
import DropZone from "./DropZone";
import ConvertOptionsPanel from "./ConvertOptions";
import BatchQueue from "./BatchQueue";

/**
 * REQ-106: Detect animated GIF client-side via magic bytes and GCE marker count.
 * Pure synchronous function operating on bytes (not File, not async) — directly testable.
 * Returns true when buffer starts with GIF8 magic bytes AND contains more than one
 * Graphic Control Extension (0x21 0xF9) marker.
 *
 * Exported here for backward-compatibility with Phase 1 test stubs.
 */
export function isAnimatedGif(bytes: Uint8Array): boolean {
  // Must start with GIF magic bytes (GIF8)
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x38) {
    return false;
  }
  // Count Graphic Control Extension markers (0x21 0xF9)
  let count = 0;
  const limit = Math.min(bytes.length, 65536); // scan up to 64 KB
  for (let i = 0; i < limit - 1; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
      count++;
      if (count > 1) return true;
    }
  }
  return false;
}

const MAX_BATCH_FILES = 200;

const DEFAULT_OPTIONS: ConvertOptions = {
  targetFormat: "webp",
  quality: 85,
  resizeWidth: null,
  resizeHeight: null,
  maintainAspectRatio: true,
  removeMetadata: false,
};

/**
 * Typed conversion error that carries both the human-readable message and the
 * machine-readable error code returned by the API (e.g. "LIVE_PHOTO_NOT_SUPPORTED").
 * Stored on BatchItem so BatchQueue can apply conditional rendering rules (REQ-303).
 */
class ConversionError extends Error {
  readonly errorCode: string | undefined;
  constructor(message: string, errorCode?: string) {
    super(message);
    this.name = "ConversionError";
    this.errorCode = errorCode;
  }
}

async function convertSingleItem(
  item: BatchItem,
  options: ConvertOptions,
  signal?: AbortSignal
): Promise<{ blob: Blob; filename: string; sizeBytes: number }> {
  const formData = new FormData();
  formData.append("file", item.file);
  formData.append("targetFormat", options.targetFormat);
  formData.append("quality", options.quality.toString());
  formData.append("maintainAspectRatio", options.maintainAspectRatio.toString());
  formData.append("removeMetadata", options.removeMetadata.toString());
  if (options.resizeWidth) formData.append("resizeWidth", options.resizeWidth.toString());
  if (options.resizeHeight) formData.append("resizeHeight", options.resizeHeight.toString());
  if (options.allowUpscaling) formData.append("allowUpscaling", "true");
  // Advanced processing options
  if (options.rotate !== undefined) formData.append("rotate", options.rotate.toString());
  if (options.flip) formData.append("flip", "true");
  if (options.flop) formData.append("flop", "true");
  if (options.grayscale) formData.append("grayscale", "true");
  if (options.blur !== undefined) formData.append("blur", options.blur.toString());
  if (options.sharpen) formData.append("sharpen", "true");
  if (options.normalize) formData.append("normalize", "true");
  if (options.trim) formData.append("trim", "true");

  const res = await fetch("/api/convert", { method: "POST", body: formData, signal });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: "Conversion failed" }));
    throw new ConversionError(data.message ?? "Conversion failed", data.error);
  }

  const blob = await res.blob();
  const filename = res.headers.get("X-Output-Filename") ?? `converted.${options.targetFormat}`;
  const sizeBytes = parseInt(res.headers.get("X-Output-Size") ?? blob.size.toString(), 10);

  return { blob, filename, sizeBytes };
}

export default function ImageConverter() {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [options, setOptions] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [isConverting, setIsConverting] = useState(false);
  // AbortController for the active batch — used by "Cancel All"
  const abortControllerRef = useRef<AbortController | null>(null);

  const [batchError, setBatchError] = useState<string | null>(null);

  const handleFilesSelect = useCallback((files: File[]) => {
    setBatchError(null);
    const newItems: BatchItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "pending" as BatchStatus,
      originalSize: file.size,
    }));
    setBatchItems((prev) => {
      const combined = [...prev, ...newItems];
      if (combined.length > MAX_BATCH_FILES) {
        setBatchError(`Batch limited to ${MAX_BATCH_FILES} files. ${combined.length - MAX_BATCH_FILES} file(s) were not added.`);
        return combined.slice(0, MAX_BATCH_FILES);
      }
      return combined;
    });
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id || item.status !== "pending"));
  }, []);

  const handleConvertAll = useCallback(async () => {
    if (isConverting || batchItems.length === 0) return;
    setIsConverting(true);

    // Create a new AbortController for this batch run so Cancel All can stop in-flight requests
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Match the server-side semaphore limit (lib/processingQueue.ts: Sema(3))
    // so no request is ever silently queued on the server while we think it's running.
    const limit = pLimit(3);
    const pendingItems = batchItems.filter((i) => i.status === "pending");
    const currentOptions = options; // snapshot options at click time

    const tasks = pendingItems.map((item) =>
      limit(async () => {
        // Skip items queued after a cancel
        if (abortController.signal.aborted) {
          setBatchItems((prev) =>
            prev.map((i) => (i.id === item.id && i.status === "pending" ? { ...i, status: "error" as BatchStatus, error: "Cancelled" } : i))
          );
          return;
        }

        setBatchItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "converting" as BatchStatus } : i))
        );
        try {
          const { blob, filename, sizeBytes } = await convertSingleItem(item, currentOptions, abortController.signal);
          const url = URL.createObjectURL(blob);
          setBatchItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: "done" as BatchStatus, result: { url, blob, filename, sizeBytes } }
                : i
            )
          );
        } catch (err) {
          const isAbort = err instanceof Error && (err.name === "AbortError" || abortController.signal.aborted);
          const message = isAbort ? "Cancelled" : (err instanceof Error ? err.message : "Conversion failed");
          const errorCode = err instanceof ConversionError ? err.errorCode : undefined;
          setBatchItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: "error" as BatchStatus, error: message, errorCode } : i
            )
          );
        }
      })
    );

    await Promise.allSettled(tasks);
    abortControllerRef.current = null;
    setIsConverting(false);
  }, [isConverting, batchItems, options]);

  const handleCancelAll = useCallback(() => {
    abortControllerRef.current?.abort();
    setBatchItems((prev) =>
      prev.map((i) =>
        i.status === "converting" || i.status === "pending"
          ? { ...i, status: "error" as BatchStatus, error: "Cancelled" }
          : i
      )
    );
    setIsConverting(false);
  }, []);

  const handleRetryItem = useCallback(
    async (id: string) => {
      const item = batchItems.find((i) => i.id === id);
      if (!item || item.status !== "error") return;
      const currentOptions = options;

      setBatchItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: "converting" as BatchStatus, error: undefined, errorCode: undefined } : i
        )
      );

      try {
        const { blob, filename, sizeBytes } = await convertSingleItem(item, currentOptions);
        const url = URL.createObjectURL(blob);
        setBatchItems((prev) =>
          prev.map((i) =>
            i.id === id
              ? { ...i, status: "done" as BatchStatus, result: { url, blob, filename, sizeBytes } }
              : i
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Conversion failed";
        const errorCode = err instanceof ConversionError ? err.errorCode : undefined;
        setBatchItems((prev) =>
          prev.map((i) =>
            i.id === id ? { ...i, status: "error" as BatchStatus, error: message, errorCode } : i
          )
        );
      }
    },
    [batchItems, options]
  );

  const handleClearQueue = useCallback(() => {
    batchItems.forEach((item) => {
      if (item.result?.url) URL.revokeObjectURL(item.result.url);
    });
    setBatchItems([]);
  }, [batchItems]);

  const allDone =
    batchItems.length > 0 && batchItems.every((i) => i.status === "done" || i.status === "error");
  const doneOrErrorCount = batchItems.filter((i) => i.status === "done" || i.status === "error").length;
  const convertButtonText = isConverting
    ? `${doneOrErrorCount}/${batchItems.length} converting...`
    : "Convert All";

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      {/* Batch limit warning */}
      {batchError && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
          {batchError}
        </div>
      )}

      {/* Drop zone — locked during conversion (REQ-201, locked decision) */}
      <DropZone onFilesSelect={handleFilesSelect} disabled={isConverting} />

      {/* Shared conversion options — always visible when files present (REQ-202) */}
      {batchItems.length > 0 && (
        <ConvertOptionsPanel
          sourceFormat={null}
          options={options}
          onChange={setOptions}
        />
      )}

      {/* Batch queue — file rows with status (REQ-203) */}
      {batchItems.length > 0 && (
        <BatchQueue
          items={batchItems}
          onRemoveItem={handleRemoveItem}
          onRetryItem={handleRetryItem}
          isConverting={isConverting}
        />
      )}

      {/* Convert All + Cancel All + Clear queue buttons */}
      {batchItems.length > 0 && (
        <div className="flex flex-col gap-3">
          {!allDone && (
            <>
              <button
                onClick={handleConvertAll}
                disabled={isConverting || batchItems.filter((i) => i.status === "pending").length === 0}
                aria-label="Convert all pending images"
                className="w-full rounded-xl bg-blue-600 text-white font-semibold px-6 py-3.5 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isConverting && (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {convertButtonText}
              </button>
              {isConverting && (
                <button
                  onClick={handleCancelAll}
                  aria-label="Cancel all conversions"
                  className="w-full rounded-xl border border-red-300 text-red-600 font-semibold px-6 py-3 hover:bg-red-50 transition-colors dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Cancel All
                </button>
              )}
            </>
          )}
          {allDone && (
            <button
              onClick={handleClearQueue}
              className="w-full rounded-xl border border-neutral-300 text-neutral-700 font-semibold px-6 py-3.5 hover:bg-neutral-50 transition-colors dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Clear queue
            </button>
          )}
        </div>
      )}
    </div>
  );
}
