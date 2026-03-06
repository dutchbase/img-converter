describe("POST /api/convert — REQ-101: dimension limit HTTP response", () => {
  it.todo("returns HTTP 422 with IMAGE_TOO_LARGE error for oversized images");
  it.todo("returns error body shape { error, message }");
});

describe("POST /api/convert — REQ-102: filename sanitization", () => {
  it.todo("sanitizes Content-Disposition filename to [a-zA-Z0-9._-] only");
  it.todo("falls back to 'converted.{ext}' when sanitized name is empty");
});

describe("POST /api/convert — REQ-104: MIME type verification", () => {
  it.todo("returns HTTP 415 when magic bytes do not match a supported format");
  it.todo("accepts valid image files with correct magic bytes");
});
