import { sanitizeFilename, POST } from "@/app/api/convert/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/imageProcessor", () => ({
  processImage: jest.fn(),
  detectFormat: jest.fn(),
}));
jest.mock("@/lib/processingQueue", () => ({
  processingQueue: { acquire: jest.fn(), release: jest.fn() },
}));
jest.mock("sharp", () => {
  const mockSharp = jest.fn(() => ({
    metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
  }));
  return mockSharp;
});

import { processImage, detectFormat } from "@/lib/imageProcessor";
import { fileTypeFromBuffer } from "file-type";

function makeHeicRequest(): NextRequest {
  const formData = new FormData();
  const fakeBytes = new Uint8Array([0x00, 0x00, 0x00, 0x18]);
  const file = new File([fakeBytes], "photo.heic", { type: "image/heic" });
  formData.append("file", file);
  formData.append("targetFormat", "jpeg");
  formData.append("quality", "85");
  formData.append("maintainAspectRatio", "true");
  formData.append("removeMetadata", "false");
  return new NextRequest("http://localhost/api/convert", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/convert — REQ-302: Live Photo 422 rejection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (detectFormat as jest.Mock).mockReturnValue("heic");
    (fileTypeFromBuffer as jest.Mock).mockResolvedValue({ mime: "image/heic", ext: "heic" });
  });

  it("returns 422 LIVE_PHOTO_NOT_SUPPORTED for Live Photo HEIC", async () => {
    const livePhotoErr = new Error("LIVE_PHOTO_NOT_SUPPORTED");
    livePhotoErr.name = "LIVE_PHOTO_NOT_SUPPORTED";
    (processImage as jest.Mock).mockRejectedValueOnce(livePhotoErr);

    const req = makeHeicRequest();
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("LIVE_PHOTO_NOT_SUPPORTED");
    expect(body.message).toBe("Live Photo detected — only still frames are supported.");
  });
});

describe("POST /api/convert — REQ-102: filename sanitization", () => {
  it("keeps safe characters unchanged", () => {
    expect(sanitizeFilename("photo", "jpg")).toBe("photo.jpg");
  });

  it("strips path traversal characters from filename", () => {
    const result = sanitizeFilename("photo../../../etc", "jpg");
    // slashes stripped, dots and alphanumeric kept: "photo.."+".."+".."+etc = photo......etc
    expect(result).toBe("photo......etc.jpg");
  });

  it("strips spaces and special characters", () => {
    expect(sanitizeFilename("my photo!", "webp")).toBe("myphoto.webp");
  });

  it("falls back to 'converted.{ext}' when sanitized name is empty", () => {
    expect(sanitizeFilename("!!!###", "png")).toBe("converted.png");
  });

  it("falls back to 'converted.{ext}' when original name is only special chars", () => {
    expect(sanitizeFilename("   ", "gif")).toBe("converted.gif");
  });

  it("preserves dots and hyphens in filenames", () => {
    expect(sanitizeFilename("my-photo.backup", "png")).toBe("my-photo.backup.png");
  });
});

describe("POST /api/convert — REQ-101: pixel dimension limit (HTTP 422)", () => {
  it.todo(
    "returns 422 IMAGE_TOO_LARGE when image pixel count exceeds 25,000,000"
  );
  it.todo("returns 200 for an image within the pixel limit");
});

describe("POST /api/convert — REQ-104: magic-byte MIME verification (HTTP 415)", () => {
  it.todo(
    "returns 415 UNSUPPORTED_FORMAT when file extension is .jpg but magic bytes are not JPEG"
  );
  it.todo("passes MIME verification for a valid JPEG file");
});

describe("POST /api/convert — REQ-501: structured error responses", () => {
  it.todo("returns 413 FILE_TOO_LARGE with { error, message } when file exceeds 50 MB");
  it.todo("returns 400 MISSING_FILE with field: 'file' when no file is attached");
  it.todo("returns 400 MISSING_TARGET_FORMAT with field: 'targetFormat' when targetFormat is absent");
  it.todo("returns 400 INVALID_QUALITY with field: 'quality' when quality is out of range");
  it.todo("returns 400 INVALID_DIMENSION with field: 'resizeWidth' when width is non-positive");
  it.todo("returns 400 UNSUPPORTED_TARGET_FORMAT with field: 'targetFormat' when targetFormat is heic");
});
