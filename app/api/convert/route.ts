import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { processImage, detectFormat } from "@/lib/imageProcessor";
import { processingQueue } from "@/lib/processingQueue";
import { ConvertOptions, ImageFormat, FORMAT_MIME, FORMAT_EXTENSIONS } from "@/types";

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "MISSING_FILE", message: "No file provided" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE", message: "File exceeds 50 MB limit" },
        { status: 400 }
      );
    }

    // Fast format pre-filter based on browser-supplied MIME type
    const sourceFormat = detectFormat(file.type);
    if (!sourceFormat) {
      return NextResponse.json(
        { error: "UNSUPPORTED_FORMAT", message: "Unsupported image format" },
        { status: 400 }
      );
    }

    const targetFormat = formData.get("targetFormat") as ImageFormat | null;
    if (!targetFormat) {
      return NextResponse.json(
        { error: "MISSING_TARGET_FORMAT", message: "Target format is required" },
        { status: 400 }
      );
    }

    // Convert to buffer for security checks and processing
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    // REQ-104: Magic-byte MIME verification — authoritative security gate
    // Use dynamic import to avoid ERR_REQUIRE_ESM in Next.js CJS context
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = await fileTypeFromBuffer(inputBuffer);
    if (!detected || !detectFormat(detected.mime)) {
      return NextResponse.json(
        {
          error: "UNSUPPORTED_FORMAT",
          message: "File type does not match its contents",
        },
        { status: 415 }
      );
    }

    // REQ-101: Pixel dimension pre-check — reject images exceeding 25 megapixels
    const meta = await sharp(inputBuffer).metadata();
    if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_PIXELS) {
      return NextResponse.json(
        {
          error: "IMAGE_TOO_LARGE",
          message: "Image dimensions exceed limit",
        },
        { status: 422 }
      );
    }

    const quality = parseInt(formData.get("quality") as string ?? "85", 10);
    const resizeWidthRaw = formData.get("resizeWidth") as string | null;
    const resizeHeightRaw = formData.get("resizeHeight") as string | null;
    const maintainAspectRatio = formData.get("maintainAspectRatio") === "true";
    const removeMetadata = formData.get("removeMetadata") === "true";
    // REQ-107: Parse allowUpscaling from formData (only sent when checkbox is checked)
    const allowUpscaling = formData.get("allowUpscaling") === "true";

    const options: ConvertOptions = {
      targetFormat,
      quality: Math.min(100, Math.max(1, quality)),
      resizeWidth: resizeWidthRaw ? parseInt(resizeWidthRaw, 10) : null,
      resizeHeight: resizeHeightRaw ? parseInt(resizeHeightRaw, 10) : null,
      maintainAspectRatio,
      removeMetadata,
      allowUpscaling,
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
        return NextResponse.json(
          {
            error: "LIVE_PHOTO_NOT_SUPPORTED",
            message: "Live Photo detected — only still frames are supported.",
          },
          { status: 422 }
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
    return NextResponse.json(
      { error: "CONVERSION_FAILED", message: "Image conversion failed" },
      { status: 500 }
    );
  }
}
