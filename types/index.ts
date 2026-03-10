export type ImageFormat = "jpeg" | "png" | "webp" | "avif" | "gif" | "tiff" | "heic" | "svg" | "bmp";

export const FORMAT_LABELS: Record<ImageFormat, string> = {
  jpeg: "JPG",
  png: "PNG",
  webp: "WebP",
  avif: "AVIF",
  gif: "GIF",
  tiff: "TIFF",
  heic: "HEIC",
  svg: "SVG",
  bmp: "BMP",
};

export const FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  tiff: "image/tiff",
  heic: "image/heic",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

export const FORMAT_EXTENSIONS: Record<ImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
  gif: "gif",
  tiff: "tiff",
  heic: "heic",
  svg: "svg",
  bmp: "bmp",
};

export const QUALITY_FORMATS: ImageFormat[] = ["jpeg", "webp", "avif"];

// Formats valid as conversion output (Sharp can write these — excludes input-only formats)
export const OUTPUT_FORMATS: ImageFormat[] = ["jpeg", "png", "webp", "avif", "gif", "tiff"];

// Formats accepted as input only (Sharp cannot encode these)
export const INPUT_ONLY_FORMATS: ImageFormat[] = ["heic", "svg", "bmp"];

export interface CropOptions {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ConvertOptions {
  targetFormat: ImageFormat;
  quality: number;
  resizeWidth: number | null;
  resizeHeight: number | null;
  maintainAspectRatio: boolean;
  removeMetadata: boolean;
  allowUpscaling?: boolean;
  // New processing options
  crop?: CropOptions;
  rotate?: number;         // degrees: 0, 90, 180, 270, or any angle
  autoRotate?: boolean;    // use EXIF orientation
  flip?: boolean;          // horizontal mirror
  flop?: boolean;          // vertical mirror
  background?: string;     // CSS color string e.g. "#ffffff", "rgba(0,0,0,0)"
  grayscale?: boolean;
  blur?: number;           // Gaussian blur sigma (0.3–1000)
  sharpen?: boolean;
  normalize?: boolean;     // automatic contrast enhancement
  trim?: boolean;          // auto-trim whitespace/solid borders
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

// --- API error response shape (Phase 5 REQ-501) ---

export interface ApiErrorResponse {
  error: string;
  message: string;
  field?: string;
}

// --- Programmatic API types ---

export interface ConvertApiOptions {
  format: ImageFormat;
  quality?: number;
  width?: number;
  height?: number;
  removeMetadata?: boolean;
  maintainAspectRatio?: boolean;
  allowUpscaling?: boolean;
  crop?: CropOptions;
  rotate?: number;
  autoRotate?: boolean;
  flip?: boolean;
  flop?: boolean;
  background?: string;
  grayscale?: boolean;
  blur?: number;
  sharpen?: boolean;
  normalize?: boolean;
  trim?: boolean;
}

export interface ConvertApiResult {
  buffer: Buffer;
  info: {
    inputBytes: number;
    outputBytes: number;
    width: number;
    height: number;
    format: string;
  };
}

export interface ImageInfo {
  format: string;
  width: number;
  height: number;
  filesize: number;
  hasAlpha: boolean;
  hasExif: boolean;
  colorSpace: string;
  isAnimated: boolean;
  channels?: number;
  density?: number;
}

export interface BatchApiItem {
  input: string;    // file path or URL
  output?: string;  // output file path (optional, auto-generated if omitted)
  format: ImageFormat;
  quality?: number;
  width?: number;
  height?: number;
  removeMetadata?: boolean;
}

export interface BatchApiResult {
  input: string;
  output: string;
  inputBytes: number;
  outputBytes: number;
  width: number;
  height: number;
  format: string;
  quality: number;
}

export interface BatchApiOptions {
  concurrency?: number;
  outputDir?: string;
}

// --- CLI manifest batch types ---

export interface ManifestItem {
  input: string;
  output?: string;
  format: ImageFormat;
  quality?: number;
  width?: number;
  height?: number;
  removeMetadata?: boolean;
}
