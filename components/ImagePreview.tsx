"use client";

import { ImageFormat, FORMAT_LABELS, FORMAT_EXTENSIONS } from "@/types/client";

interface ImagePreviewProps {
  file: File;
  sourceFormat: ImageFormat;
  onClear: () => void;
}

export default function ImagePreview({ file, sourceFormat, onClear }: ImagePreviewProps) {
  const previewUrl = URL.createObjectURL(file);
  const sizeKb = (file.size / 1024).toFixed(1);

  return (
    <div className="relative rounded-2xl border border-neutral-200 bg-neutral-50 overflow-hidden dark:border-neutral-700 dark:bg-neutral-900">
      <div className="relative aspect-video flex items-center justify-center bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)_0_0/16px_16px] dark:bg-[repeating-conic-gradient(#262626_0%_25%,#171717_0%_50%)_0_0/16px_16px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Preview"
          className="max-h-64 max-w-full object-contain shadow-sm"
          onLoad={() => URL.revokeObjectURL(previewUrl)}
        />
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{file.name}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {FORMAT_LABELS[sourceFormat]} &middot; {sizeKb} KB
          </p>
        </div>
        <button
          onClick={onClear}
          className="ml-3 shrink-0 text-neutral-400 hover:text-red-500 transition-colors"
          title="Remove"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
