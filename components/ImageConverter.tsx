"use client";

import { useState, useCallback } from "react";
import { ImageFormat, ConvertOptions, ConvertResult } from "@/types/client";
import DropZone from "./DropZone";
import ImagePreview from "./ImagePreview";
import ConvertOptionsPanel from "./ConvertOptions";
import ConvertResultPanel from "./ConvertResult";

const DEFAULT_OPTIONS: ConvertOptions = {
  targetFormat: "webp",
  quality: 85,
  resizeWidth: null,
  resizeHeight: null,
  maintainAspectRatio: true,
  removeMetadata: false,
};

/**
 * REQ-106: Detect animated GIF client-side via magic bytes and GCE marker count.
 * Pure synchronous function operating on bytes (not File, not async) — directly testable.
 * Returns true when buffer starts with GIF8 magic bytes AND contains more than one
 * Graphic Control Extension (0x21 0xF9) marker.
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

export default function ImageConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceFormat, setSourceFormat] = useState<ImageFormat | null>(null);
  const [options, setOptions] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);
  // REQ-106: Track animated GIF state to show warning banner
  const [isAnimatedGifFile, setIsAnimatedGifFile] = useState(false);

  const handleFileSelect = useCallback(async (selectedFile: File, format: ImageFormat) => {
    setFile(selectedFile);
    setSourceFormat(format);
    setResult(null);
    setError(null);
    // Default to a different format than the source
    setOptions((prev) => ({
      ...prev,
      targetFormat: format === "webp" ? "jpeg" : "webp",
    }));
    // REQ-106: Detect animated GIF client-side
    if (format === "gif") {
      const slice = await selectedFile.slice(0, 65536).arrayBuffer();
      setIsAnimatedGifFile(isAnimatedGif(new Uint8Array(slice)));
    } else {
      setIsAnimatedGifFile(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    if (result?.url) URL.revokeObjectURL(result.url);
    setFile(null);
    setSourceFormat(null);
    setResult(null);
    setError(null);
    setIsAnimatedGifFile(false);
  }, [result]);

  const handleConvert = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetFormat", options.targetFormat);
      formData.append("quality", options.quality.toString());
      formData.append("maintainAspectRatio", options.maintainAspectRatio.toString());
      formData.append("removeMetadata", options.removeMetadata.toString());
      if (options.resizeWidth) formData.append("resizeWidth", options.resizeWidth.toString());
      if (options.resizeHeight) formData.append("resizeHeight", options.resizeHeight.toString());
      if (options.allowUpscaling) formData.append("allowUpscaling", "true");

      const res = await fetch("/api/convert", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Conversion failed" }));
        throw new Error(data.error ?? "Conversion failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename = res.headers.get("X-Output-Filename") ?? `converted.${options.targetFormat}`;
      const sizeBytes = parseInt(res.headers.get("X-Output-Size") ?? blob.size.toString(), 10);

      setResult({ url, filename, format: options.targetFormat, sizeBytes });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [file, options]);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      {!file ? (
        <DropZone onFileSelect={handleFileSelect} />
      ) : (
        <>
          <ImagePreview file={file} sourceFormat={sourceFormat!} onClear={handleClear} />

          {/* REQ-106: Amber warning banner for animated GIFs */}
          {isAnimatedGifFile && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-amber-700">
                Animated GIF — only the first frame will be converted.
              </p>
            </div>
          )}

          {!result ? (
            <>
              <ConvertOptionsPanel
                sourceFormat={sourceFormat!}
                options={options}
                onChange={setOptions}
              />

              {error && (
                <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                onClick={handleConvert}
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 text-white font-semibold px-6 py-3.5 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Converting...
                  </>
                ) : (
                  "Convert Image"
                )}
              </button>
            </>
          ) : (
            <ConvertResultPanel
              result={result}
              originalSize={file.size}
              onConvertAnother={handleClear}
            />
          )}
        </>
      )}
    </div>
  );
}
