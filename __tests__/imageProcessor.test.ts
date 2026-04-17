import sharp from "sharp";
import path from "path";
import fs from "fs";
import { processImage, detectFormat } from "@/lib/imageProcessor";
import { ConvertOptions } from "@/types";

const FIXTURES = path.join(__dirname, "fixtures");

const baseOptions: ConvertOptions = {
  targetFormat: "png",
  quality: 80,
  resizeWidth: null,
  resizeHeight: null,
  maintainAspectRatio: true,
  removeMetadata: false,
};

beforeAll(async () => {
  fs.mkdirSync(FIXTURES, { recursive: true });
  // Create a small 32x32 PNG with an embedded sRGB ICC profile
  await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .withMetadata()
    .png()
    .toFile(path.join(FIXTURES, "small.png"));
});

describe("processImage — REQ-101: decompression bomb guard", () => {
  it("rejects images where width x height > 25,000,000 pixels", async () => {
    // 5001x5001 = 25,010,001 pixels — exceeds 25 MP limit
    const largeBuf = await sharp({
      create: {
        width: 5001,
        height: 5001,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    await expect(processImage(largeBuf, baseOptions)).rejects.toThrow(
      "IMAGE_TOO_LARGE"
    );
  });

  it("accepts images at exactly the pixel limit", async () => {
    // 5000x5000 = 25,000,000 pixels exactly — should NOT throw
    const exactBuf = await sharp({
      create: {
        width: 5000,
        height: 5000,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .png()
      .toBuffer();

    await expect(
      processImage(exactBuf, { ...baseOptions, targetFormat: "jpeg" })
    ).resolves.toBeInstanceOf(Buffer);
  });
});

describe("processImage — REQ-103: ICC color profile preservation", () => {
  it("retains ICC profile when removeMetadata is true", async () => {
    // Create a PNG with an embedded sRGB ICC profile
    const inputBuf = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    })
      .withMetadata()
      .png()
      .toBuffer();

    const output = await processImage(inputBuf, {
      ...baseOptions,
      removeMetadata: true,
      targetFormat: "png",
    });

    const meta = await sharp(output).metadata();
    // ICC profile should be preserved even when EXIF metadata is stripped
    expect(meta.icc).toBeDefined();
  });

  it("retains metadata when removeMetadata is false", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    const output = await processImage(inputBuf, {
      ...baseOptions,
      removeMetadata: false,
      targetFormat: "png",
    });

    const meta = await sharp(output).metadata();
    expect(meta).toBeDefined();
    // Should have ICC info when metadata is kept
    expect(meta.icc).toBeDefined();
  });
});

describe("processImage — REQ-105: AVIF effort cap", () => {
  it("AVIF pipeline uses effort option, not speed", async () => {
    const avifSpy = jest.spyOn(sharp.prototype, "avif");

    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    await processImage(inputBuf, {
      ...baseOptions,
      targetFormat: "avif",
      quality: 60,
    });

    expect(avifSpy).toHaveBeenCalledWith(
      expect.objectContaining({ effort: 4 })
    );
    expect(avifSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ speed: expect.anything() })
    );

    avifSpy.mockRestore();
  });
});

describe("detectFormat — REQ-301: HEIC/HEIF MIME variants", () => {
  it("maps image/heic to heic", () => expect(detectFormat("image/heic")).toBe("heic"));
  it("maps image/heif to heic", () => expect(detectFormat("image/heif")).toBe("heic"));
  it("maps image/heic-sequence to heic", () => expect(detectFormat("image/heic-sequence")).toBe("heic"));
  it("maps image/heif-sequence to heic", () => expect(detectFormat("image/heif-sequence")).toBe("heic"));
});

describe("processImage — REQ-107: upscaling prevention", () => {
  it("does not enlarge image when allowUpscaling is false/undefined", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));

    // Input is 32x32; request resize to 200 — should NOT upscale
    const output = await processImage(inputBuf, {
      ...baseOptions,
      resizeWidth: 200,
      // allowUpscaling not set (undefined defaults to no upscaling)
    });

    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(32); // still 32, not upscaled to 200
  });

  it("enlarges image when allowUpscaling is true", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));

    // Input is 32x32; request resize to 200 with upscaling allowed
    const output = await processImage(inputBuf, {
      ...baseOptions,
      resizeWidth: 200,
      allowUpscaling: true,
    });

    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(200); // upscaled to 200
  });
});

