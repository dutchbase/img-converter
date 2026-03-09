"use client";

import { ImageFormat, FORMAT_LABELS, QUALITY_FORMATS, OUTPUT_FORMATS, ConvertOptions } from "@/types/client";

interface ConvertOptionsProps {
  sourceFormat: ImageFormat | null;
  options: ConvertOptions;
  onChange: (options: ConvertOptions) => void;
}

// Output formats only (excludes input-only formats like HEIC — see OUTPUT_FORMATS in types/index.ts)

export default function ConvertOptionsPanel({ sourceFormat, options, onChange }: ConvertOptionsProps) {
  const set = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) =>
    onChange({ ...options, [key]: value });

  const qualityApplies = QUALITY_FORMATS.includes(options.targetFormat);

  return (
    <div className="flex flex-col gap-6">
      {/* Format selector */}
      <div>
        <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-2">Convert to</label>
        <div className="flex flex-wrap gap-2">
          {OUTPUT_FORMATS.map((fmt) => (
            <button
              key={fmt}
              onClick={() => set("targetFormat", fmt)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                options.targetFormat === fmt
                  ? "bg-blue-600 text-white border-blue-600"
                  : fmt === sourceFormat && sourceFormat !== null
                  ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-default dark:bg-neutral-800 dark:text-neutral-600 dark:border-neutral-700"
                  : "bg-white text-neutral-700 border-neutral-300 hover:border-blue-400 hover:text-blue-600 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 dark:hover:border-blue-400 dark:hover:text-blue-400"
              }`}
            >
              {FORMAT_LABELS[fmt]}
            </button>
          ))}
        </div>

        {/* REQ-105: AVIF encoding hint */}
        {options.targetFormat === "avif" && (
          <p className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            AVIF encodes more slowly than other formats — large images may take a few seconds longer.
          </p>
        )}
      </div>

      {/* Quality */}
      <div className={qualityApplies ? "" : "opacity-40 pointer-events-none"}>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            Quality
            {!qualityApplies && (
              <span className="ml-2 text-xs font-normal text-neutral-400">(not applicable for {FORMAT_LABELS[options.targetFormat]})</span>
            )}
          </label>
          <span className="text-sm font-mono text-blue-600 font-semibold">{options.quality}%</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          value={options.quality}
          onChange={(e) => set("quality", parseInt(e.target.value, 10))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          <span>Smaller file</span>
          <span>Higher quality</span>
        </div>
      </div>

      {/* Resize */}
      <div>
        <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-2">Resize (optional)</label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Width (px)</label>
            <input
              type="number"
              min={1}
              placeholder="e.g. 1920"
              value={options.resizeWidth ?? ""}
              onChange={(e) => set("resizeWidth", e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-200"
            />
          </div>
          <span className="mt-5 text-neutral-400 text-lg">×</span>
          <div className="flex-1">
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Height (px)</label>
            <input
              type="number"
              min={1}
              placeholder="e.g. 1080"
              value={options.resizeHeight ?? ""}
              onChange={(e) => set("resizeHeight", e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-200"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={options.maintainAspectRatio}
            onChange={(e) => set("maintainAspectRatio", e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Maintain aspect ratio</span>
        </label>

        {/* REQ-107: Allow upscaling toggle — only visible when resize dimensions are entered */}
        {(options.resizeWidth || options.resizeHeight) && (
          <div className="flex items-start gap-3 mt-3">
            <input
              type="checkbox"
              id="allow-upscaling"
              checked={options.allowUpscaling ?? false}
              onChange={(e) => set("allowUpscaling", e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer"
            />
            <label htmlFor="allow-upscaling" className="cursor-pointer">
              <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Allow upscaling</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                By default, images are not enlarged beyond their original size.
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
        <input
          type="checkbox"
          id="remove-metadata"
          checked={options.removeMetadata}
          onChange={(e) => set("removeMetadata", e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer"
        />
        <label htmlFor="remove-metadata" className="cursor-pointer">
          <span className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">Remove metadata</span>
          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Strips EXIF data (GPS location, camera model, timestamps, etc.)
          </span>
        </label>
      </div>
    </div>
  );
}
