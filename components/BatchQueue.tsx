"use client";

import { downloadZip } from "client-zip";
import { BatchItem } from "@/types/client";

/**
 * Returns true when the Retry button should be rendered for a batch item.
 * Suppresses Retry for LIVE_PHOTO_NOT_SUPPORTED — retrying always fails for Live Photos.
 * Only items in "error" status are eligible; all other statuses return false.
 *
 * Exported as a pure function for unit testability (REQ-303).
 */
export function shouldShowRetry(item: BatchItem): boolean {
  if (item.status !== "error") return false;
  return item.errorCode !== "LIVE_PHOTO_NOT_SUPPORTED";
}

interface BatchQueueProps {
  items: BatchItem[];
  onRemoveItem: (id: string) => void;
  onRetryItem: (id: string) => void;
  isConverting: boolean;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  converting: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
  done: "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200",
  error: "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  converting: "Converting",
  done: "Done",
  error: "Failed",
};

async function handleDownloadZip(items: BatchItem[]) {
  const successItems = items.filter((item) => item.status === "done" && item.result);

  if (successItems.length === 0) return;

  const files = successItems.map((item) => ({
    name: item.result!.filename,
    input: item.result!.blob,
  }));

  const response = downloadZip(files);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "converted-images.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function BatchQueue({
  items,
  onRemoveItem,
  onRetryItem,
  isConverting,
}: BatchQueueProps) {
  const doneCount = items.filter((i) => i.status === "done").length;
  const allFinished =
    items.length > 0 && items.every((i) => i.status === "done" || i.status === "error");

  return (
    <div className="flex flex-col gap-3">
      {/* Aggregate count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
          {doneCount} / {items.length} converted
        </p>
      </div>

      {/* Scrollable row list */}
      <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-700 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden max-h-96 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} data-status={item.status} className="flex flex-col px-4 py-3 bg-white dark:bg-neutral-900 gap-1">
            {/* Main row: filename + sizes + status badge + action */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Filename */}
              <span
                className="flex-1 text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate min-w-0"
                title={item.file.name}
              >
                {item.file.name}
              </span>

              {/* Sizes */}
              <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap flex-shrink-0">
                {formatSize(item.originalSize)}
                {item.status === "done" && item.result && (
                  <> &rarr; {formatSize(item.result.sizeBytes)}</>
                )}
              </span>

              {/* Status badge */}
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_BADGE[item.status]}`}
              >
                {item.status === "converting" && (
                  <svg
                    className="w-3 h-3 animate-spin inline-block mr-1 -mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                )}
                {STATUS_LABEL[item.status]}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* X remove button — pending only */}
                {item.status === "pending" && (
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    disabled={isConverting}
                    className="text-neutral-400 hover:text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors p-0.5 dark:text-neutral-500 dark:hover:text-neutral-300"
                    aria-label={`Remove ${item.file.name}`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}

                {/* Download link — done only */}
                {item.status === "done" && item.result && (
                  <a
                    href={item.result.url}
                    download={item.result.filename}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors dark:hover:text-blue-400"
                  >
                    Download
                  </a>
                )}

                {/* Retry button — error only, suppressed for LIVE_PHOTO_NOT_SUPPORTED */}
                {shouldShowRetry(item) && (
                  <button
                    onClick={() => onRetryItem(item.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors dark:hover:text-red-400"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>

            {/* Error message row — error status only */}
            {item.status === "error" && item.error && (
              <p className="text-xs text-red-600 dark:text-red-400 pl-0 mt-0.5">{item.error}</p>
            )}
          </div>
        ))}
      </div>

      {/* ZIP download button — appears when all items finished */}
      {allFinished && doneCount > 0 && (
        <button
          onClick={() => handleDownloadZip(items)}
          className="w-full rounded-xl bg-green-600 text-white font-semibold px-6 py-3 hover:bg-green-700 transition-colors"
        >
          Download {doneCount} {doneCount === 1 ? "file" : "files"} as ZIP
        </button>
      )}
    </div>
  );
}
