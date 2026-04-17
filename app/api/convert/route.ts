import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { processImage, detectFormat } from "@/lib/imageProcessor";
import { processingQueue } from "@/lib/processingQueue";
import {
  ConvertOptions,
  ImageFormat,
  FORMAT_MIME,
  FORMAT_EXTENSIONS,
  INPUT_ONLY_FORMATS,
  FORMAT_LABELS,
  ApiErrorResponse,
} from "@/types";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_PIXELS = 25_000_000; // 25 megapixels

/**
 * Sanitizes a raw filename for safe use in Content-Disposition headers.
 * Strips any character not in [a-zA-Z0-9._-] and falls back to "converted"
 * if the result is empty.
 *
 * REQ-102: prevents path traversal and header injection via filename.
 */
export function sanitizeFilename(rawName: string, ext: string): string {
  const safe = rawName.replace(/[^a-zA-Z0-9._-]/g, "") || "converted";
  return `${safe}.${ext}`;
}

function errorResponse(body: ApiErrorResponse, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return errorResponse({ error: "MISSING_FILE", message: "No file provided", field: "file" }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse({ error: "FILE_TOO_LARGE", message: "File exceeds 50 MB limit" }, 413);
    }

    // Fast format pre-filter based on browser-supplied MIME type
    const sourceFormat = detectFormat(file.type);
    if (!sourceFormat) {
      return errorResponse({ error: "UNSUPPORTED_FORMAT", message: "Unsupported image format" }, 400);
    }

    const targetFormat = formData.get("targetFormat") as ImageFormat | null;
    if (!targetFormat) {
      return errorResponse(
        { error: "MISSING_TARGET_FORMAT", message: "Target format is required", field: "targetFormat" },
        400
      );
    }

    if (INPUT_ONLY_FORMATS.includes(targetFormat as ImageFormat)) {
      return errorResponse(
        {
          error: "UNSUPPORTED_TARGET_FORMAT",
          message: `${FORMAT_LABELS[targetFormat as ImageFormat]} is not a supported output format`,
          field: "targetFormat",
        },
        400
      );
    }

    // Convert to buffer for security checks and processing
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    // REQ-104: Magic-byte MIME verification — authoritative security gate
    // Use dynamic import to avoid ERR_REQUIRE_ESM in Next.js CJS context
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = await fileTypeFromBuffer(inputBuffer);
    if (!detected || !detectFormat(detected.mime)) {
      return errorResponse(
        { error: "UNSUPPORTED_FORMAT", message: "File type does not match its contents" },
        415
      );
    }

    // REQ-101: Pixel dimension pre-check — reject images exceeding 25 megapixels
    const meta = await sharp(inputBuffer).metadata();
    if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_PIXELS) {
      return errorResponse(
        { error: "IMAGE_TOO_LARGE", message: "Image dimensions exceed limit" },
        422
      );
    }

    const quality = parseInt(formData.get("quality") as string ?? "85", 10);
    if (isNaN(quality) || quality < 1 || quality > 100) {
      return errorResponse(
        { error: "INVALID_QUALITY", message: "Quality must be between 1 and 100", field: "quality" },
        400
      );
    }

    const resizeWidthRaw = formData.get("resizeWidth") as string | null;
    if (resizeWidthRaw !== null && resizeWidthRaw !== "") {
      const w = parseInt(resizeWidthRaw, 10);
      if (isNaN(w) || w <= 0) {
        return errorResponse(
          { error: "INVALID_DIMENSION", message: "Width must be a positive integer", field: "resizeWidth" },
          400
        );
      }
    }
    const resizeHeightRaw = formData.get("resizeHeight") as string | null;
    if (resizeHeightRaw !== null && resizeHeightRaw !== "") {
      const h = parseInt(resizeHeightRaw, 10);
      if (isNaN(h) || h <= 0) {
        return errorResponse(
          { error: "INVALID_DIMENSION", message: "Height must be a positive integer", field: "resizeHeight" },
          400
        );
      }
    }

    const maintainAspectRatio = formData.get("maintainAspectRatio") === "true";
    const removeMetadata = formData.get("removeMetadata") === "true";
    // REQ-107: Parse allowUpscaling from formData (only sent when checkbox is checked)
    const allowUpscaling = formData.get("allowUpscaling") === "true";

    // Advanced processing options — all optional
    const rotateRaw = formData.get("rotate") as string | null;
    const rotate = rotateRaw !== null && rotateRaw !== "" ? parseFloat(rotateRaw) : undefined;
    const flip = formData.get("flip") === "true" ? true : undefined;
    const flop = formData.get("flop") === "true" ? true : undefined;
    const grayscale = formData.get("grayscale") === "true" ? true : undefined;
    const blurRaw = formData.get("blur") as string | null;
    const blur = blurRaw !== null && blurRaw !== "" ? parseFloat(blurRaw) : undefined;
    const sharpen = formData.get("sharpen") === "true" ? true : undefined;
    const normalize = formData.get("normalize") === "true" ? true : undefined;
    const trim = formData.get("trim") === "true" ? true : undefined;

    const options: ConvertOptions = {
      targetFormat,
      quality,
      resizeWidth: resizeWidthRaw && resizeWidthRaw !== "" ? parseInt(resizeWidthRaw, 10) : null,
      resizeHeight: resizeHeightRaw && resizeHeightRaw !== "" ? parseInt(resizeHeightRaw, 10) : null,
      maintainAspectRatio,
      removeMetadata,
      allowUpscaling,
      rotate,
      flip,
      flop,
      grayscale,
      blur,
      sharpen,
      normalize,
      trim,
    };

    await processingQueue.acquire();
    let outputBuffer: Buffer;
    try {
      outputBuffer = await processImage(inputBuffer, options, sourceFormat ?? undefined);
    } catch (processErr) {
      if (
        processErr instanceof Error &&
        processErr.name === "LIVE_PHOTO_NOT_SUPPORTED"
      ) {
        return errorResponse(
          { error: "LIVE_PHOTO_NOT_SUPPORTED", message: "Live Photo detected — only still frames are supported." },
          422
        );
      }
      throw processErr;
    } finally {
      processingQueue.release();
    }

    // REQ-102: Sanitize filename for Content-Disposition header
    const rawName = file.name.replace(/\.[^.]+$/, "");
    const ext = FORMAT_EXTENSIONS[targetFormat];
    const filename = sanitizeFilename(rawName, ext);

    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        "Content-Type": FORMAT_MIME[targetFormat],
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": outputBuffer.length.toString(),
        "X-Output-Size": outputBuffer.length.toString(),
        "X-Output-Filename": filename,
      },
    });
  } catch (err) {
    console.error("Conversion error:", err);
    return errorResponse({ error: "CONVERSION_FAILED", message: "Image conversion failed" }, 500);
  }
}
