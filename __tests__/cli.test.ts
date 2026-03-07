// __tests__/cli.test.ts
// Wave 0 stubs — implementation in Wave 1 plans.
// All tests are it.todo() until cli/index.ts helpers are exported.

describe("detectFormatFromExt", () => {
  it.todo("returns 'jpeg' for .jpg");
  it.todo("returns 'jpeg' for .jpeg");
  it.todo("returns 'png' for .png");
  it.todo("returns 'webp' for .webp");
  it.todo("returns 'avif' for .avif");
  it.todo("returns 'gif' for .gif");
  it.todo("returns 'tiff' for .tiff and .tif");
  it.todo("returns 'heic' for .heic and .heif");
  it.todo("returns null for unknown extension .xyz");
  it.todo("is case-insensitive (.JPG → 'jpeg')");
});

describe("buildOutputPath", () => {
  it.todo("replaces extension with target format's extension");
  it.todo("uses input file's directory when no outputDir provided");
  it.todo("uses provided outputDir when given");
  it.todo("handles filename with no extension");
});

describe("buildConvertOptions", () => {
  it.todo("maps format, quality, width, height to ConvertOptions");
  it.todo("--no-metadata flag: removeMetadata is true (opts.metadata is false)");
  it.todo("--metadata (default): removeMetadata is false");
  it.todo("width and height are null when not provided");
  it.todo("quality defaults to 85 when not provided");
});

describe("formatKB", () => {
  it.todo("formats 0 bytes as '0 KB'");
  it.todo("formats 1024 bytes as '1 KB'");
  it.todo("formats 433152 bytes as '423 KB'");
  it.todo("rounds to nearest integer");
});

describe("pipe mode detection", () => {
  it.todo("isPipeMode returns true when isTTY is false and files is empty");
  it.todo("isPipeMode returns false when files has items even if isTTY is false");
  it.todo("isPipeMode returns false when isTTY is true");
});
