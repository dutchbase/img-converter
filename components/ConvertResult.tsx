"use client";

import { ConvertResult, FORMAT_LABELS } from "@/types/client";

interface ConvertResultProps {
  result: ConvertResult;
  originalSize: number;
  onConvertAnother: () => void;
}

export default function ConvertResultPanel({ result, originalSize, onConvertAnother }: ConvertResultProps) {
  const savedBytes = originalSize - result.sizeBytes;
  const savedPct = ((savedBytes / originalSize) * 100).toFixed(1);
  const isSmaller = savedBytes > 0;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 dark:border-green-800 dark:bg-green-950">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-semibold text-green-800 dark:text-green-200">Conversion complete</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Original</p>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{formatSize(originalSize)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Output</p>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{formatSize(result.sizeBytes)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Savings</p>
            <p className={`text-sm font-semibold ${isSmaller ? "text-green-700" : "text-orange-600"}`}>
              {isSmaller ? `-${savedPct}%` : `+${Math.abs(Number(savedPct))}%`}
            </p>
          </div>
        </div>
      </div>

      <a
        href={result.url}
        download={result.filename}
        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white font-semibold px-6 py-3 hover:bg-blue-700 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download {FORMAT_LABELS[result.format]} &mdash; {result.filename}
      </a>

      <button
        onClick={onConvertAnother}
        className="text-sm text-neutral-500 hover:text-neutral-800 underline underline-offset-2 transition-colors dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        Convert another image
      </button>
    </div>
  );
}
