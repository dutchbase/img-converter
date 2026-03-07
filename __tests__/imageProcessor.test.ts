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
