"use client";

import { useCallback, useState } from "react";
import { FORMAT_LABELS, detectFormatFromMime } from "@/types/client";

interface DropZoneProps {
  onFilesSelect: (files: File[]) => void;
  disabled?: boolean;
}

export default function DropZone({ onFilesSelect, disabled = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (fileList: File[]) => {
      setError(null);
      const valid = fileList.filter((f) => detectFormatFromMime(f.type, f.name) !== null);
      if (valid.length === 0) {
        setError("No supported images found. Please upload JPG, PNG, WebP, AVIF, GIF, TIFF, or HEIC files.");
        return;
      }
      onFilesSelect(valid);
    },
    [onFilesSelect]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles, disabled]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      handleFiles(Array.from(e.target.files ?? []));
      e.target.value = "";
    },
    [handleFiles, disabled]
  );

  const supportedFormats = Object.values(FORMAT_LABELS).join(", ");

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`relative flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed transition-colors min-h-48 ${
        disabled
          ? "border-neutral-200 bg-neutral-50 opacity-50 pointer-events-none cursor-not-allowed dark:border-neutral-700 dark:bg-neutral-900"
          : isDragging
          ? "border-blue-500 bg-blue-50 cursor-pointer dark:bg-blue-950 dark:border-blue-400"
          : "border-neutral-300 hover:border-blue-400 hover:bg-neutral-50 cursor-pointer dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:hover:border-blue-400"
      }`}
    >
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff,image/heic,image/heif"
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={onInputChange}
        disabled={disabled}
      />
      <div className="pointer-events-none flex flex-col items-center gap-3 p-8 text-center">
        <svg
          className={`w-12 h-12 ${isDragging ? "text-blue-500" : "text-neutral-400 dark:text-neutral-500"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <div>
          <p className="text-base font-semibold text-neutral-700 dark:text-neutral-200">
            Drop images here, or click to browse
          </p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{supportedFormats} &mdash; up to 50 MB each</p>
        </div>
      </div>
      {error && (
        <p className="absolute bottom-3 text-sm text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}
