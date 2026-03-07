export type ImageFormat = "jpeg" | "png" | "webp" | "avif" | "gif" | "tiff" | "heic";

export const FORMAT_LABELS: Record<ImageFormat, string> = {
  jpeg: "JPG",
  png: "PNG",
  webp: "WebP",
  avif: "AVIF",
  gif: "GIF",
  tiff: "TIFF",
  heic: "HEIC",
};

export const FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  tiff: "image/tiff",
  heic: "image/heic",
};

export const FORMAT_EXTENSIONS: Record<ImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
  gif: "gif",
  tiff: "tiff",
  heic: "heic",
};

export const QUALITY_FORMATS: ImageFormat[] = ["jpeg", "webp", "avif"];

// Formats valid as conversion output (Sharp can write these — excludes input-only formats)
export const OUTPUT_FORMATS: ImageFormat[] = ["jpeg", "png", "webp", "avif", "gif", "tiff"];

// Formats accepted as input only (Sharp cannot encode these)
export const INPUT_ONLY_FORMATS: ImageFormat[] = ["heic"];

export interface ConvertOptions {
  targetFormat: ImageFormat;
  quality: number;
  resizeWidth: number | null;
  resizeHeight: number | null;
  maintainAspectRatio: boolean;
  removeMetadata: boolean;
  allowUpscaling?: boolean;
}

export interface ConvertResult {
  url: string;
  filename: string;
  format: ImageFormat;
  sizeBytes: number;
}

// --- Batch processing types (Phase 2) ---

export type BatchStatus = "pending" | "converting" | "done" | "error";

export interface BatchItemResult {
  url: string;       // blob URL for individual download
  blob: Blob;        // raw Blob stored to avoid re-fetch for ZIP generation
  filename: string;  // sanitized output filename, e.g. "photo.webp"
  sizeBytes: number;
}

export interface BatchItem {
  id: string;          // crypto.randomUUID() assigned at file drop
  file: File;
  status: BatchStatus;
  originalSize: number; // file.size, set at drop time
  result?: BatchItemResult; // present only when status === "done"
  error?: string;           // present only when status === "error"
  errorCode?: string;       // machine-readable code for conditional rendering (e.g. "LIVE_PHOTO_NOT_SUPPORTED")
}
