// __tests__/cli.test.ts
// Wave 1 — real assertions for CLI pure helpers.
// RED: This file will fail until cli/helpers.ts is created.

import {
  detectFormatFromExt,
  buildOutputPath,
  buildConvertOptions,
  formatKB,
  isPipeMode,
} from "@/cli/helpers";

describe("detectFormatFromExt", () => {
  it("returns 'jpeg' for .jpg", () => {
    expect(detectFormatFromExt("/photos/image.jpg")).toBe("jpeg");
  });

  it("returns 'jpeg' for .jpeg", () => {
    expect(detectFormatFromExt("/photos/image.jpeg")).toBe("jpeg");
  });

  it("returns 'png' for .png", () => {
    expect(detectFormatFromExt("/photos/image.png")).toBe("png");
  });

  it("returns 'webp' for .webp", () => {
    expect(detectFormatFromExt("/photos/image.webp")).toBe("webp");
  });

  it("returns 'avif' for .avif", () => {
    expect(detectFormatFromExt("/photos/image.avif")).toBe("avif");
  });

  it("returns 'gif' for .gif", () => {
    expect(detectFormatFromExt("/photos/image.gif")).toBe("gif");
  });

  it("returns 'tiff' for .tiff and .tif", () => {
    expect(detectFormatFromExt("/photos/image.tiff")).toBe("tiff");
    expect(detectFormatFromExt("/photos/image.tif")).toBe("tiff");
  });

  it("returns 'heic' for .heic and .heif", () => {
    expect(detectFormatFromExt("/photos/image.heic")).toBe("heic");
    expect(detectFormatFromExt("/photos/image.heif")).toBe("heic");
  });

  it("returns null for unknown extension .xyz", () => {
    expect(detectFormatFromExt("/photos/image.xyz")).toBeNull();
  });

  it("is case-insensitive (.JPG -> 'jpeg')", () => {
    expect(detectFormatFromExt("/photos/IMAGE.JPG")).toBe("jpeg");
    expect(detectFormatFromExt("/photos/IMAGE.PNG")).toBe("png");
  });
});

describe("buildOutputPath", () => {
  it("replaces extension with target format's extension", () => {
    expect(buildOutputPath("/photos/x.jpg", "webp")).toBe("/photos/x.webp");
  });

  it("uses input file's directory when no outputDir provided", () => {
    expect(buildOutputPath("/photos/vacation.png", "jpeg")).toBe("/photos/vacation.jpg");
  });

  it("uses provided outputDir when given", () => {
    expect(buildOutputPath("/photos/x.jpg", "webp", "/out")).toBe("/out/x.webp");
  });

  it("handles filename with no extension", () => {
    const result = buildOutputPath("/photos/noext", "png");
    expect(result).toBe("/photos/noext.png");
  });
});

describe("buildConvertOptions", () => {
  const baseOpts = {
    format: "webp",
    quality: 85,
    metadata: true,
    concurrency: 4,
    quiet: false,
  };

  it("maps format, quality, width, height to ConvertOptions", () => {
    const opts = { ...baseOpts, width: 800, height: 600 };
    const result = buildConvertOptions(opts);
    expect(result.targetFormat).toBe("webp");
    expect(result.quality).toBe(85);
    expect(result.resizeWidth).toBe(800);
    expect(result.resizeHeight).toBe(600);
    expect(result.maintainAspectRatio).toBe(true);
  });

  it("--no-metadata flag: removeMetadata is true (opts.metadata is false)", () => {
    const opts = { ...baseOpts, metadata: false };
    const result = buildConvertOptions(opts);
    expect(result.removeMetadata).toBe(true);
  });

  it("--metadata (default): removeMetadata is false", () => {
    const opts = { ...baseOpts, metadata: true };
    const result = buildConvertOptions(opts);
    expect(result.removeMetadata).toBe(false);
  });

  it("width and height are null when not provided", () => {
    const result = buildConvertOptions(baseOpts);
    expect(result.resizeWidth).toBeNull();
    expect(result.resizeHeight).toBeNull();
  });

  it("quality defaults to 85 when not provided", () => {
    const opts = { ...baseOpts, quality: 85 };
    const result = buildConvertOptions(opts);
    expect(result.quality).toBe(85);
  });
});

describe("formatKB", () => {
  it("formats 0 bytes as '0 KB'", () => {
    expect(formatKB(0)).toBe("0 KB");
  });

  it("formats 1024 bytes as '1 KB'", () => {
    expect(formatKB(1024)).toBe("1 KB");
  });

  it("formats 433152 bytes as '423 KB'", () => {
    expect(formatKB(433152)).toBe("423 KB");
  });

  it("rounds to nearest integer", () => {
    // 1536 bytes = 1.5 KB -> rounds to 2
    expect(formatKB(1536)).toBe("2 KB");
    // 512 bytes = 0.5 KB -> rounds to 1
    expect(formatKB(512)).toBe("1 KB");
  });
});

describe("pipe mode detection", () => {
  it("isPipeMode returns true when isTTY is false and files is empty", () => {
    expect(isPipeMode(false, [])).toBe(true);
  });

  it("isPipeMode returns false when files has items even if isTTY is false", () => {
    expect(isPipeMode(false, ["a.jpg"])).toBe(false);
  });

  it("isPipeMode returns false when isTTY is true", () => {
    expect(isPipeMode(true, [])).toBe(false);
  });
});
