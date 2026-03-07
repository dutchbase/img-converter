// __tests__/heicDecoder.test.ts
import { decodeHeicToBuffer, LIVE_PHOTO_ERROR_CODE } from "@/lib/heicDecoder";

// Create a properly aligned ArrayBuffer (not sharing Node's pool) so Buffer.from(ab) starts at offset 0
const FAKE_JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const FAKE_JPEG_AB = FAKE_JPEG_BYTES.buffer.slice(
  FAKE_JPEG_BYTES.byteOffset,
  FAKE_JPEG_BYTES.byteOffset + FAKE_JPEG_BYTES.byteLength
) as ArrayBuffer;

jest.mock("heic-convert", () => {
  const mockConvert = jest.fn();
  mockConvert.all = jest.fn();
  return mockConvert;
});

import convert from "heic-convert";
const mockConvertAll = convert.all as jest.Mock;

describe("decodeHeicToBuffer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns a Buffer for a valid single-frame HEIC input (REQ-301)", async () => {
    mockConvertAll.mockResolvedValueOnce([
      { convert: jest.fn().mockResolvedValueOnce(FAKE_JPEG_AB) },
    ]);
    const result = await decodeHeicToBuffer(Buffer.from("fake-heic"));
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("throws LIVE_PHOTO_NOT_SUPPORTED for multi-frame HEIC (REQ-302)", async () => {
    mockConvertAll.mockResolvedValueOnce([
      { convert: jest.fn() },
      { convert: jest.fn() },
    ]);
    await expect(decodeHeicToBuffer(Buffer.from("fake-heic"))).rejects.toMatchObject({
      name: LIVE_PHOTO_ERROR_CODE,
    });
  });

  it("returned Buffer starts with JPEG SOI marker 0xFF 0xD8 (REQ-301)", async () => {
    mockConvertAll.mockResolvedValueOnce([
      { convert: jest.fn().mockResolvedValueOnce(FAKE_JPEG_AB) },
    ]);
    const result = await decodeHeicToBuffer(Buffer.from("fake-heic"));
    expect(result[0]).toBe(0xff);
    expect(result[1]).toBe(0xd8);
  });
});
