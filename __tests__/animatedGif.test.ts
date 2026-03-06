import path from "path";
import fs from "fs";
import { isAnimatedGif } from "@/components/ImageConverter";

const FIXTURES = path.join(__dirname, "fixtures");

beforeAll(() => {
  fs.mkdirSync(FIXTURES, { recursive: true });
  // animated GIF fixture
  const animatedGifBytes = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x21, 0xF9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x21, 0xF9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x3B,
  ]);
  fs.writeFileSync(path.join(FIXTURES, "animated.gif"), animatedGifBytes);
  // static GIF fixture
  const staticGifBytes = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x37, 0x61,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x3B,
  ]);
  fs.writeFileSync(path.join(FIXTURES, "static.gif"), staticGifBytes);
});

describe("isAnimatedGif — REQ-106: client-side animated GIF detection", () => {
  it("returns true for a buffer containing two GCE frame markers", () => {
    const bytes = new Uint8Array(fs.readFileSync(path.join(FIXTURES, "animated.gif")));
    expect(isAnimatedGif(bytes)).toBe(true);
  });
  it("returns false for a static GIF with no GCE markers", () => {
    const bytes = new Uint8Array(fs.readFileSync(path.join(FIXTURES, "static.gif")));
    expect(isAnimatedGif(bytes)).toBe(false);
  });
  it("returns false for a non-GIF file", () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A]);
    expect(isAnimatedGif(pngHeader)).toBe(false);
  });
});
