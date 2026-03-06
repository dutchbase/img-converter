import path from "path";
import fs from "fs";

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
  it.todo("returns true for a buffer containing two GCE frame markers");
  it.todo("returns false for a static GIF with no GCE markers");
  it.todo("returns false for a non-GIF file");
});
