import { sanitizeFilename } from "@/app/api/convert/route";

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
