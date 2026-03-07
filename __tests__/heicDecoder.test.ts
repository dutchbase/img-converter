// __tests__/heicDecoder.test.ts
// Wave 0 stubs — implementation covered in plan 03-02.
// Note: heic-convert is CJS, so no ESM mock setup will be needed when implementing.
// Imports are deferred until implementation exists to avoid module resolution errors.

describe("decodeHeicToBuffer", () => {
  it.todo("returns a Buffer for a valid single-frame HEIC input (REQ-301)");
  it.todo("throws LIVE_PHOTO_NOT_SUPPORTED for multi-frame HEIC (REQ-302)");
  it.todo("returns a Buffer whose first bytes are a valid JPEG SOI marker (REQ-301)");
});
