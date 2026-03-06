export type ImageFormat = "jpeg" | "png" | "webp" | "avif" | "gif" | "tiff";

export const FORMAT_LABELS: Record<ImageFormat, string> = {
  jpeg: "JPG",
  png: "PNG",
  webp: "WebP",
  avif: "AVIF",
  gif: "GIF",
  tiff: "TIFF",
};

export const FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  tiff: "image/tiff",
};

export const FORMAT_EXTENSIONS: Record<ImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
  gif: "gif",
  tiff: "tiff",
};

export const QUALITY_FORMATS: ImageFormat[] = ["jpeg", "webp", "avif"];

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