// ---------------------------------------------------------------------------
// New processing option tests (previously untested paths)
// ---------------------------------------------------------------------------

describe("processImage — rotate", () => {
  it("rotates image by 90 degrees (swaps width/height)", async () => {
    // Create 32x16 (wide) image — after 90° rotation it should be 16x32 (tall)
    const wideBuf = await sharp({
      create: { width: 32, height: 16, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const output = await processImage(wideBuf, {
      ...baseOptions,
      rotate: 90,
    });

    const meta = await sharp(output).metadata();
    // After 90° rotation, a 32×16 becomes 16×32
    expect(meta.width).toBe(16);
    expect(meta.height).toBe(32);
  });
});

describe("processImage — flip/flop", () => {
  it("flip option produces a valid image (horizontal mirror)", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    const output = await processImage(inputBuf, { ...baseOptions, flip: true });
    expect(Buffer.isBuffer(output)).toBe(true);
    const meta = await sharp(output).metadata();
    // Dimensions unchanged after flip
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(32);
  });

  it("flop option produces a valid image (vertical mirror)", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    const output = await processImage(inputBuf, { ...baseOptions, flop: true });
    expect(Buffer.isBuffer(output)).toBe(true);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(32);
  });
});

describe("processImage — grayscale", () => {
  it("produces valid output with grayscale option", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    const output = await processImage(inputBuf, { ...baseOptions, grayscale: true });
    expect(Buffer.isBuffer(output)).toBe(true);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("png");
  });
});

describe("processImage — blur", () => {
  it("produces valid output with blur option", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    const output = await processImage(inputBuf, { ...baseOptions, blur: 2 });
    expect(Buffer.isBuffer(output)).toBe(true);
  });

  it("does not apply blur when sigma is 0", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    // blur: 0 should not invoke the blur pipeline (guard: blur > 0)
    const output = await processImage(inputBuf, { ...baseOptions, blur: 0 });
    expect(Buffer.isBuffer(output)).toBe(true);
  });
});

describe("processImage — sharpen", () => {
  it("produces valid output with sharpen option", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    const output = await processImage(inputBuf, { ...baseOptions, sharpen: true });
    expect(Buffer.isBuffer(output)).toBe(true);
  });
});

describe("processImage — normalize", () => {
  it("produces valid output with normalize option", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    const output = await processImage(inputBuf, { ...baseOptions, normalize: true });
    expect(Buffer.isBuffer(output)).toBe(true);
  });
});

describe("processImage — GIF output format", () => {
  it("converts PNG to GIF successfully", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    const output = await processImage(inputBuf, { ...baseOptions, targetFormat: "gif" });
    expect(Buffer.isBuffer(output)).toBe(true);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("gif");
  });
});

describe("processImage — TIFF output format", () => {
  it("converts PNG to TIFF successfully", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    const output = await processImage(inputBuf, { ...baseOptions, targetFormat: "tiff" });
    expect(Buffer.isBuffer(output)).toBe(true);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("tiff");
  });
});

describe("processImage — crop", () => {
  it("extracts a region from the image", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    const output = await processImage(inputBuf, {
      ...baseOptions,
      crop: { left: 0, top: 0, width: 16, height: 16 },
    });
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(16);
    expect(meta.height).toBe(16);
  });
});

describe("processImage — background fill", () => {
  it("applies background color for JPEG output (flattens transparency)", async () => {
    // Create a PNG with alpha channel
    const alphaBuf = await sharp({
      create: { width: 32, height: 32, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } },
    })
      .png()
      .toBuffer();

    const output = await processImage(alphaBuf, {
      ...baseOptions,
      targetFormat: "jpeg",
      background: "#ffffff",
    });
    expect(Buffer.isBuffer(output)).toBe(true);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("jpeg");
  });
});

describe("processImage — autoRotate", () => {
  it("applies auto-rotation without error", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    const output = await processImage(inputBuf, { ...baseOptions, autoRotate: true });
    expect(Buffer.isBuffer(output)).toBe(true);
  });
});

describe("processImage — unsupported format", () => {
  it("throws for unsupported output format", async () => {
    const inputBuf = fs.readFileSync(path.join(FIXTURES, "small.png"));
    await expect(
      processImage(inputBuf, { ...baseOptions, targetFormat: "bmp" as never })
    ).rejects.toThrow("Unsupported output format");
  });
});
