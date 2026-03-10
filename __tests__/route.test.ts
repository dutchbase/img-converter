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
import sharp from "sharp";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fileTypeMock = require("file-type") as { __setMockResult: (r: unknown) => void };

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

function makeValidRequest(options: {
  targetFormat?: string;
  quality?: string;
  resizeWidth?: string;
  skipTargetFormat?: boolean;
  file?: File;
} = {}): NextRequest {
  const formData = new FormData();
  const fakeBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
  formData.append("file", options.file ?? new File([fakeBytes], "photo.jpg", { type: "image/jpeg" }));
  if (!options.skipTargetFormat) {
    formData.append("targetFormat", options.targetFormat ?? "webp");
  }
  formData.append("quality", options.quality ?? "85");
  formData.append("maintainAspectRatio", "true");
  formData.append("removeMetadata", "false");
  if (options.resizeWidth !== undefined) {
    formData.append("resizeWidth", options.resizeWidth);
  }
  return new NextRequest("http://localhost/api/convert", { method: "POST", body: formData });
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
  beforeEach(() => {
    jest.clearAllMocks();
    (detectFormat as jest.Mock).mockReturnValue("jpeg");
    (fileTypeFromBuffer as jest.Mock).mockResolvedValue({ mime: "image/jpeg", ext: "jpg" });
    (sharp as jest.Mock).mockImplementation(() => ({
      metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
    }));
    (processImage as jest.Mock).mockResolvedValue(Buffer.from("out"));
  });

  it("returns 422 IMAGE_TOO_LARGE when image pixel count exceeds 25,000,000", async () => {
    (sharp as jest.Mock).mockImplementation(() => ({
      metadata: jest.fn().mockResolvedValue({ width: 5001, height: 5001 }),
    }));
    const req = makeValidRequest();
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("IMAGE_TOO_LARGE");
  });

  it("returns 200 for an image within the pixel limit", async () => {
    const req = makeValidRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/convert — REQ-104: magic-byte MIME verification (HTTP 415)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (detectFormat as jest.Mock).mockReturnValue("jpeg");
    (fileTypeFromBuffer as jest.Mock).mockResolvedValue({ mime: "image/jpeg", ext: "jpg" });
    (sharp as jest.Mock).mockImplementation(() => ({
      metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
    }));
    (processImage as jest.Mock).mockResolvedValue(Buffer.from("out"));
  });

  it("returns 415 UNSUPPORTED_FORMAT when file extension is .jpg but magic bytes are not JPEG", async () => {
    fileTypeMock.__setMockResult(null);
    const req = makeValidRequest();
    const res = await POST(req);
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toBe("UNSUPPORTED_FORMAT");
  });

  it("passes MIME verification for a valid JPEG file", async () => {
    fileTypeMock.__setMockResult({ mime: "image/jpeg", ext: "jpg" });
    const req = makeValidRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/convert — REQ-501: structured error responses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (detectFormat as jest.Mock).mockReturnValue("jpeg");
    (fileTypeFromBuffer as jest.Mock).mockResolvedValue({ mime: "image/jpeg", ext: "jpg" });
    (sharp as jest.Mock).mockImplementation(() => ({
      metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
    }));
    (processImage as jest.Mock).mockResolvedValue(Buffer.from("out"));
  });

  it("returns 413 FILE_TOO_LARGE with { error, message } when file exceeds 50 MB", async () => {
    const req = new NextRequest("http://localhost/api/convert", { method: "POST" });
    const fakeFile = { size: 52_428_801, name: "huge.jpg", type: "image/jpeg" };
    const fakeFormData = { get: (key: string) => key === "file" ? fakeFile : null };
    (req as unknown as { formData: jest.Mock }).formData = jest.fn().mockResolvedValue(fakeFormData);
    const res = await POST(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("FILE_TOO_LARGE");
  });

  it("returns 400 MISSING_FILE with field: 'file' when no file is attached", async () => {
    const req = new NextRequest("http://localhost/api/convert", {
      method: "POST",
      body: new FormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("MISSING_FILE");
    expect(body.field).toBe("file");
  });

  it("returns 400 MISSING_TARGET_FORMAT with field: 'targetFormat' when targetFormat is absent", async () => {
    const req = makeValidRequest({ skipTargetFormat: true });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("MISSING_TARGET_FORMAT");
    expect(body.field).toBe("targetFormat");
  });

  it("returns 400 INVALID_QUALITY with field: 'quality' when quality is out of range", async () => {
    const res1 = await POST(makeValidRequest({ quality: "0" }));
    expect(res1.status).toBe(400);
    const body1 = await res1.json();
    expect(body1.error).toBe("INVALID_QUALITY");
    expect(body1.field).toBe("quality");

    const res2 = await POST(makeValidRequest({ quality: "101" }));
    expect(res2.status).toBe(400);
    const body2 = await res2.json();
    expect(body2.error).toBe("INVALID_QUALITY");
    expect(body2.field).toBe("quality");
  });

  it("returns 400 INVALID_DIMENSION with field: 'resizeWidth' when width is non-positive", async () => {
    const req = makeValidRequest({ resizeWidth: "-5" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_DIMENSION");
    expect(body.field).toBe("resizeWidth");
  });

  it("returns 400 UNSUPPORTED_TARGET_FORMAT with field: 'targetFormat' when targetFormat is heic", async () => {
    const req = makeValidRequest({ targetFormat: "heic" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("UNSUPPORTED_TARGET_FORMAT");
    expect(body.field).toBe("targetFormat");
  });
});
