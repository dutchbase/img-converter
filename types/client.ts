export * from "./index";

export function detectFormatFromMime(
  mimeType: string,
  filename?: string
): import("./index").ImageFormat | null {
  const map: Record<string, import("./index").ImageFormat> = {
    "image/jpeg": "jpeg",
    "image/jpg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "image/tiff": "tiff",
    // REQ-301: HEIC/HEIF support — all variants returned by file-type v21.3.0
    "image/heic": "heic",
    "image/heif": "heic",           // normalize heif → heic
    "image/heic-sequence": "heic",
    "image/heif-sequence": "heic",
  };

  const byMime = map[mimeType];
  if (byMime) return byMime;

  // REQ-301: Fallback — Firefox and older Chrome report .heic files as
  // application/octet-stream. Check file extension when MIME is generic.
  if (mimeType === "application/octet-stream" || mimeType === "" || mimeType == null) {
    const ext = filename?.split(".").pop()?.toLowerCase();
    if (ext === "heic" || ext === "heif") return "heic";
  }

  return null;
}

export { OUTPUT_FORMATS } from "./index";
