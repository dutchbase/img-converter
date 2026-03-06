import sharp from "sharp";
import path from "path";
import fs from "fs";
import { processImage } from "@/lib/imageProcessor";

const FIXTURES = path.join(__dirname, "fixtures");

beforeAll(async () => {
  fs.mkdirSync(FIXTURES, { recursive: true });
  await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toFile(path.join(FIXTURES, "small.png"));
});

describe("processImage — REQ-101: decompression bomb guard", () => {
  it.todo("rejects images where width × height > 25,000,000 pixels");
  it.todo("accepts images at exactly the pixel limit");
});

describe("processImage — REQ-103: ICC color profile preservation", () => {
  it.todo("keepIccProfile() is called when removeMetadata is true");
  it.todo("withMetadata() is called when removeMetadata is false");
});

describe("processImage — REQ-105: AVIF effort cap", () => {
  it.todo("AVIF pipeline uses effort option, not speed");
});

describe("processImage — REQ-107: upscaling prevention", () => {
  it.todo("withoutEnlargement is true when allowUpscaling is false/undefined");
  it.todo("withoutEnlargement is false when allowUpscaling is true");
});
