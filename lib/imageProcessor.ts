import sharp from "sharp";
import { ImageFormat, ConvertOptions } from "@/types";
import { decodeHeicToBuffer } from "@/lib/heicDecoder";

export async function processImage(
  buffer: Buffer,
  options: ConvertOptions,
  sourceFormat?: ImageFormat
): Promise<Buffer> {
  // HEIC/HEIF pre-decode step — must run before Sharp pipeline (Sharp cannot read HEIC)
  if (sourceFormat === "heic") {
    buffer = await decodeHeicToBuffer(buffer);
  }

  // REQ-101: Guard against decompression bombs
  const meta = await sharp(buffer).metadata();
  if ((meta.width ?? 0) * (meta.height ?? 0) > 25_000_000) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  let image = sharp(buffer, { limitInputPixels: 25_000_000 });

  // REQ-103: Preserve ICC profile; strip other metadata only when requested
  if (options.removeMetadata) {
    image = image.keepIccProfile();
  } else {
    image = image.withMetadata();
  }

  // Auto-rotate using EXIF orientation
  if (options.autoRotate) {
    image = image.rotate();
  } else if (options.rotate !== undefined && options.rotate !== 0) {
    const bg = options.background ?? "#000000";
    image = image.rotate(options.rotate, { background: bg });
  }

  // Flip (horizontal mirror) and flop (vertical mirror)
  if (options.flip) {
    image = image.flop();
  }
  if (options.flop) {
    image = image.flip();
  }

  // Crop before resize
  if (options.crop) {
    image = image.extract({
      left: options.crop.left,
      top: options.crop.top,
      width: options.crop.width,
      height: options.crop.height,
    });
  }

  // Resize if dimensions provided
  if (options.resizeWidth || options.resizeHeight) {
    image = image.resize({
      width: options.resizeWidth ?? undefined,
      height: options.resizeHeight ?? undefined,
      fit: options.maintainAspectRatio ? "inside" : "fill",
      // REQ-107: Prevent upscaling unless explicitly allowed
      withoutEnlargement: !options.allowUpscaling,
      background: options.background ?? { r: 255, g: 255, b: 255, alpha: 1 },
    });
  }

  // Grayscale
  if (options.grayscale) {
    image = image.grayscale();
  }

  // Normalize (automatic contrast enhancement)
  if (options.normalize) {
    image = image.normalize();
  }

  // Blur (Gaussian)
  if (options.blur !== undefined && options.blur > 0) {
    image = image.blur(options.blur);
  }

  // Sharpen (unsharp mask)
  if (options.sharpen) {
    image = image.sharpen();
  }

  // Trim whitespace/solid borders
  if (options.trim) {
    image = image.trim();
  }

  // Background fill (for transparency → opaque format conversion)
  if (options.background && options.targetFormat === "jpeg") {
    image = image.flatten({ background: options.background });
  }

  // Convert to target format
  image = applyFormat(image, options.targetFormat, options.quality);

  return image.toBuffer();
}

function applyFormat(
  image: sharp.Sharp,
  format: ImageFormat,
  quality: number
): sharp.Sharp {
  switch (format) {
    case "jpeg":
      return image.jpeg({ quality });
    case "png":
      return image.png({ compressionLevel: Math.round((100 - quality) / 11) });
    case "webp":
      return image.webp({ quality });
    case "avif":
      // REQ-105: Explicitly cap encoding effort to prevent CPU exhaustion
      return image.avif({ quality, effort: 4 });
    case "gif":
      return image.gif();
    case "tiff":
      return image.tiff({ quality });
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }
}

export function detectFormat(mimeType: string): ImageFormat | null {
  const map: Record<string, ImageFormat> = {
    "image/jpeg": "jpeg",
    "image/jpg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "image/tiff": "tiff",
    "image/heic": "heic",
    "image/heif": "heic",
    "image/heic-sequence": "heic",
    "image/heif-sequence": "heic",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/x-bmp": "bmp",
    "image/x-ms-bmp": "bmp",
  };
  return map[mimeType] ?? null;
}

/**
 * Get metadata/info about an image buffer.
 */
export async function getImageMetadata(buffer: Buffer): Promise<sharp.Metadata> {
  return sharp(buffer).metadata();
}
